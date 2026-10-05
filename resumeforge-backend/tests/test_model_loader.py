"""Tests for :mod:`src.model_loader` (artifact discovery, loading, self-check)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pytest
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from src.config import RuntimeConfig
from src.model_loader import (
    EXPECTED_NGRAM_RANGE,
    IncompatibleArtifactError,
    LoadedModel,
    ModelLoadError,
    ModelNotFoundError,
    load_model,
    load_model_safe,
    run_self_check,
)

_METADATA_NAME = "metadata.json"


def _settings(**overrides: Any) -> RuntimeConfig:
    """Build a :class:`RuntimeConfig` for the synthetic artifacts."""
    values: dict[str, Any] = {
        "MODEL_PATH": "model.joblib",
        "VECTORIZER_PATH": "vectorizer.joblib",
        "CLASSIFIER_PATH": "classifier.joblib",
        "LABEL_ENCODER_PATH": "label_encoder.joblib",
        "MODEL_METADATA_PATH": _METADATA_NAME,
        "MIN_TEXT_CHARS": 10,
        "TOP_K": 3,
    }
    values.update(overrides)
    return RuntimeConfig(values)


def test_pipeline_layout_is_detected(
    model_dir: Path,
    synthetic_classes: tuple[str, ...],
    synthetic_corpus: dict[str, tuple[str, ...]],
) -> None:
    """Layout A: one fitted pipeline with a vectorizer and a classifier step."""
    settings = _settings(MODEL_PATH=str(model_dir / "model.joblib"))
    model = load_model(settings)

    assert model.class_names == list(synthetic_classes)
    assert model.model_type == "sklearn_pipeline"
    assert model.ngram_range == EXPECTED_NGRAM_RANGE == (1, 2)
    assert model.vocab_size and model.vocab_size > 0
    assert model.num_classes == len(synthetic_classes)
    assert model.pipeline_path == model_dir / "model.joblib"
    assert model.classes_source == "classifier"


def test_pipeline_steps_are_detected_by_type_not_by_name(
    tmp_path: Path,
    synthetic_pipeline: Pipeline,
    synthetic_classes: tuple[str, ...],
) -> None:
    """Step names are irrelevant: arbitrary names still load correctly."""
    renamed = Pipeline(
        [
            ("step_zero", synthetic_pipeline.named_steps["tfidf"]),
            ("step_one", synthetic_pipeline.named_steps["clf"]),
        ]
    )
    joblib.dump(renamed, tmp_path / "model.joblib")

    model = load_model(_settings(MODEL_PATH=str(tmp_path / "model.joblib")))

    assert model.class_names == list(synthetic_classes)
    assert model.ngram_range == (1, 2)


def test_transform_reproduces_the_pipeline_output(
    model_dir: Path,
    synthetic_classes: tuple[str, ...],
    synthetic_corpus: dict[str, tuple[str, ...]],
) -> None:
    """``transform`` must equal the pipeline prefix applied to the same text."""
    from joblib import load as joblib_load

    pipeline = joblib_load(model_dir / "model.joblib")
    model = load_model(_settings(MODEL_PATH=str(model_dir / "model.joblib")))
    sample = synthetic_corpus["Data Science"][0]

    expected = pipeline[:-1].transform([sample])
    actual = model.transform_fn([sample])

    assert np.allclose(expected.toarray(), np.asarray(actual.todense()))


def test_separate_files_layout_is_detected(
    part_model_dir: Path,
    synthetic_classes: tuple[str, ...],
) -> None:
    """Layout B: a fitted vectorizer and classifier stored as two files."""
    settings = _settings(
        MODEL_PATH=str(part_model_dir / "missing_pipeline.joblib"),
        VECTORIZER_PATH=str(part_model_dir / "vectorizer.joblib"),
        CLASSIFIER_PATH=str(part_model_dir / "classifier.joblib"),
    )
    model = load_model(settings)

    assert model.class_names == list(synthetic_classes)
    assert model.model_type == "vectorizer+classifier"
    assert model.vectorizer_path == part_model_dir / "vectorizer.joblib"
    assert model.classifier_path == part_model_dir / "classifier.joblib"


def test_label_encoder_supplies_the_class_names(
    encoder_model_dir: Path,
    synthetic_classes: tuple[str, ...],
) -> None:
    """Layout C: when the classifier predicts indices, the encoder names them."""
    settings = _settings(
        MODEL_PATH=str(encoder_model_dir / "missing_pipeline.joblib"),
        VECTORIZER_PATH=str(encoder_model_dir / "vectorizer.joblib"),
        CLASSIFIER_PATH=str(encoder_model_dir / "classifier.joblib"),
        LABEL_ENCODER_PATH=str(encoder_model_dir / "label_encoder.joblib"),
    )
    model = load_model(settings)

    assert model.classes_source == "label_encoder"
    assert model.class_names == list(synthetic_classes)


def test_metadata_is_read_when_present(model_dir: Path) -> None:
    """Metadata values are surfaced, never invented."""
    model = load_model(_settings(MODEL_PATH=str(model_dir / "model.joblib")))

    assert model.metadata_path == model_dir / _METADATA_NAME
    assert model.model_name == "SyntheticFixturePipeline"
    assert model.trained_date == "2026-01-01"
    assert model.sklearn_version_trained == sklearn.__version__
    assert model.sklearn_version_runtime == sklearn.__version__


def test_metadata_fields_are_null_when_absent(part_model_dir: Path) -> None:
    """Missing metadata yields ``None``, never a placeholder value."""
    settings = _settings(
        MODEL_PATH=str(part_model_dir / "missing_pipeline.joblib"),
        VECTORIZER_PATH=str(part_model_dir / "vectorizer.joblib"),
        CLASSIFIER_PATH=str(part_model_dir / "classifier.joblib"),
        LABEL_ENCODER_PATH=str(part_model_dir / "absent_encoder.joblib"),
        MODEL_METADATA_PATH=str(part_model_dir / "absent.json"),
    )
    model = load_model(settings)

    assert model.metadata_path is None
    assert model.sklearn_version_trained is None
    assert model.trained_date is None
    assert model.metadata == {}
    # Derived from the loaded estimator types - factual, not invented.
    assert model.model_name == "TfidfVectorizer+LogisticRegression"


def test_missing_artifacts_raise_with_every_checked_path(tmp_path: Path) -> None:
    """``ModelNotFoundError`` lists all inspected locations."""
    settings = _settings(
        MODEL_PATH=str(tmp_path / "model.joblib"),
        VECTORIZER_PATH=str(tmp_path / "vectorizer.joblib"),
        CLASSIFIER_PATH=str(tmp_path / "classifier.joblib"),
    )

    with pytest.raises(ModelNotFoundError) as error:
        load_model(settings)

    message = str(error.value)
    assert "model.joblib" in message
    assert "vectorizer.joblib" in message
    assert "classifier.joblib" in message


def test_partial_separate_files_raise(tmp_path: Path, synthetic_pipeline: Pipeline) -> None:
    """A vectorizer without a classifier is not enough to serve predictions."""
    joblib.dump(synthetic_pipeline.named_steps["tfidf"], tmp_path / "vectorizer.joblib")
    settings = _settings(
        MODEL_PATH=str(tmp_path / "model.joblib"),
        VECTORIZER_PATH=str(tmp_path / "vectorizer.joblib"),
        CLASSIFIER_PATH=str(tmp_path / "classifier.joblib"),
    )

    with pytest.raises(ModelNotFoundError):
        load_model(settings)


def test_classifier_without_predict_proba_is_rejected(
    tmp_path: Path,
    synthetic_pipeline: Pipeline,
    synthetic_corpus: dict[str, tuple[str, ...]],
) -> None:
    """LinearSVC-style artifacts cannot produce confidence scores."""
    texts = [sentence for sentences in synthetic_corpus.values() for sentence in sentences]
    labels = [
        label
        for label, sentences in synthetic_corpus.items()
        for _ in sentences
    ]
    pipeline = Pipeline(
        [("tfidf", TfidfVectorizer(ngram_range=(1, 2))), ("svc", LinearSVC())]
    ).fit(texts, labels)
    joblib.dump(pipeline, tmp_path / "model.joblib")

    with pytest.raises(IncompatibleArtifactError) as error:
        load_model(_settings(MODEL_PATH=str(tmp_path / "model.joblib")))

    assert "predict_proba" in str(error.value)


def test_unexpected_artifact_type_is_rejected(tmp_path: Path) -> None:
    """A joblib file that is not a pipeline fails with an actionable message."""
    joblib.dump(["not", "a", "pipeline"], tmp_path / "model.joblib")

    with pytest.raises(IncompatibleArtifactError) as error:
        load_model(_settings(MODEL_PATH=str(tmp_path / "model.joblib")))

    assert "Pipeline" in str(error.value)


def test_corrupted_artifact_is_reported(tmp_path: Path) -> None:
    """A truncated file raises ``ModelLoadError`` instead of crashing later."""
    (tmp_path / "model.joblib").write_bytes(b"\x00\x01not-a-joblib-file")

    with pytest.raises(ModelLoadError):
        load_model(_settings(MODEL_PATH=str(tmp_path / "model.joblib")))


def test_unexpected_ngram_range_is_reported_but_not_fatal(
    tmp_path: Path,
    synthetic_pipeline: Pipeline,
    synthetic_corpus: dict[str, tuple[str, ...]],
) -> None:
    """A (1, 1) vectorizer loads; the drift is only warned about."""
    vectorizer = TfidfVectorizer(ngram_range=(1, 1))
    texts = [sentence for sentences in synthetic_corpus.values() for sentence in sentences]
    labels = [
        label
        for label, sentences in synthetic_corpus.items()
        for _ in sentences
    ]
    classifier = LogisticRegression(max_iter=1000, random_state=0).fit(
        vectorizer.fit_transform(texts), labels
    )
    joblib.dump(
        Pipeline([("tfidf", vectorizer), ("clf", classifier)]), tmp_path / "model.joblib"
    )

    model = load_model(_settings(MODEL_PATH=str(tmp_path / "model.joblib")))

    assert model.ngram_range == (1, 1)
    run_self_check(model)


def test_self_check_accepts_a_valid_model(model_dir: Path) -> None:
    """The startup self-check passes for a healthy artifact."""
    model = load_model(_settings(MODEL_PATH=str(model_dir / "model.joblib")))

    run_self_check(model)  # does not raise


def test_self_check_detects_misaligned_class_names(
    model_dir: Path,
    synthetic_classes: tuple[str, ...],
) -> None:
    """Too many class names for the probability vector is an error."""
    loaded = load_model(_settings(MODEL_PATH=str(model_dir / "model.joblib")))
    broken = LoadedModel(
        class_names=loaded.class_names + ["Ghost Class"],
        model_name=loaded.model_name,
        model_type=loaded.model_type,
        transform_fn=loaded.transform_fn,
        predict_proba_fn=loaded.predict_proba_fn,
    )

    with pytest.raises(ModelLoadError) as error:
        run_self_check(broken)

    assert "class names" in str(error.value)


def test_self_check_detects_a_broken_transform(
    model_dir: Path,
    synthetic_classes: tuple[str, ...],
) -> None:
    """A transform that raises is reported as a load error, not a 500 later."""
    loaded = load_model(_settings(MODEL_PATH=str(model_dir / "model.joblib")))

    def _explode(_: list[str]) -> Any:
        raise ValueError("synthetic failure")

    broken = LoadedModel(
        class_names=loaded.class_names,
        model_name=loaded.model_name,
        model_type=loaded.model_type,
        transform_fn=_explode,
        predict_proba_fn=loaded.predict_proba_fn,
    )

    with pytest.raises(ModelLoadError):
        run_self_check(broken)


def test_load_model_safe_returns_none_instead_of_raising(tmp_path: Path) -> None:
    """The API startup path must survive a missing artifact."""
    assert (
        load_model_safe(
            _settings(
                MODEL_PATH=str(tmp_path / "model.joblib"),
                VECTORIZER_PATH=str(tmp_path / "vectorizer.joblib"),
                CLASSIFIER_PATH=str(tmp_path / "classifier.joblib"),
            )
        )
        is None
    )
