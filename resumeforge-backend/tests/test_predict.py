"""Tests for :class:`src.predict.ResumeClassifier` and its CLI."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from src.config import RuntimeConfig
from src.predict import (
    BatchTooLargeError,
    InputTooLongError,
    InputTooShortError,
    ModelNotLoadedError,
    ResumeClassifier,
    clear_classifier_cache,
    get_classifier,
    main,
)
from tests.conftest import OTHER_RESUME_TEXT, SAMPLE_RESUME_TEXT

_EXPECTED_KEYS = {
    "predicted_category",
    "confidence",
    "top_predictions",
    "model",
    "extracted_chars",
    "low_confidence",
}


@pytest.fixture
def classifier(settings_factory: Callable[..., Any]) -> ResumeClassifier:
    """A classifier bound to the synthetic artifacts."""
    return ResumeClassifier(settings_factory())


def _settings_factory(**overrides: Any) -> Callable[..., RuntimeConfig]:
    """Return a factory for :class:`RuntimeConfig` (module artifacts only)."""
    values: dict[str, Any] = {
        "MODEL_PATH": "model.joblib",
        "MIN_TEXT_CHARS": 50,
        "TOP_K": 3,
        "CONFIDENCE_THRESHOLD": 0.5,
    }
    values.update(overrides)

    def _factory(**more: Any) -> RuntimeConfig:
        merged = dict(values)
        merged.update(more)
        return RuntimeConfig(merged)

    return _factory


# --------------------------------------------------------------------------- #
# Schema and probability contract
# --------------------------------------------------------------------------- #


def test_prediction_result_schema(classifier: ResumeClassifier) -> None:
    """The payload contains exactly the documented keys and types."""
    payload = classifier.predict(SAMPLE_RESUME_TEXT).to_dict()

    assert set(payload) == _EXPECTED_KEYS
    assert isinstance(payload["predicted_category"], str)
    assert payload["predicted_category"] in classifier.class_names
    assert isinstance(payload["confidence"], float)
    assert 0.0 <= payload["confidence"] <= 1.0
    assert isinstance(payload["extracted_chars"], int)
    assert payload["extracted_chars"] == len(SAMPLE_RESUME_TEXT)
    assert isinstance(payload["low_confidence"], bool)
    assert payload["model"] == "SyntheticFixturePipeline"


def test_confidence_is_rounded_to_four_decimals(classifier: ResumeClassifier) -> None:
    """Probabilities are rounded, never truncated to three decimals."""
    result = classifier.predict(SAMPLE_RESUME_TEXT)

    assert result.confidence == round(result.confidence, 4)
    for item in result.top_predictions:
        assert item.probability == round(item.probability, 4)


def test_top_predictions_are_sorted_and_normalised(classifier: ResumeClassifier) -> None:
    """Probabilities descend and the full distribution sums to one."""
    result = classifier.predict(SAMPLE_RESUME_TEXT)
    probabilities = [item.probability for item in result.top_predictions]

    assert probabilities == sorted(probabilities, reverse=True)
    assert result.top_predictions[0].category == result.predicted_category
    assert result.confidence == probabilities[0]

    total = 0.0
    for text in (SAMPLE_RESUME_TEXT, OTHER_RESUME_TEXT):
        features = classifier.model.transform_fn([text])
        raw = classifier.model.predict_proba_fn(features)[0]
        total = float(sum(raw))
        assert 0.99 <= total <= 1.01


def test_top_k_is_respected(classifier: ResumeClassifier) -> None:
    """``top_k`` controls the length of the ranked list."""
    assert len(classifier.predict(SAMPLE_RESUME_TEXT, top_k=1).top_predictions) == 1
    assert len(classifier.predict(SAMPLE_RESUME_TEXT, top_k=2).top_predictions) == 2
    assert len(classifier.predict(SAMPLE_RESUME_TEXT, top_k=3).top_predictions) == 3


def test_top_k_is_clamped_to_the_class_count(classifier: ResumeClassifier) -> None:
    """Asking for more categories than exist returns them all, nothing more."""
    result = classifier.predict(SAMPLE_RESUME_TEXT, top_k=10)

    assert len(result.top_predictions) == len(classifier.class_names) == 3


def test_top_k_defaults_to_the_configured_value(
    settings_factory: Callable[..., Any],
) -> None:
    """``TOP_K`` from the settings is used when no explicit value is given."""
    classifier = ResumeClassifier(settings_factory(TOP_K=1))

    assert len(classifier.predict(SAMPLE_RESUME_TEXT).top_predictions) == 1


def test_low_confidence_flag_follows_the_threshold(
    settings_factory: Callable[..., Any],
) -> None:
    """``low_confidence`` is ``True`` below the configured threshold."""
    never = ResumeClassifier(settings_factory(CONFIDENCE_THRESHOLD=0.0))
    always = ResumeClassifier(settings_factory(CONFIDENCE_THRESHOLD=1.0))

    assert never.predict(SAMPLE_RESUME_TEXT).low_confidence is False
    assert always.predict(SAMPLE_RESUME_TEXT).low_confidence is True


def test_class_names_come_from_the_artifact(
    classifier: ResumeClassifier, synthetic_classes: tuple[str, ...]
) -> None:
    """Never hard-coded categories: they are read from the model."""
    assert classifier.class_names == list(synthetic_classes)


# --------------------------------------------------------------------------- #
# Input validation
# --------------------------------------------------------------------------- #


def test_empty_text_is_rejected(classifier: ResumeClassifier) -> None:
    """Empty and whitespace-only input raise :class:`InputTooShortError`."""
    for value in ("", "   \n\t "):
        with pytest.raises(InputTooShortError):
            classifier.predict(value)


def test_short_text_is_rejected(classifier: ResumeClassifier) -> None:
    """Text below ``MIN_TEXT_CHARS`` is refused before inference."""
    with pytest.raises(InputTooShortError) as error:
        classifier.predict("data scientist")

    assert "50" in str(error.value)


def test_long_text_is_rejected(settings_factory: Callable[..., Any]) -> None:
    """Text above ``MAX_TEXT_CHARS`` is refused with a precise message."""
    classifier = ResumeClassifier(settings_factory(MAX_TEXT_CHARS=200))

    with pytest.raises(InputTooLongError) as error:
        classifier.predict("data scientist " * 100)

    assert "200" in str(error.value)


def test_none_input_is_rejected(classifier: ResumeClassifier) -> None:
    """``None`` produces the same friendly error as an empty string."""
    with pytest.raises(InputTooShortError):
        classifier.predict(None)  # type: ignore[arg-type]


def test_model_not_loaded_error(tmp_path: Path) -> None:
    """Missing artifacts surface as :class:`ModelNotLoadedError`."""
    empty = tmp_path / "empty"
    empty.mkdir()

    with pytest.raises(ModelNotLoadedError):
        ResumeClassifier(
            _settings_factory(MODEL_PATH=str(empty / "model.joblib"))()
        )


def test_external_preprocessing_can_be_disabled(
    settings_factory: Callable[..., Any],
) -> None:
    """With external cleaning off, the pipeline receives the raw text."""
    classifier = ResumeClassifier(settings_factory(APPLY_EXTERNAL_PREPROCESSING=False))
    result = classifier.predict(SAMPLE_RESUME_TEXT.upper())

    assert result.predicted_category in classifier.class_names
    assert result.extracted_chars == len(SAMPLE_RESUME_TEXT)


def test_text_that_becomes_empty_after_cleaning(
    settings_factory: Callable[..., Any],
) -> None:
    """Input made of stop-characters only is refused, not sent to the model."""
    classifier = ResumeClassifier(settings_factory())

    with pytest.raises(InputTooShortError):
        classifier.predict("!" * 60)


# --------------------------------------------------------------------------- #
# Batch
# --------------------------------------------------------------------------- #


def test_predict_batch_returns_one_result_per_text(classifier: ResumeClassifier) -> None:
    """Batch prediction mirrors the single-item contract."""
    texts = [SAMPLE_RESUME_TEXT, OTHER_RESUME_TEXT]
    results = classifier.predict_batch(texts)

    assert len(results) == 2
    assert [result.extracted_chars for result in results] == [len(text) for text in texts]
    assert all(set(result.to_dict()) == _EXPECTED_KEYS for result in results)


def test_predict_batch_rejects_too_many_items(classifier: ResumeClassifier) -> None:
    """The batch size is capped at 20 items."""
    with pytest.raises(BatchTooLargeError):
        classifier.predict_batch([SAMPLE_RESUME_TEXT] * 21)


def test_predict_batch_rejects_empty_input(classifier: ResumeClassifier) -> None:
    """An empty batch is an error, not an empty result list."""
    with pytest.raises(InputTooShortError):
        classifier.predict_batch([])


# --------------------------------------------------------------------------- #
# Cache and CLI
# --------------------------------------------------------------------------- #


def test_get_classifier_caches_the_model(settings_factory: Callable[..., Any]) -> None:
    """The artifact is loaded once per configuration."""
    settings = settings_factory()

    first = get_classifier(settings)
    second = get_classifier(settings)

    assert first is second
    clear_classifier_cache()
    assert get_classifier(settings) is not first


def test_cli_prints_json_and_exits_zero(
    synthetic_env: None, capsys: pytest.CaptureFixture[str]
) -> None:
    """``python -m src.predict --text ...`` prints the API payload."""
    clear_classifier_cache()

    exit_code = main(["--text", SAMPLE_RESUME_TEXT, "--log-level", "CRITICAL"])
    captured = capsys.readouterr()

    assert exit_code == 0
    payload = json.loads(captured.out)
    assert set(payload) == _EXPECTED_KEYS
    assert payload["predicted_category"]


def test_cli_reports_errors_and_exits_nonzero(
    synthetic_env: None, capsys: pytest.CaptureFixture[str]
) -> None:
    """A too-short input yields exit code 1 and a JSON error on stderr."""
    clear_classifier_cache()

    exit_code = main(["--text", "hi", "--log-level", "CRITICAL"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert json.loads(captured.err)["error"]


def test_cli_classifies_a_file(
    synthetic_env: None,
    sample_pdf: bytes,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The ``--file`` branch extracts the PDF text and classifies it."""
    clear_classifier_cache()
    pdf_path = tmp_path / "resume.pdf"
    pdf_path.write_bytes(sample_pdf)

    exit_code = main(["--file", str(pdf_path), "--log-level", "CRITICAL"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert json.loads(captured.out)["predicted_category"]
