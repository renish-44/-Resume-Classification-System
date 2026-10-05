"""All HTTP route handlers.

The router is built by :func:`create_router` so each application instance gets
its own rate limit (the tests create an app with a tiny limit). Request bodies
for ``/predict`` are parsed **manually** and fully **in memory**:

* ``multipart/form-data`` is parsed with ``python-multipart`` callbacks that keep
  the upload in a ``bytearray`` - FastAPI's ``UploadFile`` would spool to a
  temporary file on disk, which the privacy rules forbid;
* ``application/json`` and ``application/x-www-form-urlencoded`` are parsed from
  the already-buffered body;
* the body is streamed with a hard byte cap, so an oversized upload is rejected
  before it is fully read.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Annotated, Any, Final
from urllib.parse import parse_qs

from fastapi import APIRouter, Body, Query, Request
from python_multipart import MultipartParser
from slowapi import Limiter
from starlette.concurrency import run_in_threadpool
from starlette.formparsers import parse_options_header

from api.dependencies import (
    get_request_id,
    get_settings_from_state,
    rate_limit,
    require_classifier,
)
from api.errors import AppError, BadRequestError, PayloadTooLargeError, UnsupportedMediaTypeError
from api.schemas import (
    BATCH_REQUEST_EXAMPLE,
    CLASSES_EXAMPLE,
    HEALTH_EXAMPLE,
    MODEL_INFO_EXAMPLE,
    PREDICTION_EXAMPLE,
    RESULTS_EXAMPLE,
    BatchPredictionRequest,
    ClassesResponse,
    ConfusionMatrixResponse,
    ErrorResponse,
    HealthResponse,
    ModelInfoResponse,
    PredictionResponse,
    ResultsResponse,
)
from src.config import (
    API_VERSION,
    MAX_ERROR_ANALYSIS_ROWS,
    MAX_TOP_K,
    MIN_TOP_K,
    REPORT_FILENAMES,
)
from src.model_loader import LoadedModel
from src.preprocessing import PREPROCESSING_VERSION
from src.text_extraction import extract_text
from src.utils import format_size_limit, human_size, read_csv_rows, read_json_file, safe_filename

__all__ = ["create_router", "load_results_payload", "parse_multipart_upload"]

logger = logging.getLogger(__name__)

FILE_FIELD_NAME: Final[str] = "file"
TEXT_FIELD_NAME: Final[str] = "text"
_MULTIPART_BODY_OVERHEAD: Final[int] = 64 * 1024
_JSON_CONTENT_TYPES: Final[frozenset[str]] = frozenset(
    {"application/json", "text/json", "application/vnd.api+json"}
)
_FORM_CONTENT_TYPE: Final[str] = "application/x-www-form-urlencoded"
_MULTIPART_CONTENT_TYPE: Final[str] = "multipart/form-data"
_PREDICT_ERROR_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    400: {"model": ErrorResponse, "description": "Empty/ambiguous input, or invalid JSON."},
    413: {"model": ErrorResponse, "description": "Upload or text above the configured limit."},
    415: {"model": ErrorResponse, "description": "Unsupported file type or content type."},
    422: {"model": ErrorResponse, "description": "Corrupted, encrypted or text-free document."},
    429: {"model": ErrorResponse, "description": "Rate limit exceeded."},
    503: {"model": ErrorResponse, "description": "Model artifact not loaded."},
}


# --------------------------------------------------------------------------- #
# Request payload parsing
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class ParsedPayload:
    """Outcome of parsing a ``/predict`` request body."""

    text: str | None = None
    filename: str | None = None
    content: bytes | None = None
    text_provided: bool = False

    @property
    def has_file(self) -> bool:
        """True when an uploaded file part was received."""
        return self.content is not None


def _content_type(request: Request) -> str:
    """Return the bare, lower-cased media type of the request."""
    return (request.headers.get("content-type") or "").split(";")[0].strip().lower()


async def read_body_limited(request: Request, max_bytes: int) -> bytes:
    """Buffer the request body while enforcing ``max_bytes``.

    ``Content-Length`` is checked first (cheap rejection), then the stream is
    consumed incrementally and abandoned as soon as the cap is exceeded.
    """
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > max_bytes:
        raise PayloadTooLargeError(
            f"The request body is larger than the {format_size_limit(max_bytes)} limit."
        )

    buffer = bytearray()
    async for chunk in request.stream():
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise PayloadTooLargeError(
                f"The request body is larger than the {format_size_limit(max_bytes)} limit."
            )
    return bytes(buffer)


class _UploadCollector:
    """Multipart callbacks that keep the uploaded file in memory only.

    FastAPI's ``UploadFile`` wraps a ``SpooledTemporaryFile`` that spills to
    disk above 1 MB; resume content must never touch the filesystem, so the
    part is collected into a ``bytearray`` instead.
    """

    def __init__(self, field_name: str, max_bytes: int) -> None:
        self._field_name = field_name
        self._max_bytes = max_bytes
        self.filename: str | None = None
        self.content: bytes | None = None
        self.text_fields: dict[str, str] = {}
        self._header_field = bytearray()
        self._header_value = bytearray()
        self._headers: dict[bytes, bytes] = {}
        self._part_name: str | None = None
        self._part_filename: str | None = None
        self._part_is_target = False
        self._part_buffer = bytearray()

    def on_part_begin(self) -> None:
        """Reset the per-part state."""
        self._headers.clear()
        self._part_name = None
        self._part_filename = None
        self._part_is_target = False
        self._part_buffer = bytearray()

    def on_header_field(self, data: bytes, start: int, end: int) -> None:
        """Accumulate a header name."""
        self._header_field.extend(data[start:end])

    def on_header_value(self, data: bytes, start: int, end: int) -> None:
        """Accumulate a header value."""
        self._header_value.extend(data[start:end])

    def on_header_end(self) -> None:
        """Store the completed header."""
        name = bytes(self._header_field).strip().lower()
        self._headers[name] = bytes(self._header_value)
        self._header_field = bytearray()
        self._header_value = bytearray()

    def on_headers_finished(self) -> None:
        """Read ``Content-Disposition`` to learn the field and file names."""
        _, params = parse_options_header(self._headers.get(b"content-disposition", b""))
        raw_name = params.get(b"name")
        raw_filename = params.get(b"filename")
        self._part_name = raw_name.decode("utf-8", "replace") if raw_name else None
        self._part_filename = (
            raw_filename.decode("utf-8", "replace") if raw_filename is not None else None
        )
        self._part_is_target = (
            self._part_name == self._field_name and self._part_filename is not None
        )

    def on_part_data(self, data: bytes, start: int, end: int) -> None:
        """Collect the bytes of the current part (every part is size-capped)."""
        self._part_buffer.extend(data[start:end])
        if len(self._part_buffer) > self._max_bytes:
            raise PayloadTooLargeError(
                f"The uploaded file is larger than the {format_size_limit(self._max_bytes)} limit."
            )

    def on_part_end(self) -> None:
        """Finalise the current part."""
        if self._part_is_target:
            if self.content is not None:
                raise BadRequestError(
                    "Only one file can be uploaded per request.", code="MULTIPLE_FILES"
                )
            self.filename = safe_filename(self._part_filename)
            self.content = bytes(self._part_buffer)
        elif self._part_name and self._part_filename is None:
            self.text_fields[self._part_name] = self._part_buffer.decode("utf-8", "replace")

    def on_end(self) -> None:
        """No-op: the body is fully consumed by the callbacks above."""


def _unwrap_app_error(exc: BaseException) -> AppError | None:
    """Find an :class:`AppError` in an exception chain.

    ``python-multipart`` re-raises whatever a callback raised, which hides the
    original error behind its own parser exception; this helper digs it out so
    the correct HTTP status (413, 400) is preserved.
    """
    current: BaseException | None = exc
    for _ in range(5):
        if current is None:
            return None
        if isinstance(current, AppError):
            return current
        current = current.__cause__ or current.__context__
    return None


def parse_multipart_upload(
    body: bytes,
    content_type_header: str,
    *,
    max_bytes: int,
    field_name: str = FILE_FIELD_NAME,
) -> _UploadCollector:
    """Parse a ``multipart/form-data`` body from memory.

    Parameters
    ----------
    body:
        Fully buffered request body.
    content_type_header:
        The raw ``Content-Type`` header (the boundary is read from it).
    max_bytes:
        Maximum accepted size of the file part.
    field_name:
        Name of the multipart field holding the file.

    Raises
    ------
    BadRequestError, PayloadTooLargeError
    """
    try:
        encoded_header = content_type_header.encode("latin-1")
    except UnicodeEncodeError as exc:  # pragma: no cover - defensive
        raise BadRequestError("The Content-Type header is malformed.") from exc

    _, params = parse_options_header(encoded_header)
    boundary = params.get(b"boundary")
    if not boundary:
        raise BadRequestError("The multipart request has no boundary parameter.")

    collector = _UploadCollector(field_name, max_bytes)
    parser = MultipartParser(
        boundary,
        callbacks={
            "on_part_begin": collector.on_part_begin,
            "on_part_data": collector.on_part_data,
            "on_part_end": collector.on_part_end,
            "on_header_field": collector.on_header_field,
            "on_header_value": collector.on_header_value,
            "on_header_end": collector.on_header_end,
            "on_headers_finished": collector.on_headers_finished,
            "on_end": collector.on_end,
        },
        max_size=max_bytes + _MULTIPART_BODY_OVERHEAD,
    )
    try:
        parser.write(body)
        parser.finalize()
    except Exception as exc:
        app_error = _unwrap_app_error(exc)
        if app_error is not None:
            raise app_error from exc
        raise BadRequestError("The multipart body could not be parsed.") from exc
    return collector


async def parse_predict_payload(request: Request, max_upload_bytes: int) -> ParsedPayload:
    """Parse a ``/predict`` body as either a multipart upload or raw text."""
    media_type = _content_type(request)

    if media_type == _MULTIPART_CONTENT_TYPE:
        raw_type = request.headers.get("content-type") or ""
        body = await read_body_limited(request, max_upload_bytes + _MULTIPART_BODY_OVERHEAD)
        collector = parse_multipart_upload(
            body, raw_type, max_bytes=max_upload_bytes
        )
        text = collector.text_fields.get(TEXT_FIELD_NAME)
        return ParsedPayload(
            text=text,
            filename=collector.filename,
            content=collector.content,
            text_provided=TEXT_FIELD_NAME in collector.text_fields,
        )

    if media_type in _JSON_CONTENT_TYPES:
        body = await read_body_limited(request, max_upload_bytes)
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BadRequestError(
                "The request body is not valid UTF-8 JSON.", code="INVALID_JSON"
            ) from exc
        if not isinstance(payload, dict):
            raise BadRequestError(
                'The JSON body must be an object such as {"text": "..."}.',
                code="INVALID_JSON",
            )
        if TEXT_FIELD_NAME not in payload:
            raise BadRequestError(
                'Send {"text": "..."} as application/json, or a multipart file field named '
                f'"{FILE_FIELD_NAME}".',
                code="MISSING_INPUT",
            )
        text = payload[TEXT_FIELD_NAME]
        if text is None:
            text = ""
        if not isinstance(text, str):
            raise BadRequestError(
                f"The '{TEXT_FIELD_NAME}' field must be a string.", code="INVALID_JSON"
            )
        return ParsedPayload(text=text, text_provided=True)

    if media_type == _FORM_CONTENT_TYPE:
        body = await read_body_limited(request, max_upload_bytes)
        form = parse_qs(body.decode("utf-8", "replace"), keep_blank_values=True)
        if TEXT_FIELD_NAME in form:
            return ParsedPayload(text=form[TEXT_FIELD_NAME][0], text_provided=True)
        raise BadRequestError(
            'Send the resume text in a "text" field, or use multipart/form-data.',
            code="MISSING_INPUT",
        )

    raise UnsupportedMediaTypeError(
        "Use multipart/form-data with a 'file' field (pdf, docx, txt) or application/json "
        'with {"text": "..."}.'
    )


# --------------------------------------------------------------------------- #
# Report loading (/results)
# --------------------------------------------------------------------------- #


def _parse_confusion_matrix(payload: Any) -> ConfusionMatrixResponse | None:
    """Validate ``reports/confusion_matrix.json``; return ``None`` when unusable."""
    labels: Any = None
    matrix: Any = None
    if isinstance(payload, Mapping):
        labels = payload.get("labels")
        matrix = payload.get("matrix")
    elif isinstance(payload, list):
        matrix = payload
    if not isinstance(matrix, list) or not matrix:
        return None
    if not all(isinstance(row, list) for row in matrix):
        return None
    if not all(
        isinstance(value, (int, float)) and not isinstance(value, bool)
        for row in matrix
        for value in row
    ):
        return None
    if labels is None:
        labels = []
    if not isinstance(labels, list) or not all(isinstance(label, str) for label in labels):
        labels = []
    if labels and len(labels) != len(matrix):
        logger.warning("confusion_matrix_labels_mismatch", extra={"labels": len(labels)})
        labels = []
    return ConfusionMatrixResponse(
        labels=[str(label) for label in labels],
        matrix=[[int(value) for value in row] for row in matrix],
    )


def load_results_payload(reports_dir: Path) -> dict[str, Any]:
    """Read the optional evaluation reports from ``reports_dir``.

    Only files that really exist are read. Missing files yield empty lists, and
    ``available`` is ``False`` when nothing was found - **no metric is ever
    invented**. ``error_analysis.csv`` is capped at
    :data:`~src.config.MAX_ERROR_ANALYSIS_ROWS` rows.
    """
    model_results = read_csv_rows(reports_dir / REPORT_FILENAMES["model_results"])
    per_class_metrics = read_csv_rows(reports_dir / REPORT_FILENAMES["per_class_metrics"])
    error_analysis = read_csv_rows(
        reports_dir / REPORT_FILENAMES["error_analysis"], limit=MAX_ERROR_ANALYSIS_ROWS
    )
    confusion_matrix = _parse_confusion_matrix(
        read_json_file(reports_dir / REPORT_FILENAMES["confusion_matrix"])
    )
    available = bool(model_results or per_class_metrics or error_analysis or confusion_matrix)
    return {
        "available": available,
        "model_results": model_results,
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": confusion_matrix,
        "error_analysis": error_analysis,
    }


def _model_info_payload(model: LoadedModel, confidence_threshold: float) -> dict[str, Any]:
    """Build the ``/model-info`` body from the loaded artifact."""
    return {
        "model_name": model.model_name or None,
        "model_type": model.model_type or None,
        "ngram_range": list(model.ngram_range) if model.ngram_range else None,
        "num_classes": model.num_classes,
        "vocab_size": model.vocab_size,
        "preprocessing_version": PREPROCESSING_VERSION,
        "sklearn_runtime_version": model.sklearn_version_runtime,
        "sklearn_trained_version": model.sklearn_version_trained,
        "trained_date": model.trained_date,
        "confidence_threshold": confidence_threshold,
    }


# --------------------------------------------------------------------------- #
# Router factory
# --------------------------------------------------------------------------- #


def create_router(*, rate_limit_value: str, limiter_instance: Limiter) -> APIRouter:
    """Build the API router with every ResumeForge endpoint."""
    router = APIRouter()
    limit = rate_limit(rate_limit_value, limiter_instance)

    # ------------------------------------------------------------------ #
    # System endpoints
    # ------------------------------------------------------------------ #

    @router.get(
        "/health",
        response_model=HealthResponse,
        tags=["system"],
        summary="Liveness probe and model status",
        responses={
            200: {
                "model": HealthResponse,
                "description": "The service is up (model_loaded reports the artifact status).",
                "content": {"application/json": {"example": HEALTH_EXAMPLE}},
            }
        },
    )
    async def health(request: Request) -> HealthResponse:
        """Report process health and whether the model artifacts loaded."""
        classifier = getattr(request.app.state, "classifier", None)
        return HealthResponse(
            status="ok",
            model_loaded=classifier is not None,
            model_name=classifier.model_name if classifier is not None else None,
            version=API_VERSION,
        )

    @router.get(
        "/classes",
        response_model=ClassesResponse,
        tags=["model"],
        summary="Classes the loaded model can predict",
        responses={
            200: {
                "model": ClassesResponse,
                "description": "The label set reported by the loaded artifact.",
                "content": {"application/json": {"example": CLASSES_EXAMPLE}},
            },
            503: {"model": ErrorResponse, "description": "Model artifact not loaded."},
        },
    )
    async def classes(request: Request) -> ClassesResponse:
        """Return the label set reported by the loaded artifact."""
        classifier = require_classifier(request)
        names = classifier.class_names
        return ClassesResponse(classes=names, count=len(names))

    @router.get(
        "/model-info",
        response_model=ModelInfoResponse,
        tags=["model"],
        summary="Metadata of the loaded artifact",
        responses={
            200: {
                "model": ModelInfoResponse,
                "description": "Artifact metadata; unavailable values are null.",
                "content": {"application/json": {"example": MODEL_INFO_EXAMPLE}},
            },
            503: {"model": ErrorResponse, "description": "Model artifact not loaded."},
        },
    )
    async def model_info(request: Request) -> ModelInfoResponse:
        """Describe the model: type, n-grams, vocabulary size and versions.

        Values that cannot be determined are returned as ``null`` - nothing is
        guessed, in particular no performance metric is invented here.
        """
        classifier = require_classifier(request)
        settings = get_settings_from_state(request)
        return ModelInfoResponse(
            **_model_info_payload(classifier.model, float(settings.CONFIDENCE_THRESHOLD))
        )

    @router.get(
        "/results",
        response_model=ResultsResponse,
        tags=["results"],
        summary="Training reports that exist on disk",
        responses={
            200: {
                "model": ResultsResponse,
                "description": "Whatever report files exist; never fabricated values.",
                "content": {"application/json": {"example": RESULTS_EXAMPLE}},
            }
        },
    )
    async def results(request: Request) -> ResultsResponse:
        """Expose the optional report files produced during training.

        Reads ``model_results.csv``, ``per_class_metrics.csv``,
        ``confusion_matrix.json`` and ``error_analysis.csv`` from ``REPORTS_DIR``
        **only when they exist**; otherwise the lists are empty and ``available``
        is ``false``.
        """
        settings = get_settings_from_state(request)
        payload = load_results_payload(settings.resolved_reports_dir)
        return ResultsResponse(**payload)

    # ------------------------------------------------------------------ #
    # Prediction endpoints
    # ------------------------------------------------------------------ #

    @router.post(
        "/predict",
        response_model=PredictionResponse,
        tags=["prediction"],
        summary="Classify a resume (file upload or raw text)",
        responses={
            200: {
                "model": PredictionResponse,
                "description": "Ranked categories for the submitted resume.",
                "content": {"application/json": {"example": PREDICTION_EXAMPLE}},
            },
            **_PREDICT_ERROR_RESPONSES,
        },
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "file": {
                                    "type": "string",
                                    "format": "binary",
                                    "description": "PDF, DOCX or TXT resume. Size limit "
                                    "is configured with MAX_UPLOAD_MB (5 MB by default).",
                                }
                            },
                            "required": ["file"],
                        }
                    },
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "text": {
                                    "type": "string",
                                    "description": "Raw resume text.",
                                }
                            },
                            "required": ["text"],
                        },
                        "example": {
                            "text": "Data scientist with four years of experience building "
                            "forecasting models in Python, pandas and SQL on AWS, plus "
                            "experience with TensorFlow and NLP."
                        },
                    },
                },
            }
        },
    )
    @limit
    async def predict(
        request: Request,
        top_k: Annotated[
            int | None,
            Query(
                ge=MIN_TOP_K,
                le=MAX_TOP_K,
                description=f"Number of ranked categories to return ({MIN_TOP_K}-{MAX_TOP_K}).",
            ),
        ] = None,
    ) -> PredictionResponse:
        """Classify a resume and return the ranked categories.

        Send **either** a ``multipart/form-data`` upload (field ``file``, PDF /
        DOCX / TXT) **or** ``application/json`` ``{"text": "..."}`` - sending both
        or neither returns ``400``. Uploads are parsed in memory and never
        written to disk.
        """
        classifier = require_classifier(request)
        settings = get_settings_from_state(request)
        limit_bytes = settings.max_upload_bytes
        logger.debug(
            "predict_request",
            extra={"request_id": get_request_id(request), "media_type": _content_type(request)},
        )

        payload = await parse_predict_payload(request, limit_bytes)
        if payload.has_file and payload.text_provided:
            raise BadRequestError(
                "Send either a file or text, not both.", code="AMBIGUOUS_INPUT"
            )

        if payload.has_file and payload.content is not None and payload.filename:
            logger.info(
                "prediction_upload",
                extra={
                    "file_ext": Path(payload.filename).suffix.lower(),
                    "payload_bytes": len(payload.content),
                    "payload_human": human_size(len(payload.content)),
                },
            )
            text = await run_in_threadpool(
                partial(
                    extract_text,
                    payload.content,
                    payload.filename,
                    max_bytes=limit_bytes,
                )
            )
        elif payload.text_provided and payload.text is not None:
            if not payload.text.strip():
                raise BadRequestError("The provided text is empty.", code="EMPTY_TEXT")
            text = payload.text
        else:
            raise BadRequestError(
                'Send {"text": "..."} as application/json, or a multipart file field named '
                f'"{FILE_FIELD_NAME}".',
                code="MISSING_INPUT",
            )

        result = await run_in_threadpool(partial(classifier.predict, text, top_k))
        return PredictionResponse(**result.to_dict())

    @router.post(
        "/predict/batch",
        response_model=list[PredictionResponse],
        tags=["prediction"],
        summary="Classify up to 20 resume texts in one call",
        responses={
            200: {
                "model": list[PredictionResponse],
                "description": "One result per submitted text, in the same order.",
                "content": {"application/json": {"example": [PREDICTION_EXAMPLE]}},
            },
            **_PREDICT_ERROR_RESPONSES,
        },
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {"texts": {"type": "array", "items": {"type": "string"}}},
                            "required": ["texts"],
                        },
                        "example": BATCH_REQUEST_EXAMPLE,
                    }
                },
            }
        },
    )
    @limit
    async def predict_batch(
        request: Request,
        payload: Annotated[BatchPredictionRequest, Body(description="Texts to classify.")],
    ) -> list[PredictionResponse]:
        """Classify several texts at once, returning one result per input."""
        classifier = require_classifier(request)
        results_list = await run_in_threadpool(classifier.predict_batch, payload.texts)
        return [PredictionResponse(**item.to_dict()) for item in results_list]

    return router
