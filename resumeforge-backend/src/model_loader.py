"""Model artifact discovery, loading and startup self-check.

.. warning::

   ``joblib``/``pickle`` files can execute arbitrary code when they are loaded.
   Only load artifacts produced by your own training pipeline, keep them in a
   trusted local directory, and never accept a path from user input or a URL.
   This module therefore only ever reads the paths configured in
   :mod:`api.settings` (or :class:`src.config.RuntimeConfig`).

Accepted artifact layouts (auto-detected in this order)
--------------------------------------------------------
A. A single fitted :class:`sklearn.pipeline.Pipeline` at ``MODEL_PATH``
   containing a vectorizer step and a classifier step. Steps are recognised by
   **type**, not by name, so ``tfidf``/``vect``/``bow`` all work.
B. Separate fitted ``TfidfVectorizer`` (``VECTORIZER_PATH``) and
   ``LogisticRegression`` (``CLASSIFIER_PATH``).
C. An optional ``LabelEncoder`` (``LABEL_ENCODER_PATH``). When it is missing (or
   has no ``classes_``), the classifier's own ``classes_`` attribute is used.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import joblib
import numpy as np
import sklearn
from sklearn.pipeline import Pipeline

from src.config import RuntimeConfig, SettingsLike, resolve_path
from src.utils import first_present

__all__ = [
    "EXPECTED_NGRAM_RANGE",
    "IncompatibleArtifactError",
    "LoadedModel",
    "ModelLoadError",
    "ModelNotFoundError",
    "load_model",
    "load_model_safe",
    "run_self_check",
]

logger = logging.getLogger(__name__)

EXPECTED_NGRAM_RANGE: Final[tuple[int, int]] = (1, 2)
SELF_CHECK_TEXT: Final[str] = (
    "Synthetic self-check sentence: machine learning engineer with python, sql, "
    "aws and tensorflow experience."
)
_PROBABILITY_SUM_TOLERANCE: Final[float] = 1e-3


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class ModelLoadError(RuntimeError):
    """Raised when an artifact exists but cannot be used for inference."""


class ModelNotFoundError(ModelLoadError):
    """Raised when no usable artifact was found in any configured location."""


class IncompatibleArtifactError(ModelLoadError):
    """Raised when the artifact does not satisfy the inference contract."""


# --------------------------------------------------------------------------- #
# Loaded artifact
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class LoadedModel:
    """Everything the API needs to turn text into probabilities.

    Attributes
    ----------
    class_names:
        Ordered class labels exactly as reported by the artifact. These are the
        only category names the API ever returns.
    transform_fn:
        Callable mapping a list of strings to a sparse/dense feature matrix.
        For layout A it is the pipeline prefix up to (but excluding) the
        classifier, so intermediate steps (``'passthrough'``, feature selection,
        custom transformers) are preserved.
    predict_proba_fn:
        Callable mapping the feature matrix to an ``(n_samples, n_classes)``
        probability array.
    """

    class_names: list[str]
    model_name: str
    model_type: str
    transform_fn: Callable[[Sequence[str]], Any]
    predict_proba_fn: Callable[[Any], Any]
    ngram_range: tuple[int, int] | None = None
    vocab_size: int | None = None
    sklearn_version_trained: str | None = None
    sklearn_version_runtime: str = ""
    classes_source: str = "classifier"
    pipeline_path: Path | None = None
    vectorizer_path: Path | None = None
    classifier_path: Path | None = None
    label_encoder_path: Path | None = None
    metadata_path: Path | None = None
    trained_date: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def num_classes(self) -> int:
        """Number of classes the model can predict."""
        return len(self.class_names)


# --------------------------------------------------------------------------- #
# Type-based component detection
# --------------------------------------------------------------------------- #


def _is_vectorizer(estimator: Any) -> bool:
    """True for sklearn vectorizers (anything that produces a feature matrix)."""
    if not hasattr(estimator, "transform"):
        return False
    return (
        hasattr(estimator, "get_feature_names_out")
        or hasattr(estimator, "vocabulary_")
        or hasattr(estimator, "idf_")
    )


def _is_classifier(estimator: Any) -> bool:
    """True for estimators that expose ``predict`` and class information."""
    if not hasattr(estimator, "predict"):
        return False
    return (
        hasattr(estimator, "classes_")
        or hasattr(estimator, "predict_proba")
        or hasattr(estimator, "decision_function")
    )


def _iter_pipeline_steps(pipeline: Any) -> list[tuple[str, Any]]:
    """Return ``(name, estimator)`` pairs, descending into nested pipelines."""
    collected: list[tuple[str, Any]] = []
    for name, estimator in getattr(pipeline, "steps", []):
        if isinstance(estimator, str):
            continue
        collected.append((str(name), estimator))
        if isinstance(estimator, Pipeline):
            collected.extend(_iter_pipeline_steps(estimator))
    return collected


def _detect_components(pipeline: Pipeline) -> tuple[Any, Any, list[str]]:
    """Return ``(vectorizer, classifier, step_names)`` found by *type*."""
    steps = _iter_pipeline_steps(pipeline)
    vectorizer = next((est for _, est in steps if _is_vectorizer(est)), None)
    classifier = next(
        (est for _, est in steps if _is_classifier(est) and not _is_vectorizer(est)), None
    )
    names = [name for name, _ in steps]
    if vectorizer is None:
        raise IncompatibleArtifactError(
            "The saved pipeline has no vectorizer step. A text classification pipeline must "
            f"transform raw strings before the classifier. Steps found: {names}."
        )
    if classifier is None:
        raise IncompatibleArtifactError(
            "The saved pipeline has no classifier step. Steps found: "
            f"{names}."
        )
    return vectorizer, classifier, names


def _require_predict_proba(classifier: Any, source: str) -> None:
    """Fail loudly when the classifier cannot return probabilities."""
    if not callable(getattr(classifier, "predict_proba", None)):
        raise IncompatibleArtifactError(
            f"The classifier '{type(classifier).__name__}' loaded from {source} does not "
            "implement predict_proba(). ResumeForge needs probabilities for the confidence "
            "score. Retrain and export a LogisticRegression (or another probabilistic "
            "classifier); LinearSVC / kernel models without probabilities are not supported."
        )


# --------------------------------------------------------------------------- #
# Metadata
# --------------------------------------------------------------------------- #


def _read_metadata_file(path: Path) -> dict[str, Any]:
    """Read a JSON metadata file, returning ``{}`` when absent or invalid."""
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception as exc:  # unreadable / malformed JSON must not stop startup
        logger.warning(
            "model_metadata_unreadable",
            extra={"metadata_file": path.name, "reason": exc.__class__.__name__},
        )
        return {}
    if isinstance(payload, Mapping):
        return {str(key): value for key, value in payload.items()}
    logger.warning("model_metadata_not_an_object", extra={"metadata_file": path.name})
    return {}


def _discover_metadata(
    settings: SettingsLike, pipeline_path: Path
) -> tuple[dict[str, Any], Path | None]:
    """Load metadata from the configured path, else a sibling ``metadata.json``."""
    configured = resolve_path(settings.MODEL_METADATA_PATH)
    candidates = [configured]
    sibling = pipeline_path.parent / configured.name
    if sibling != configured:
        candidates.append(sibling)
    for candidate in candidates:
        if candidate.is_file():
            return _read_metadata_file(candidate), candidate
    return {}, None


def _metadata_value(metadata: Mapping[str, Any], *keys: str) -> Any | None:
    """Return the first present metadata value among ``keys`` (never invented)."""
    return first_present(metadata, keys)


def _as_ngram_range(value: Any) -> tuple[int, int] | None:
    """Coerce metadata/estimator n-gram ranges into a tuple of two ints."""
    if value is None:
        return None
    if isinstance(value, (list, tuple)) and len(value) == 2:
        try:
            return (int(value[0]), int(value[1]))
        except (TypeError, ValueError):
            return None
    return None


# --------------------------------------------------------------------------- #
# Class names
# --------------------------------------------------------------------------- #


def _resolve_class_names(
    classifier: Any, label_encoder: Any | None, label_encoder_path: Path | None
) -> tuple[list[str], str]:
    """Resolve ordered class labels from the label encoder or the classifier."""
    if label_encoder is not None:
        encoder_classes = getattr(label_encoder, "classes_", None)
        if encoder_classes is not None and len(encoder_classes) > 0:
            return [str(label) for label in encoder_classes], "label_encoder"

    classifier_classes = getattr(classifier, "classes_", None)
    if classifier_classes is not None and len(classifier_classes) > 0:
        return [str(label) for label in classifier_classes], "classifier"

    detail = (
        f" (label encoder at {label_encoder_path} has no classes_)" if label_encoder_path else ""
    )
    raise IncompatibleArtifactError(
        "Could not determine the class names of the artifact"
        f"{detail}. The classifier exposes no usable 'classes_' attribute."
    )


# --------------------------------------------------------------------------- #
# Component attributes
# --------------------------------------------------------------------------- #


def _ngram_range_of(vectorizer: Any, metadata: Mapping[str, Any]) -> tuple[int, int] | None:
    """Return the vectorizer's ``ngram_range`` (metadata only as a fallback)."""
    return _as_ngram_range(getattr(vectorizer, "ngram_range", None)) or _as_ngram_range(
        _metadata_value(metadata, "ngram_range", "vectorizer_ngram_range")
    )


