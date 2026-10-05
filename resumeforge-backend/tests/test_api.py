"""End-to-end API tests using FastAPI's ``TestClient``.

Every test runs against the synthetic artifacts created in ``conftest.py``; no
test depends on the teammate's real model and no real resume content is used.
"""

from __future__ import annotations

import io
import json
import logging
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.main import create_app
from src.config import RESPONSIBLE_AI_NOTICE
from src.utils import configure_logging
from tests.conftest import OTHER_RESUME_TEXT, SAMPLE_RESUME_TEXT

_ERROR_KEYS = {"error", "code", "request_id"}
_PREDICTION_KEYS = {
    "predicted_category",
    "confidence",
    "top_predictions",
    "model",
    "extracted_chars",
    "low_confidence",
}
_DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


@pytest.fixture
def make_client(
    settings_factory: Callable[..., Any],
) -> Callable[..., Iterator[TestClient]]:
    """Return a factory building clients with custom settings."""

    def _factory(**overrides: Any) -> Iterator[TestClient]:
        with TestClient(create_app(settings_factory(**overrides))) as test_client:
            yield test_client

    return _factory


def _multipart(
    parts: list[tuple[str, str | None, bytes]],
    boundary: str = "----resumeforgetestboundary",
) -> tuple[bytes, dict[str, str]]:
    """Build a ``multipart/form-data`` body from ``(name, filename, value)``."""
    chunks: list[bytes] = []
    for name, filename, value in parts:
        disposition = f'form-data; name="{name}"'
        if filename is not None:
            disposition += f'; filename="{filename}"'
        header = f"--{boundary}\r\nContent-Disposition: {disposition}\r\n"
        if filename is not None:
            header += "Content-Type: application/octet-stream\r\n"
        header += "\r\n"
        chunks.append(header.encode("latin-1") + value + b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("latin-1"))
    body = b"".join(chunks)
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


# --------------------------------------------------------------------------- #
# System endpoints
# --------------------------------------------------------------------------- #


def test_health_reports_the_loaded_model(client: TestClient) -> None:
    """``/health`` stays ``ok`` and reports the artifact state."""
    payload = client.get("/health").json()

    assert payload["status"] == "ok"
    assert payload["model_loaded"] is True
    assert payload["model_name"] == "SyntheticFixturePipeline"
    assert payload["version"]


def test_health_without_a_model(unloaded_client: TestClient) -> None:
    """A missing artifact does not crash the service."""
    payload = unloaded_client.get("/health").json()

    assert payload["status"] == "ok"
    assert payload["model_loaded"] is False
    assert payload["model_name"] is None


def test_classes_lists_the_model_labels(
    client: TestClient, synthetic_classes: tuple[str, ...]
) -> None:
    """Class names come from the artifact, in the model's own order."""
    payload = client.get("/classes").json()

    assert payload["classes"] == list(synthetic_classes)
    assert payload["count"] == len(synthetic_classes)


def test_classes_requires_a_loaded_model(unloaded_client: TestClient) -> None:
    """``/classes`` answers 503 with the standard envelope."""
    response = unloaded_client.get("/classes")

    assert response.status_code == 503
    body = response.json()
    assert set(body) == _ERROR_KEYS
    assert body["code"] == "MODEL_NOT_LOADED"


def test_model_info_reports_artifact_metadata(client: TestClient) -> None:
    """Known values are reported; nothing is invented."""
    import sklearn

    payload = client.get("/model-info").json()

    assert payload["model_name"] == "SyntheticFixturePipeline"
    assert payload["model_type"] == "sklearn_pipeline"
    assert payload["ngram_range"] == [1, 2]
    assert payload["num_classes"] == 3
    assert payload["vocab_size"] > 0
    assert payload["preprocessing_version"] == "default-v1"
    assert payload["sklearn_runtime_version"] == sklearn.__version__
    assert payload["sklearn_trained_version"] == sklearn.__version__
    assert payload["trained_date"] == "2026-01-01"
    assert payload["confidence_threshold"] == 0.5


