"""Error translation: every failure becomes ``{"error", "code", "request_id"}``.

Three layers of errors exist and all of them end up in the same envelope:

* :class:`AppError` - HTTP-aware errors raised by the API layer,
* ``src`` domain errors (extraction, preprocessing, model loading) mapped through
  :data:`DOMAIN_ERROR_MAP`,
* framework errors (``HTTPException``, request validation, rate limiting,
  unexpected exceptions).

Unexpected exceptions are logged with their traceback and answered with a
generic message: internal details never reach the client.
"""

from __future__ import annotations

import logging
from typing import Any, Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from src.model_loader import ModelLoadError, ModelNotFoundError
from src.predict import (
    BatchTooLargeError,
    InputTooLongError,
    InputTooShortError,
    ModelNotLoadedError,
)
from src.text_extraction import (
    CorruptedFileError,
    EmptyFileError,
    EncryptedPdfError,
    FileTooLargeError,
    NoExtractableTextError,
    UnsupportedFileTypeError,
)
from src.utils import current_request_id

__all__ = [
    "AppError",
    "DOMAIN_ERROR_MAP",
    "GENERIC_500_MESSAGE",
    "build_error_payload",
    "error_response",
    "register_exception_handlers",
]

logger = logging.getLogger(__name__)

GENERIC_500_MESSAGE: Final[str] = (
    "Internal server error. The request could not be completed; please retry or "
    "contact the API owner."
)

DOMAIN_ERROR_MAP: Final[dict[type[Exception], tuple[int, str]]] = {
    UnsupportedFileTypeError: (415, "UNSUPPORTED_FILE_TYPE"),
    EmptyFileError: (400, "EMPTY_FILE"),
    CorruptedFileError: (422, "CORRUPTED_FILE"),
    EncryptedPdfError: (422, "ENCRYPTED_PDF"),
    NoExtractableTextError: (422, "NO_EXTRACTABLE_TEXT"),
    FileTooLargeError: (413, "FILE_TOO_LARGE"),
    InputTooShortError: (400, "INPUT_TOO_SHORT"),
    InputTooLongError: (413, "INPUT_TOO_LONG"),
    BatchTooLargeError: (400, "BATCH_TOO_LARGE"),
    ModelNotLoadedError: (503, "MODEL_NOT_LOADED"),
    ModelNotFoundError: (503, "MODEL_NOT_FOUND"),
    ModelLoadError: (503, "MODEL_LOAD_ERROR"),
}

_STATUS_CODE_NAMES: Final[dict[int, str]] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
}

_MAX_VALIDATION_ERRORS: Final[int] = 3


class AppError(Exception):
    """Base class for HTTP-aware API errors."""

    status_code: int = 400
    code: str = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
    ) -> None:
        """Create an API error.

        Parameters
        ----------
        message:
            Safe, human readable message returned to the client.
        status_code:
            Overrides the class default.
        code:
            Overrides the class default.
        """
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


# Convenience subclasses used by the routing layer ----------------------- #


class BadRequestError(AppError):
    """400 - the request is malformed or ambiguous."""

    status_code = 400
    code = "BAD_REQUEST"


class PayloadTooLargeError(AppError):
    """413 - the request body exceeds the configured limit."""

    status_code = 413
    code = "FILE_TOO_LARGE"


class UnsupportedMediaTypeError(AppError):
    """415 - the request ``Content-Type`` is not supported."""

    status_code = 415
    code = "UNSUPPORTED_CONTENT_TYPE"


class ModelUnavailableError(AppError):
    """503 - the model artifact is not loaded."""

    status_code = 503
    code = "MODEL_NOT_LOADED"


# --------------------------------------------------------------------------- #
# Envelope helpers
# --------------------------------------------------------------------------- #


def _request_id(request: Request) -> str:
    """Return the request id attached by the middleware (or ``"-"``)."""
    return str(getattr(request.state, "request_id", None) or current_request_id())


def build_error_payload(message: str, code: str, request_id: str) -> dict[str, str]:
    """Build the JSON body used by every error response."""
    return {"error": message, "code": code, "request_id": request_id}


def error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Return a :class:`JSONResponse` carrying the error envelope."""
    return JSONResponse(
        status_code=status_code,
        content=build_error_payload(message, code, _request_id(request)),
        headers=headers or {},
    )


def _describe_validation_errors(errors: list[Any]) -> str:
    """Summarise pydantic/FastAPI validation errors without echoing input."""
    parts: list[str] = []
    for error in errors[:_MAX_VALIDATION_ERRORS]:
        location = ".".join(str(item) for item in error.get("loc", ()) if item != "body")
        message = str(error.get("msg", "invalid value"))
        parts.append(f"{location}: {message}" if location else message)
    if len(errors) > _MAX_VALIDATION_ERRORS:
        parts.append(f"(+{len(errors) - _MAX_VALIDATION_ERRORS} more)")
    return " | ".join(parts) if parts else "The request body failed validation."


# --------------------------------------------------------------------------- #
# Handlers
# --------------------------------------------------------------------------- #


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle :class:`AppError` and every mapped ``src`` domain error."""
    if isinstance(exc, AppError):
        status_code, code, message = exc.status_code, exc.code, exc.message
    else:
        mapping = next(
            (
                value
                for error_type, value in DOMAIN_ERROR_MAP.items()
                if isinstance(exc, error_type)
            ),
            (500, "INTERNAL_SERVER_ERROR"),
        )
        status_code, code = mapping
        message = str(exc) if status_code < 500 else GENERIC_500_MESSAGE
        if status_code >= 500:
            logger.error(
                "domain_error",
                extra={"error_code": code, "error_type": type(exc).__name__},
                exc_info=exc,
            )
    return error_response(
        request, status_code=status_code, code=code, message=message
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle Starlette/FastAPI HTTP exceptions with the same envelope."""
    status_code = int(getattr(exc, "status_code", 500))
    detail = getattr(exc, "detail", None)
    message = str(detail) if detail else "Request failed."
    code = _STATUS_CODE_NAMES.get(status_code, "HTTP_ERROR")
    if status_code >= 500:
        message = GENERIC_500_MESSAGE
        logger.error("http_error", extra={"status_code": status_code}, exc_info=exc)
    headers = getattr(exc, "headers", None) or {}
    return error_response(
        request,
        status_code=status_code,
        code=code,
        message=message,
        headers=dict(headers),
    )


async def rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
    """Handle slowapi rate limiting (429)."""
    logger.warning("rate_limited", extra={"endpoint": request.url.path})
    return error_response(
        request,
        status_code=429,
        code="RATE_LIMIT_EXCEEDED",
        message="Too many requests. Please slow down and try again shortly.",
        headers={"Retry-After": "60"},
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle FastAPI/pydantic request validation failures (422)."""
    raw_errors = getattr(exc, "errors", None)
    errors = list(raw_errors()) if callable(raw_errors) else []
    return error_response(
        request,
        status_code=422,
        code="VALIDATION_ERROR",
        message=_describe_validation_errors(errors),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler: log the traceback, return a generic message (500)."""
    logger.error(
        "unhandled_exception",
        extra={"endpoint": request.url.path, "error_type": type(exc).__name__},
        exc_info=exc,
    )
    return error_response(
        request,
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message=GENERIC_500_MESSAGE,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register every handler on ``app`` (called once by the app factory)."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    for error_type in DOMAIN_ERROR_MAP:
        app.add_exception_handler(error_type, app_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