def _vocab_size_of(vectorizer: Any) -> int | None:
    """Return the vocabulary size of the vectorizer, or ``None`` if unknown."""
    vocabulary = getattr(vectorizer, "vocabulary_", None)
    if vocabulary is not None and hasattr(vocabulary, "__len__"):
        try:
            return int(len(vocabulary))
        except TypeError:  # pragma: no cover - defensive
            return None
    get_names = getattr(vectorizer, "get_feature_names_out", None)
    if callable(get_names):
        try:
            return int(len(get_names()))
        except Exception:  # pragma: no cover - defensive
            return None
    return None


def _model_name_from_metadata(
    metadata: Mapping[str, Any], classifier: Any, vectorizer: Any
) -> str:
    """Prefer the recorded model name, else derive it from the loaded types."""
    recorded = _metadata_value(metadata, "model_name", "model", "final_model", "name")
    if isinstance(recorded, str) and recorded.strip():
        return recorded.strip()
    return f"{type(vectorizer).__name__}+{type(classifier).__name__}"


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #


def _joblib_load(path: Path) -> Any:
    """Load a joblib/pickle artifact from a trusted local path."""
    try:
        return joblib.load(path)
    except Exception as exc:  # joblib raises a wide range of errors
        raise ModelLoadError(
            f"Could not load '{path}'. The file may be corrupted or was produced with an "
            f"incompatible library version ({exc.__class__.__name__})."
        ) from exc


