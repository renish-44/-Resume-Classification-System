"""Resume classification facade: :class:`ResumeClassifier` plus a small CLI.

Inference flow (identical for every entry point)
------------------------------------------------
1. validate the text length (``MIN_TEXT_CHARS`` / ``MAX_TEXT_CHARS``),
2. clean it with :func:`src.preprocessing.clean_text` when external
   preprocessing is enabled,
3. ``transform`` -> ``predict_proba``,
4. sort the probability vector, map the indices to the **model's own class
   names** and return the top-k alternatives.

Confidence caveat
-----------------
``confidence`` is the maximum predicted probability of a **multinomial Logistic
Regression** model. Those probabilities are only *roughly* calibrated: they are
useful for ranking candidates, but they are not true posteriors and must not be
read as "the model is N% correct". Keep a human in the loop.

CLI
---
.. code-block:: console

   python -m src.predict --text "data scientist with python and sql skills"
   python -m src.predict --file resume.pdf --top-k 5
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import numpy as np

from src.config import (
    MAX_BATCH_ITEMS,
    MAX_TOP_K,
    MIN_TOP_K,
    RuntimeConfig,
    SettingsLike,
    max_upload_bytes,
)
from src.model_loader import (
    LoadedModel,
    ModelLoadError,
    ModelNotFoundError,
    load_model,
    run_self_check,
)
from src.preprocessing import get_cleaner
from src.text_extraction import TextExtractionError, extract_text
from src.utils import configure_logging

__all__ = [
    "BatchTooLargeError",
    "InputTooLongError",
    "InputTooShortError",
    "ModelNotLoadedError",
    "PredictionError",
    "PredictionResult",
    "ResumeClassifier",
    "TopPrediction",
    "clear_classifier_cache",
    "get_classifier",
    "main",
]

logger = logging.getLogger(__name__)

_PROBABILITY_DECIMALS: Final[int] = 4
_PROBABILITY_EPSILON: Final[float] = 1e-12


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class PredictionError(RuntimeError):
    """Base class for all prediction-time failures."""


class ModelNotLoadedError(PredictionError):
    """Raised when no usable model is available for inference."""


class InputTooShortError(PredictionError):
    """Raised when the supplied text is shorter than ``MIN_TEXT_CHARS``."""


class InputTooLongError(PredictionError):
    """Raised when the supplied text is longer than ``MAX_TEXT_CHARS``."""


class BatchTooLargeError(PredictionError):
    """Raised when a batch request contains more items than allowed."""


# --------------------------------------------------------------------------- #
# Results
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class TopPrediction:
    """One entry of the ranked category list."""

    category: str
    probability: float

    def to_dict(self) -> dict[str, Any]:
        """Return the API representation of the entry."""
        return {"category": self.category, "probability": self.probability}


@dataclass(frozen=True)
class PredictionResult:
    """The full prediction payload returned by the API and the CLI."""

    predicted_category: str
    confidence: float
    top_predictions: list[TopPrediction]
    model: str
    extracted_chars: int
    low_confidence: bool

    def to_dict(self) -> dict[str, Any]:
        """Return the JSON-serialisable API payload."""
        return {
            "predicted_category": self.predicted_category,
            "confidence": self.confidence,
            "top_predictions": [item.to_dict() for item in self.top_predictions],
            "model": self.model,
            "extracted_chars": self.extracted_chars,
            "low_confidence": self.low_confidence,
        }


# --------------------------------------------------------------------------- #
# Classifier
# --------------------------------------------------------------------------- #


class ResumeClassifier:
    """Loads the artifacts once and turns resume text into ranked categories."""

    def __init__(
        self,
        settings: SettingsLike | None = None,
        *,
        model: LoadedModel | None = None,
        verify: bool = True,
    ) -> None:
        """Create a classifier.

        Parameters
        ----------
        settings:
            Configuration object (``api.settings.Settings`` in the API, or
            :class:`src.config.RuntimeConfig` for standalone use). Defaults to
            the environment configuration.
        model:
            Pre-loaded artifact, mainly used by the tests to inject a synthetic
            model.
        verify:
            Run the startup self-check (probabilities sum to 1, column count
            matches the class names).
        """
        self._settings: SettingsLike = (
            settings if settings is not None else RuntimeConfig.from_env()
        )
        self._cleaner = get_cleaner(bool(self._settings.APPLY_EXTERNAL_PREPROCESSING))
        self._min_chars = int(self._settings.MIN_TEXT_CHARS)
        self._max_chars = int(self._settings.MAX_TEXT_CHARS)
        self._top_k = int(self._settings.TOP_K)
        self._threshold = float(self._settings.CONFIDENCE_THRESHOLD)

        if model is not None:
            self._model = model
        else:
            try:
                self._model = load_model(self._settings)
            except ModelNotFoundError as exc:
                raise ModelNotLoadedError(str(exc)) from exc
            except ModelLoadError as exc:
                raise ModelNotLoadedError(f"The model artifact could not be loaded: {exc}") from exc

        if verify:
            try:
                run_self_check(self._model)
            except ModelLoadError as exc:
                raise ModelNotLoadedError(str(exc)) from exc

    # ------------------------------------------------------------------ #
    # Introspection
    # ------------------------------------------------------------------ #

    @property
    def model(self) -> LoadedModel:
        """The loaded artifact."""
        return self._model

    @property
    def class_names(self) -> list[str]:
        """Ordered class labels reported by the artifact."""
        return list(self._model.class_names)

    @property
    def model_name(self) -> str:
        """Human readable model name (metadata, or derived from the types)."""
        return self._model.model_name

    # ------------------------------------------------------------------ #
    # Prediction
    # ------------------------------------------------------------------ #

    def _validate_text(self, text: object) -> str:
        """Validate the raw text and return it unchanged."""
        if text is None:
            raise InputTooShortError(
                f"No text was provided. Send at least {self._min_chars} characters."
            )
        if not isinstance(text, str):
            text = str(text)
        if not text.strip():
            raise InputTooShortError("The provided text is empty.")
        if len(text) > self._max_chars:
            raise InputTooLongError(
                f"The provided text has {len(text)} characters, which exceeds the "
                f"{self._max_chars} character limit."
            )
        if len(text.strip()) < self._min_chars:
            raise InputTooShortError(
                f"The provided text has {len(text.strip())} characters; at least "
                f"{self._min_chars} are required for a reliable prediction."
            )
        return text

    def _resolve_top_k(self, top_k: int | None) -> int:
        """Clamp ``top_k`` into ``[MIN_TOP_K, MAX_TOP_K]`` and the class count."""
        requested = self._top_k if top_k is None else int(top_k)
        requested = max(MIN_TOP_K, min(MAX_TOP_K, requested))
        return max(1, min(requested, len(self._model.class_names)))

    def _probabilities(self, text: str) -> np.ndarray:
        """Clean, transform and score ``text``; return a 1-D probability vector."""
        cleaned = self._cleaner(text)
        if not cleaned.strip():
            raise InputTooShortError(
                "The text became empty after preprocessing; nothing to classify."
            )
        features = self._model.transform_fn([cleaned])
        probabilities = np.asarray(self._model.predict_proba_fn(features), dtype=float)
        if probabilities.ndim == 2:
            if probabilities.shape[0] != 1:
                raise ModelNotLoadedError(
                    "The model returned an unexpected number of prediction rows "
                    f"({probabilities.shape[0]})."
                )
            probabilities = probabilities[0]
        if probabilities.size != len(self._model.class_names):
            raise ModelNotLoadedError(
                f"The model returned {probabilities.size} probabilities but "
                f"{len(self._model.class_names)} classes are known. The artifact and its "
                "label mapping are inconsistent."
            )
        probabilities = np.clip(probabilities, 0.0, None)
        total = float(probabilities.sum())
        if total <= _PROBABILITY_EPSILON:
            probabilities = np.full_like(probabilities, 1.0 / probabilities.size)
        else:
            probabilities = probabilities / total
        return probabilities

    def predict(self, text: str, top_k: int | None = None) -> PredictionResult:
        """Classify ``text`` and return the ranked prediction payload.

        Parameters
        ----------
        text:
            Raw resume text (already extracted when it comes from a document).
        top_k:
            Number of ranked alternatives; defaults to ``TOP_K`` and is clamped
            to ``[1, 10]``.

        Raises
        ------
        InputTooShortError, InputTooLongError, ModelNotLoadedError
        """
        raw_text = self._validate_text(text)
        probabilities = self._probabilities(raw_text)
        order = np.argsort(-probabilities, kind="stable")

        limit = self._resolve_top_k(top_k)
        ranked = [
            TopPrediction(
                category=self._model.class_names[int(index)],
                probability=round(float(probabilities[int(index)]), _PROBABILITY_DECIMALS),
            )
            for index in order[:limit]
        ]
        best = ranked[0]
        return PredictionResult(
            predicted_category=best.category,
            confidence=best.probability,
            top_predictions=ranked,
            model=self._model.model_name,
            extracted_chars=len(raw_text),
            low_confidence=best.probability < self._threshold,
        )

    def predict_batch(self, texts: Sequence[str]) -> list[PredictionResult]:
        """Classify several texts (internal use and tests).

        Raises
        ------
        BatchTooLargeError
            More than 20 items were supplied.
        InputTooShortError / InputTooLongError / ModelNotLoadedError
            Same contract as :meth:`predict`, applied per item.
        """
        items = list(texts or [])
        if not items:
            raise InputTooShortError("No texts were provided.")
        if len(items) > MAX_BATCH_ITEMS:
            raise BatchTooLargeError(
                f"A batch may contain at most {MAX_BATCH_ITEMS} texts, got {len(items)}."
            )
        return [self.predict(text) for text in items]


# --------------------------------------------------------------------------- #
# Process-wide cache (the model is loaded once per process)
# --------------------------------------------------------------------------- #

_CLASSIFIER_CACHE: dict[tuple[Any, ...], ResumeClassifier] = {}


def _cache_key(settings: SettingsLike) -> tuple[Any, ...]:
    """Build the cache key identifying one artifact configuration."""
    return (
        str(settings.MODEL_PATH),
        str(settings.VECTORIZER_PATH),
        str(settings.CLASSIFIER_PATH),
        str(settings.LABEL_ENCODER_PATH),
        str(settings.MODEL_METADATA_PATH),
        bool(settings.APPLY_EXTERNAL_PREPROCESSING),
        int(settings.MIN_TEXT_CHARS),
        int(settings.MAX_TEXT_CHARS),
        int(settings.TOP_K),
        float(settings.CONFIDENCE_THRESHOLD),
    )


def get_classifier(settings: SettingsLike | None = None) -> ResumeClassifier:
    """Return the process-wide classifier, loading it on first use."""
    resolved: SettingsLike = settings if settings is not None else RuntimeConfig.from_env()
    key = _cache_key(resolved)
    cached = _CLASSIFIER_CACHE.get(key)
    if cached is not None:
        return cached
    classifier = ResumeClassifier(resolved)
    _CLASSIFIER_CACHE[key] = classifier
    logger.debug(
        "classifier_loaded",
        extra={"model_name": classifier.model_name, "num_classes": len(classifier.class_names)},
    )
    return classifier


def clear_classifier_cache() -> None:
    """Drop every cached classifier (used by the tests and by reload flows)."""
    _CLASSIFIER_CACHE.clear()


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def _build_parser() -> argparse.ArgumentParser:
    """Build the command line parser for ``python -m src.predict``."""
    parser = argparse.ArgumentParser(
        prog="python -m src.predict",
        description="Classify resume text or a resume file with the saved model.",
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--text", help="Resume text to classify.")
    source.add_argument(
        "--file",
        type=Path,
        help="Path to a local .pdf, .docx or .txt resume to classify.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        metavar="N",
        help=f"Number of ranked categories to return (1-{MAX_TOP_K}).",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Skip clean_text (use when the saved pipeline preprocesses internally).",
    )
    parser.add_argument(
        "--log-level",
        default="WARNING",
        help="Logging level for the CLI run (default: WARNING).",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point. Returns ``0`` on success, ``1`` on any handled error."""
    args = _build_parser().parse_args(argv)
    configure_logging(args.log_level)

    settings: SettingsLike = RuntimeConfig.from_env()
    if args.no_clean:
        settings = RuntimeConfig(APPLY_EXTERNAL_PREPROCESSING=False)

    try:
        classifier = get_classifier(settings)
        if args.text is not None:
            text = args.text
        else:
            file_path: Path = args.file
            file_bytes = file_path.read_bytes()
            text = extract_text(
                file_bytes,
                file_path.name,
                max_bytes=max_upload_bytes(settings),
            )
        result = classifier.predict(text, top_k=args.top_k)
    except (PredictionError, ModelLoadError, TextExtractionError) as exc:
        print(json.dumps({"error": str(exc)}, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1
    except OSError as exc:
        print(json.dumps({"error": f"Could not read the input: {exc}"}, indent=2), file=sys.stderr)
        return 1

    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI wrapper
    raise SystemExit(main())