def test_model_info_returns_null_for_unknown_values(
    make_client: Callable[..., Iterator[TestClient]], part_model_dir: Path
) -> None:
    """Without a metadata file the unknown fields are ``null``, not invented."""
    client = next(
        make_client(
            MODEL_PATH=str(part_model_dir / "missing_pipeline.joblib"),
            VECTORIZER_PATH=str(part_model_dir / "vectorizer.joblib"),
            CLASSIFIER_PATH=str(part_model_dir / "classifier.joblib"),
            LABEL_ENCODER_PATH=str(part_model_dir / "absent_encoder.joblib"),
            MODEL_METADATA_PATH=str(part_model_dir / "absent.json"),
        )
    )

    payload = client.get("/model-info").json()

    assert payload["sklearn_trained_version"] is None
    assert payload["trained_date"] is None
    assert payload["model_name"] == "TfidfVectorizer+LogisticRegression"
    assert payload["ngram_range"] == [1, 2]


def test_model_info_requires_a_loaded_model(unloaded_client: TestClient) -> None:
    """``/model-info`` also answers 503 when the artifact is missing."""
    response = unloaded_client.get("/model-info")

    assert response.status_code == 503
    assert response.json()["code"] == "MODEL_NOT_LOADED"


# --------------------------------------------------------------------------- #
# /results
# --------------------------------------------------------------------------- #


def test_results_are_empty_without_report_files(client: TestClient) -> None:
    """Nothing on disk means ``available=false`` and empty collections."""
    payload = client.get("/results").json()

    assert payload == {
        "available": False,
        "model_results": [],
        "per_class_metrics": [],
        "confusion_matrix": None,
        "error_analysis": [],
    }


def test_results_are_read_from_disk(client: TestClient, reports_dir: Path) -> None:
    """Existing report files are exposed verbatim."""
    (reports_dir / "model_results.csv").write_text(
        "model,accuracy,macro_f1\nLogisticRegression,0.86,0.84\n", encoding="utf-8"
    )
    (reports_dir / "per_class_metrics.csv").write_text(
        "category,precision,recall,f1,support\n"
        "Accounting,0.85,0.83,0.84,120\n"
        "Data Science,0.91,0.89,0.90,240\n",
        encoding="utf-8",
    )
    (reports_dir / "confusion_matrix.json").write_text(
        json.dumps({"labels": ["Accounting", "Data Science"], "matrix": [[3, 1], [0, 4]]}),
        encoding="utf-8",
    )
    (reports_dir / "error_analysis.csv").write_text(
        "id,actual,predicted\n1,Data Science,Accounting\n", encoding="utf-8"
    )

    payload = client.get("/results").json()

    assert payload["available"] is True
    assert payload["model_results"][0]["model"] == "LogisticRegression"
    assert len(payload["per_class_metrics"]) == 2
    assert payload["confusion_matrix"] == {
        "labels": ["Accounting", "Data Science"],
        "matrix": [[3, 1], [0, 4]],
    }
    assert payload["error_analysis"][0]["actual"] == "Data Science"


def test_results_never_invent_missing_files(
    client: TestClient, reports_dir: Path
) -> None:
    """Only the files that exist are reported."""
    (reports_dir / "model_results.csv").write_text(
        "model,macro_f1\nLogisticRegression,0.84\n", encoding="utf-8"
    )

    payload = client.get("/results").json()

    assert payload["available"] is True
    assert payload["model_results"]
    assert payload["per_class_metrics"] == []
    assert payload["confusion_matrix"] is None
    assert payload["error_analysis"] == []


def test_error_analysis_is_capped_at_200_rows(
    client: TestClient, reports_dir: Path
) -> None:
    """Large error-analysis files are truncated, never dropped."""
    rows = "".join(f"{index},a,b\n" for index in range(250))
    (reports_dir / "error_analysis.csv").write_text(
        "id,actual,predicted\n" + rows, encoding="utf-8"
    )

    payload = client.get("/results").json()

    assert len(payload["error_analysis"]) == 200


def test_broken_confusion_matrix_is_ignored(
    client: TestClient, reports_dir: Path
) -> None:
    """Invalid JSON in the report must not break the endpoint."""
    (reports_dir / "confusion_matrix.json").write_text("{not json", encoding="utf-8")

    payload = client.get("/results").json()

    assert payload["confusion_matrix"] is None
    assert payload["available"] is False