def _build_loaded_model(
    *,
    vectorizer: Any,
    classifier: Any,
    transform_fn: Callable[[Sequence[str]], Any],
    model_type: str,
    label_encoder: Any | None,
    label_encoder_path: Path | None,
    metadata: Mapping[str, Any],
    metadata_path: Path | None,
    pipeline_path: Path | None,
    vectorizer_path: Path | None,
    classifier_path: Path | None,
    classifier_source: str,
) -> LoadedModel:
    """Assemble a :class:`LoadedModel` from validated components."""
    _require_predict_proba(classifier, classifier_source)
    class_names, classes_source = _resolve_class_names(
        classifier, label_encoder, label_encoder_path
    )
    ngram_range = _ngram_range_of(vectorizer, metadata)
    trained_sklearn = _metadata_value(
        metadata, "sklearn_version_trained", "sklearn_version", "scikit_learn_version"
    )
    trained_date = _metadata_value(
        metadata, "trained_date", "trained_at", "training_date", "created_at"
    )
    return LoadedModel(
        class_names=class_names,
        model_name=_model_name_from_metadata(metadata, classifier, vectorizer),
        model_type=model_type,
        transform_fn=transform_fn,
        predict_proba_fn=classifier.predict_proba,
        ngram_range=ngram_range,
        vocab_size=_vocab_size_of(vectorizer),
        sklearn_version_trained=str(trained_sklearn) if trained_sklearn else None,
        sklearn_version_runtime=sklearn.__version__,
        classes_source=classes_source,
        pipeline_path=pipeline_path,
        vectorizer_path=vectorizer_path,
        classifier_path=classifier_path,
        label_encoder_path=label_encoder_path,
        metadata_path=metadata_path,
        trained_date=str(trained_date) if trained_date else None,
        metadata=dict(metadata),
    )


def _load_from_pipeline(
    pipeline: Pipeline,
    pipeline_path: Path,
    label_encoder: Any | None,
    label_encoder_path: Path | None,
    metadata: Mapping[str, Any],
    metadata_path: Path | None,
) -> LoadedModel:
    """Layout A: one fitted pipeline containing vectorizer + classifier."""
    vectorizer, classifier, names = _detect_components(pipeline)
    steps = list(pipeline.steps)
    classifier_step_name = next(name for name, est in steps if est is classifier)
    classifier_index = next(index for index, (_, est) in enumerate(steps) if est is classifier)

    if classifier_index == 0:
        raise IncompatibleArtifactError(
            "The saved pipeline's first step is the classifier, so raw text cannot be "
            "transformed. The pipeline must be ordered vectorizer -> classifier."
        )
    if classifier_index != len(steps) - 1:
        logger.warning(
            "pipeline_classifier_not_last_step",
            extra={"pipeline_steps": ",".join(names), "classifier_step": classifier_step_name},
        )

    prefix = Pipeline(steps[:classifier_index])
    return _build_loaded_model(
        vectorizer=vectorizer,
        classifier=classifier,
        transform_fn=prefix.transform,
        model_type="sklearn_pipeline",
        label_encoder=label_encoder,
        label_encoder_path=label_encoder_path,
        metadata=metadata,
        metadata_path=metadata_path,
        pipeline_path=pipeline_path,
        vectorizer_path=None,
        classifier_path=None,
        classifier_source=str(pipeline_path),
    )


def _load_from_parts(
    vectorizer: Any,
    classifier: Any,
    vectorizer_path: Path,
    classifier_path: Path,
    label_encoder: Any | None,
    label_encoder_path: Path | None,
    metadata: Mapping[str, Any],
    metadata_path: Path | None,
) -> LoadedModel:
    """Layout B: separate fitted vectorizer and classifier."""
    if not _is_vectorizer(vectorizer):
        raise IncompatibleArtifactError(
            f"'{vectorizer_path}' is not a fitted vectorizer (it exposes no transform + "
            "vocabulary). Save the fitted TfidfVectorizer or use a full pipeline."
        )
    if not _is_classifier(classifier):
        raise IncompatibleArtifactError(
            f"'{classifier_path}' is not a fitted classifier (it exposes no predict/classes_)."
        )
    return _build_loaded_model(
        vectorizer=vectorizer,
        classifier=classifier,
        transform_fn=vectorizer.transform,
        model_type="vectorizer+classifier",
        label_encoder=label_encoder,
        label_encoder_path=label_encoder_path,
        metadata=metadata,
        metadata_path=metadata_path,
        pipeline_path=None,
        vectorizer_path=vectorizer_path,
        classifier_path=classifier_path,
        classifier_source=str(classifier_path),
    )


def load_model_safe(settings: SettingsLike | None = None) -> LoadedModel | None:
    """Load the model, returning ``None`` instead of raising when unavailable."""
    try:
        return load_model(settings)
    except ModelLoadError as exc:
        logger.error("model_unavailable", extra={"reason": str(exc)})
        return None