# --------------------------------------------------------------------------- #
# /predict - happy paths
# --------------------------------------------------------------------------- #


def test_predict_with_json_text(client: TestClient) -> None:
    """``application/json`` predictions follow the documented schema."""
    response = client.post("/predict", json={"text": SAMPLE_RESUME_TEXT})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == _PREDICTION_KEYS
    assert payload["predicted_category"] == "Data Science"
    assert 0.0 <= payload["confidence"] <= 1.0
    assert payload["extracted_chars"] == len(SAMPLE_RESUME_TEXT)
    assert payload["top_predictions"][0]["probability"] == payload["confidence"]
    assert payload["model"] == "SyntheticFixturePipeline"


def test_predict_with_pdf_upload(client: TestClient, sample_pdf: bytes) -> None:
    """A PDF upload is parsed in memory and classified."""
    response = client.post(
        "/predict", files={"file": ("resume.pdf", sample_pdf, "application/pdf")}
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == _PREDICTION_KEYS
    assert payload["extracted_chars"] > 50


def test_predict_with_docx_upload(client: TestClient, sample_docx: bytes) -> None:
    """DOCX paragraphs and tables are both read."""
    response = client.post(
        "/predict", files={"file": ("resume.docx", sample_docx, _DOCX_CONTENT_TYPE)}
    )

    assert response.status_code == 200
    assert response.json()["predicted_category"] == "Data Science"


def test_predict_with_txt_upload(client: TestClient) -> None:
    """Plain-text uploads are supported as well."""
    response = client.post(
        "/predict",
        files={"file": ("resume.txt", SAMPLE_RESUME_TEXT.encode("utf-8"), "text/plain")},
    )

    assert response.status_code == 200
    assert response.json()["predicted_category"] == "Data Science"


def test_predict_respects_the_top_k_query(client: TestClient) -> None:
    """``?top_k=1`` returns a single ranked entry."""
    payload = client.post("/predict?top_k=1", json={"text": SAMPLE_RESUME_TEXT}).json()

    assert len(payload["top_predictions"]) == 1


def test_predict_rejects_an_out_of_range_top_k(client: TestClient) -> None:
    """``?top_k=0`` and ``?top_k=99`` are schema errors."""
    for value in (0, 11):
        response = client.post(f"/predict?top_k={value}", json={"text": SAMPLE_RESUME_TEXT})
        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"


def test_predict_flags_low_confidence(
    make_client: Callable[..., Iterator[TestClient]],
) -> None:
    """``low_confidence`` reflects ``CONFIDENCE_THRESHOLD``."""
    client = next(make_client(CONFIDENCE_THRESHOLD=1.0))

    assert client.post("/predict", json={"text": SAMPLE_RESUME_TEXT}).json()["low_confidence"]


# --------------------------------------------------------------------------- #
# /predict - error paths
# --------------------------------------------------------------------------- #


def test_predict_rejects_unsupported_file_types(client: TestClient) -> None:
    """A ``.exe`` upload is refused with 415."""
    response = client.post(
        "/predict", files={"file": ("payload.exe", b"MZ\x90\x00binary", "application/octet-stream")}
    )

    assert response.status_code == 415
    assert response.json()["code"] == "UNSUPPORTED_FILE_TYPE"


def test_predict_rejects_a_fake_pdf(client: TestClient) -> None:
    """A text file renamed to ``.pdf`` fails magic-byte validation."""
    response = client.post(
        "/predict",
        files={"file": ("fake.pdf", SAMPLE_RESUME_TEXT.encode("utf-8"), "application/pdf")},
    )

    assert response.status_code == 415
    assert response.json()["code"] == "UNSUPPORTED_FILE_TYPE"


def test_predict_rejects_an_unsupported_content_type(client: TestClient) -> None:
    """``text/plain`` bodies are not accepted (JSON or multipart only)."""
    response = client.post(
        "/predict", content=SAMPLE_RESUME_TEXT.encode("utf-8"),
        headers={"Content-Type": "text/plain"},
    )

    assert response.status_code == 415
    assert response.json()["code"] == "UNSUPPORTED_CONTENT_TYPE"


def test_predict_rejects_empty_text(client: TestClient) -> None:
    """An empty ``text`` value is a 400."""
    response = client.post("/predict", json={"text": "   "})

    assert response.status_code == 400
    assert response.json()["code"] == "EMPTY_TEXT"


def test_predict_rejects_too_short_text(client: TestClient) -> None:
    """Text below ``MIN_TEXT_CHARS`` is a 400 with the exact threshold."""
    response = client.post("/predict", json={"text": "data scientist"})

    assert response.status_code == 400
    assert response.json()["code"] == "INPUT_TOO_SHORT"


def test_predict_rejects_neither_text_nor_file(client: TestClient) -> None:
    """An empty JSON object means no input at all."""
    response = client.post("/predict", json={})

    assert response.status_code == 400
    assert response.json()["code"] == "MISSING_INPUT"


def test_predict_rejects_both_text_and_file(
    client: TestClient, sample_pdf: bytes
) -> None:
    """Sending a file *and* a text field is ambiguous and refused."""
    body, headers = _multipart(
        [
            ("file", "resume.pdf", sample_pdf),
            ("text", None, SAMPLE_RESUME_TEXT.encode("utf-8")),
        ]
    )

    response = client.post("/predict", content=body, headers=headers)

    assert response.status_code == 400
    assert response.json()["code"] == "AMBIGUOUS_INPUT"


def test_predict_rejects_invalid_json(client: TestClient) -> None:
    """A malformed JSON body is a 400, not a 500."""
    response = client.post(
        "/predict", content=b"{not json", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_JSON"


def test_predict_rejects_a_wrongly_typed_text_field(client: TestClient) -> None:
    """``{"text": 123}`` is rejected with a precise message."""
    response = client.post("/predict", json={"text": 123})

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_JSON"


def test_predict_rejects_oversize_text(
    make_client: Callable[..., Iterator[TestClient]],
) -> None:
    """Text above ``MAX_TEXT_CHARS`` is a 413."""
    client = next(make_client(MAX_TEXT_CHARS=200))

    response = client.post("/predict", json={"text": "data scientist " * 100})

    assert response.status_code == 413
    assert response.json()["code"] == "INPUT_TOO_LONG"


def test_predict_rejects_oversize_uploads(
    make_client: Callable[..., Iterator[TestClient]],
) -> None:
    """An upload above ``MAX_UPLOAD_MB`` is rejected before it is parsed."""
    client = next(make_client(MAX_UPLOAD_MB=0.001))
    oversized = b"%PDF-1.4\n" + b"x" * 5000
    body, headers = _multipart([("file", "big.pdf", oversized)])

    response = client.post("/predict", content=body, headers=headers)

    assert response.status_code == 413
    assert response.json()["code"] == "FILE_TOO_LARGE"


def test_predict_rejects_two_files(client: TestClient, sample_pdf: bytes) -> None:
    """Only one file per request is accepted."""
    body, headers = _multipart(
        [("file", "one.pdf", sample_pdf), ("file", "two.pdf", sample_pdf)]
    )

    response = client.post("/predict", content=body, headers=headers)

    assert response.status_code == 400
    assert response.json()["code"] == "MULTIPLE_FILES"


def test_predict_reports_corrupted_documents(client: TestClient) -> None:
    """A truncated DOCX is reported as 422, never as a 500."""
    response = client.post(
        "/predict",
        files={"file": ("broken.docx", b"PK\x03\x04truncated", _DOCX_CONTENT_TYPE)},
    )

    assert response.status_code == 422
    assert response.json()["code"] in {"CORRUPTED_FILE", "UNSUPPORTED_FILE_TYPE"}


def test_predict_reports_scanned_pdfs(
    client: TestClient, pdf_factory: Callable[..., bytes]
) -> None:
    """A PDF without a text layer is reported as 422."""
    response = client.post(
        "/predict",
        files={"file": ("scanned.pdf", pdf_factory([[]]), "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "NO_EXTRACTABLE_TEXT"


def test_predict_reports_encrypted_pdfs(
    client: TestClient, encrypted_pdf_bytes: bytes | None
) -> None:
    """Password-protected PDFs are reported as 422."""
    if encrypted_pdf_bytes is None:  # pragma: no cover - depends on the build
        pytest.skip("The installed pypdf build cannot create encrypted PDFs.")

    response = client.post(
        "/predict",
        files={"file": ("protected.pdf", encrypted_pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "ENCRYPTED_PDF"


def test_predict_requires_a_loaded_model(unloaded_client: TestClient) -> None:
    """Without artifacts every prediction endpoint answers 503."""
    for call in (
        lambda: unloaded_client.post("/predict", json={"text": SAMPLE_RESUME_TEXT}),
        lambda: unloaded_client.post("/predict/batch", json={"texts": [SAMPLE_RESUME_TEXT]}),
    ):
        response = call()
        assert response.status_code == 503
        assert response.json()["code"] == "MODEL_NOT_LOADED"


def test_predict_is_rate_limited(
    make_client: Callable[..., Iterator[TestClient]],
) -> None:
    """``RATE_LIMIT`` is enforced per client IP on the prediction endpoints."""
    client = next(make_client(RATE_LIMIT="2/minute"))

    assert client.post("/predict", json={"text": SAMPLE_RESUME_TEXT}).status_code == 200
    assert client.post("/predict", json={"text": OTHER_RESUME_TEXT}).status_code == 200
    limited = client.post("/predict", json={"text": SAMPLE_RESUME_TEXT})

    assert limited.status_code == 429
    body = limited.json()
    assert set(body) == _ERROR_KEYS
    assert body["code"] == "RATE_LIMIT_EXCEEDED"


# --------------------------------------------------------------------------- #
# /predict/batch
# --------------------------------------------------------------------------- #


def test_predict_batch_returns_one_result_per_text(client: TestClient) -> None:
    """The batch endpoint mirrors the single-prediction contract."""
    response = client.post(
        "/predict/batch", json={"texts": [SAMPLE_RESUME_TEXT, OTHER_RESUME_TEXT]}
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 2
    assert all(set(item) == _PREDICTION_KEYS for item in payload)
    assert payload[0]["predicted_category"] == "Data Science"
    assert payload[1]["predicted_category"] == "Human Resources"


def test_predict_batch_rejects_an_empty_list(client: TestClient) -> None:
    """An empty ``texts`` array is a schema error."""
    response = client.post("/predict/batch", json={"texts": []})

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_predict_batch_rejects_more_than_twenty_items(client: TestClient) -> None:
    """The documented batch limit is enforced by the schema."""
    response = client.post("/predict/batch", json={"texts": [SAMPLE_RESUME_TEXT] * 21})

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


# --------------------------------------------------------------------------- #
# Cross-cutting behaviour
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("call", "status", "code"),
    [
        (lambda client: client.get("/classes"), 200, None),
        (lambda client: client.get("/nope"), 404, "NOT_FOUND"),
        (lambda client: client.post("/predict", json={}), 400, "MISSING_INPUT"),
        (lambda client: client.post("/predict", json={"text": "hi"}), 400, "INPUT_TOO_SHORT"),
    ],
)
def test_error_envelope_is_uniform(
    client: TestClient, call: Callable[[TestClient], Any], status: int, code: str | None
) -> None:
    """Failures always answer ``{"error", "code", "request_id"}``."""
    response = call(client)

    assert response.status_code == status
    if code is None:
        return
    body = response.json()
    assert set(body) == _ERROR_KEYS
    assert body["code"] == code
    assert isinstance(body["error"], str) and body["error"]
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_generic_500_hides_internals(
    settings_factory: Callable[..., Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """An unexpected exception returns a generic message and no traceback."""
    from src.predict import ResumeClassifier

    def _boom(self: ResumeClassifier, text: str, top_k: int | None = None) -> Any:
        raise RuntimeError("secret internal detail about /var/private/path")

    monkeypatch.setattr(ResumeClassifier, "predict", _boom)
    # ``raise_server_exceptions=False`` mimics a real deployment: the server
    # answers with the JSON envelope and logs the traceback.
    with TestClient(
        create_app(settings_factory()), raise_server_exceptions=False
    ) as failing_client:
        response = failing_client.post("/predict", json={"text": SAMPLE_RESUME_TEXT})

    assert response.status_code == 500
    body = response.json()
    assert set(body) == _ERROR_KEYS
    assert body["code"] == "INTERNAL_SERVER_ERROR"
    assert "secret internal detail" not in json.dumps(body)
    assert "/var/private/path" not in json.dumps(body)


def test_request_id_is_generated_and_echoed(client: TestClient) -> None:
    """Every response carries ``X-Request-ID``; valid client ids are reused."""
    generated = client.get("/health")
    assert generated.headers["X-Request-ID"]

    echoed = client.get("/health", headers={"X-Request-ID": "client-supplied-id"})
    assert echoed.headers["X-Request-ID"] == "client-supplied-id"

    rejected = client.get("/health", headers={"X-Request-ID": "bad id with spaces"})
    assert rejected.headers["X-Request-ID"] != "bad id with spaces"


def test_security_headers_are_set(client: TestClient) -> None:
    """Responses are hardened and predictions are not cacheable."""
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"

    prediction = client.post("/predict", json={"text": SAMPLE_RESUME_TEXT})
    assert prediction.headers["Cache-Control"] == "no-store"

    assert "Cache-Control" not in client.get("/health").headers


def test_cors_is_restricted_to_the_configured_origin(
    make_client: Callable[..., Iterator[TestClient]],
) -> None:
    """CORS reflects the frontend origin and hides ``X-Request-ID`` otherwise."""
    client = next(make_client(ALLOWED_ORIGINS=["http://localhost:5173"]))

    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "X-Request-ID" in allowed.headers["access-control-expose-headers"]

    denied = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_openapi_documents_examples_and_the_ai_disclaimer(client: TestClient) -> None:
    """The OpenAPI document carries examples and the responsible-AI notice."""
    schema = client.get("/openapi.json").json()

    assert RESPONSIBLE_AI_NOTICE in schema["info"]["description"]
    assert schema["info"]["title"]
    assert schema["info"]["version"]
    tags = {tag["name"] for tag in schema["tags"]}
    assert {"prediction", "model", "results", "system"} <= tags

    predict = schema["paths"]["/predict"]["post"]
    assert predict["summary"]
    assert predict["description"]
    request_body = predict["requestBody"]["content"]
    assert "multipart/form-data" in request_body
    assert request_body["application/json"]["example"]["text"]
    assert predict["responses"]["200"]["content"]["application/json"]["example"][
        "predicted_category"
    ]
    assert {"200", "400", "413", "415", "422", "429", "503"} <= set(predict["responses"])

    for path in ("/health", "/classes", "/model-info", "/results", "/predict/batch"):
        assert path in schema["paths"]


def test_interactive_docs_are_served(client: TestClient) -> None:
    """Swagger UI and ReDoc are available for the frontend team."""
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200


def test_request_logs_contain_metadata_only(app: FastAPI) -> None:
    """Resume content must never reach the log stream - metadata only."""
    buffer = io.StringIO()
    with TestClient(app) as test_client:
        configure_logging("INFO", stream=buffer)
        response = test_client.post("/predict", json={"text": SAMPLE_RESUME_TEXT})

    output = buffer.getvalue()
    assert response.status_code == 200
    assert "request_completed" in output
    assert "path='/predict'" in output
    assert "status_code=200" in output
    assert "latency_ms=" in output
    assert "scikit-learn" not in output
    assert "Data scientist" not in output


def test_logging_redacts_contact_data() -> None:
    """The redaction filter is a safety net for accidental content logging."""
    buffer = io.StringIO()
    configure_logging("INFO", stream=buffer)

    logging.getLogger("api.tests").info(
        "contact jane.doe@example.com or +1 555 010 2030", extra={"color_message": "ignored"}
    )
    output = buffer.getvalue()

    assert "jane.doe@example.com" not in output
    assert "555" not in output
    assert "REDACTED_EMAIL" in output
    assert "color_message" not in output
    assert "request_id=" in output


def test_unknown_method_is_reported(client: TestClient) -> None:
    """Framework-level errors use the same envelope."""
    response = client.get("/predict")

    assert response.status_code == 405
    assert response.json()["code"] == "METHOD_NOT_ALLOWED"