def load_model(settings: SettingsLike | None = None) -> LoadedModel:
    """Discover, load and validate the inference artifacts.

    Raises
    ------
    ModelNotFoundError
        No artifact was found; the message lists every path that was checked.
    ModelLoadError / IncompatibleArtifactError
        An artifact was found but cannot be used (unreadable file, missing
        vectorizer/classifier step, no ``predict_proba``, no class names).
    """
    config: SettingsLike = settings if settings is not None else RuntimeConfig.from_env()

    pipeline_path = resolve_path(config.MODEL_PATH)
    vectorizer_path = resolve_path(config.VECTORIZER_PATH)
    classifier_path = resolve_path(config.CLASSIFIER_PATH)
    label_encoder_path = resolve_path(config.LABEL_ENCODER_PATH)

    metadata, metadata_path = _discover_metadata(config, pipeline_path)
    label_encoder = None
    if label_encoder_path.is_file():
        label_encoder = _joblib_load(label_encoder_path)

    if pipeline_path.is_file():
        artifact = _joblib_load(pipeline_path)
        if not isinstance(artifact, Pipeline):
            raise IncompatibleArtifactError(
                f"'{pipeline_path}' is a {type(artifact).__name__}, not a sklearn Pipeline. "
                "Export the fitted Pipeline, or point MODEL_PATH at the pipeline file and "
                "VECTORIZER_PATH/CLASSIFIER_PATH at the separate files."
            )
        model = _load_from_pipeline(
            artifact, pipeline_path, label_encoder, label_encoder_path, metadata, metadata_path
        )
        _warn_on_mismatches(model)
        return model

    has_vectorizer = vectorizer_path.is_file()
    has_classifier = classifier_path.is_file()
    if has_vectorizer and has_classifier:
        model = _load_from_parts(
            _joblib_load(vectorizer_path),
            _joblib_load(classifier_path),
            vectorizer_path,
            classifier_path,
            label_encoder,
            label_encoder_path,
            metadata,
            metadata_path,
        )
        _warn_on_mismatches(model)
        return model

    checked = [pipeline_path, vectorizer_path, classifier_path]
    missing = []
    if not has_vectorizer:
        missing.append(str(vectorizer_path))
    if not has_classifier:
        missing.append(str(classifier_path))
    raise ModelNotFoundError(
        "No model artifacts found. Checked: "
        + ", ".join(str(path) for path in checked)
        + ". Missing: "
        + ", ".join(missing)
        + ". Export the fitted pipeline to MODEL_PATH (or both parts) and restart the API."
    )


def _warn_on_mismatches(model: LoadedModel) -> None:
    """Log warnings (never fatal) for configuration drift."""
    if model.ngram_range is not None and model.ngram_range != EXPECTED_NGRAM_RANGE:
        logger.warning(
            "vectorizer_ngram_range_mismatch",
            extra={
                "expected_ngram_range": str(EXPECTED_NGRAM_RANGE),
                "actual_ngram_range": str(model.ngram_range),
            },
        )
    elif model.ngram_range is None:
        logger.warning("vectorizer_ngram_range_unknown", extra={})

    trained = model.sklearn_version_trained
    if trained and trained != model.sklearn_version_runtime:
        logger.warning(
            "sklearn_version_mismatch",
            extra={
                "sklearn_runtime_version": model.sklearn_version_runtime,
                "sklearn_trained_version": trained,
            },
        )


# --------------------------------------------------------------------------- #
# Self-check
# --------------------------------------------------------------------------- #


def run_self_check(model: LoadedModel) -> None:
    """Verify that the loaded artifact can produce valid probabilities.

    Runs a single synthetic sentence through ``transform`` + ``predict_proba`` and
    asserts that the output is a finite ``(1, n_classes)`` matrix whose rows sum
    to approximately one. Raises :class:`ModelLoadError` when the contract is
    violated, so a broken artifact is detected at startup instead of on the
    first user request.
    """
    try:
        features = model.transform_fn([SELF_CHECK_TEXT])
        raw_probabilities = model.predict_proba_fn(features)
    except Exception as exc:
        raise ModelLoadError(
            "The startup self-check failed while running the model on a synthetic sentence "
            f"({exc.__class__.__name__}: {exc})."
        ) from exc

    probabilities = np.asarray(raw_probabilities, dtype=float)
    if probabilities.ndim != 2 or probabilities.shape[0] != 1:
        raise ModelLoadError(
            "The startup self-check expected predict_proba to return a single row of "
            f"probabilities but got shape {probabilities.shape}."
        )
    if probabilities.shape[1] != len(model.class_names):
        raise ModelLoadError(
            f"The startup self-check found {probabilities.shape[1]} probability columns but "
            f"{len(model.class_names)} class names. The artifact and its label mapping do "
            "not match."
        )
    if not np.all(np.isfinite(probabilities)):
        raise ModelLoadError(
            "The startup self-check produced non-finite probabilities (NaN or infinity)."
        )
    probability_sum = float(probabilities.sum())
    if abs(probability_sum - 1.0) > _PROBABILITY_SUM_TOLERANCE:
        raise ModelLoadError(
            "The startup self-check found probabilities that do not sum to 1 "
            f"(sum={probability_sum:.6f})."
        )

    logger.info(
        "model_self_check_passed",
        extra={
            "model_type": model.model_type,
            "num_classes": model.num_classes,
            "classes_source": model.classes_source,
        },
    )
