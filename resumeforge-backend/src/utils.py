"""Structured logging, PII redaction and small shared helpers.

Privacy contract
----------------
Resume content is **never** written to the log stream by this backend. The
application code only ever logs metadata (request id, endpoint, HTTP status,
latency, byte sizes, file extension). As a defence-in-depth measure every log
record additionally passes through :class:`SensitiveDataFilter`, which

* removes e-mail addresses, phone-number-like digit runs and long digit
  sequences,
* truncates overly long messages (resume excerpts are long by nature),
* drops ``extra`` values whose key looks like document content.

The filter is a safety net, not a licence to log text: never pass resume text,
extracted text or file bytes to a logger.
"""

from __future__ import annotations

import csv
import json
import logging
import re
import sys
import unicodedata
import uuid
from collections.abc import Iterable, Mapping
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TextIO

__all__ = [
    "MAX_LOG_MESSAGE_CHARS",
    "REDACTED",
    "RequestIdFilter",
    "SensitiveDataFilter",
    "configure_logging",
    "coerce_bool",
    "coerce_float",
    "coerce_int",
    "current_request_id",
    "format_size_limit",
    "human_size",
    "new_request_id",
    "normalize_whitespace",
    "read_csv_rows",
    "read_json_file",
    "request_id_context",
    "safe_filename",
    "split_csv_list",
]

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

MAX_LOG_MESSAGE_CHARS = 500
"""Maximum number of characters of a single log message (longer -> truncated)."""

REDACTED = "[REDACTED]"
_TRUNCATION_SUFFIX = "[TRUNCATED]"

#: ``extra`` keys whose values are treated as document content and dropped.
SENSITIVE_KEY_HINTS: frozenset[str] = frozenset(
    {
        "body",
        "content",
        "document",
        "extracted_text",
        "file_bytes",
        "preview",
        "raw_text",
        "resume",
        "resume_text",
        "text",
    }
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]{2,}")
_PHONE_RE = re.compile(r"(?<![\w.])(?:\+?\d[\d\s().-]{6,}\d)(?![\w.])")
_LONG_DIGITS_RE = re.compile(r"\b\d{7,}\b")
#: IPv4 (optionally with a port) is infrastructure metadata, not personal data;
#: it is protected before redaction so log lines stay readable.
_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_SPACE_RE = re.compile(r"[ \t\x0b\f\r]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
_AROUND_NEWLINE_RE = re.compile(r"[ \t]*\n[ \t]*")

_LOG_RECORD_SKIP_ATTRS: frozenset[str] = frozenset(
    {
        "args",
        "asctime",
        "color_message",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)

#: Ambient request id used outside of an HTTP request (CLI, startup, workers).
request_id_context: ContextVar[str] = ContextVar("request_id", default="-")


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #


def new_request_id() -> str:
    """Return a fresh, opaque request identifier."""
    return uuid.uuid4().hex


def current_request_id() -> str:
    """Return the request id bound to the current context (``"-"`` if none)."""
    return request_id_context.get()


class RequestIdFilter(logging.Filter):
    """Attach the ambient request id to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get()  # type: ignore[attr-defined]
        return True


def _scrub_text(value: str) -> str:
    """Remove common personal-data patterns from ``value``."""
    protected_hosts: list[str] = []

    def _protect_host(match: re.Match[str]) -> str:
        protected_hosts.append(match.group(0))
        return f"__host{len(protected_hosts) - 1}__"

    scrubbed = _IPV4_RE.sub(_protect_host, value)
    scrubbed = _EMAIL_RE.sub("[REDACTED_EMAIL]", scrubbed)
    scrubbed = _PHONE_RE.sub("[REDACTED_PHONE]", scrubbed)
    scrubbed = _LONG_DIGITS_RE.sub("[REDACTED_NUMBER]", scrubbed)
    for index, host in enumerate(protected_hosts):
        scrubbed = scrubbed.replace(f"__host{index}__", host)
    return scrubbed


def _scrub_value(value: Any) -> Any:
    """Recursively scrub ``value``; never returns raw document content."""
    if isinstance(value, str):
        scrubbed = _scrub_text(value)
        if len(scrubbed) > MAX_LOG_MESSAGE_CHARS:
            scrubbed = (
                scrubbed[:MAX_LOG_MESSAGE_CHARS]
                + f"...{_TRUNCATION_SUFFIX} {len(scrubbed) - MAX_LOG_MESSAGE_CHARS} chars]"
            )
        return scrubbed
    if isinstance(value, (bytes, bytearray, memoryview)):
        return f"<{len(bytes(value))} bytes redacted>"
    if isinstance(value, Mapping):
        return {
            key: (REDACTED if str(key).lower() in SENSITIVE_KEY_HINTS else _scrub_value(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_scrub_value(item) for item in value]
    return value


class SensitiveDataFilter(logging.Filter):
    """Guarantee that no document content is emitted by a log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str) or (
            record.msg is not None and not isinstance(record.msg, (int, float, bool))
        ):
            record.msg = _scrub_value(record.msg)
        if record.args:
            if isinstance(record.args, Mapping):
                record.args = _scrub_value(record.args)
            elif isinstance(record.args, tuple):
                record.args = tuple(_scrub_value(arg) for arg in record.args)
        return True


class KeyValueFormatter(logging.Formatter):
    """Render records as ``ts level logger key=value ...`` lines."""

    default_time_format = "%Y-%m-%dT%H:%M:%S"
    default_msec_format = "%s.%03dZ"

    def __init__(self) -> None:
        super().__init__(datefmt=None, style="%")

    def formatTime(  # noqa: N802 - stdlib naming
        self, record: logging.LogRecord, datefmt: str | None = None  # noqa: ARG002
    ) -> str:
        moment = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return moment.strftime("%Y-%m-%dT%H:%M:%S") + f".{moment.microsecond // 1000:03d}Z"

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = [
            f"{key}={value!r}"
            for key, value in sorted(record.__dict__.items())
            if key not in _LOG_RECORD_SKIP_ATTRS
            and not key.startswith("_")
            and key != "request_id"
        ]
        if extras:
            return f"{base} request_id={record.__dict__.get('request_id', '-')} {' '.join(extras)}"
        return f"{base} request_id={record.__dict__.get('request_id', '-')}"


def configure_logging(level: str = "INFO", *, stream: TextIO | None = None) -> None:
    """Install the structured, redacting log handler on the root logger."""
    resolved = getattr(logging, str(level).upper(), logging.INFO)
    if not isinstance(resolved, int):
        resolved = logging.INFO

    handler = logging.StreamHandler(stream or sys.stdout)
    handler.setFormatter(KeyValueFormatter())
    handler.addFilter(RequestIdFilter())
    handler.addFilter(SensitiveDataFilter())

    root = logging.getLogger()
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(resolved)

    # Uvicorn ships its own colourised handler; route it through ours instead.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True


# --------------------------------------------------------------------------- #
# Text helpers
# --------------------------------------------------------------------------- #


def normalize_whitespace(text: str) -> str:
    """Normalise unicode, byte-order marks, line endings and whitespace runs."""
    if not text:
        return ""
    normalised = unicodedata.normalize("NFKC", text.replace("\ufeff", ""))
    normalised = normalised.replace("\r\n", "\n").replace("\r", "\n")
    normalised = _CONTROL_RE.sub(" ", normalised)
    normalised = _MULTI_SPACE_RE.sub(" ", normalised)
    normalised = _AROUND_NEWLINE_RE.sub("\n", normalised)
    normalised = _MULTI_NEWLINE_RE.sub("\n\n", normalised)
    return normalised.strip()


def human_size(num_bytes: int | float) -> str:
    """Format a byte count for log metadata only."""
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f}{unit}" if unit == "B" else f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}GB"


def format_size_limit(max_bytes: int) -> str:
    """Format a byte budget for error messages (``5 MB``, ``512 KB`` ...)."""
    if max_bytes >= 1024 * 1024:
        megabytes = max_bytes / (1024 * 1024)
        return f"{megabytes:g} MB" if megabytes != int(megabytes) else f"{int(megabytes)} MB"
    return f"{max_bytes} bytes"


def safe_filename(name: str | None) -> str:
    """Return a display-safe file name (never used for file-system access)."""
    if not name:
        return "upload"
    cleaned = name.replace("\\", "/").split("/")[-1].strip()
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", cleaned)
    return cleaned[:255] or "upload"


# --------------------------------------------------------------------------- #
# Coercion helpers (environment variables -> typed values)
# --------------------------------------------------------------------------- #

_TRUE_VALUES = frozenset({"1", "true", "t", "yes", "y", "on"})
_FALSE_VALUES = frozenset({"0", "false", "f", "no", "n", "off"})


def coerce_bool(value: Any, default: bool = False) -> bool:
    """Coerce ``value`` to ``bool``; unknown values fall back to ``default``."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in _TRUE_VALUES:
            return True
        if lowered in _FALSE_VALUES:
            return False
    return default


def coerce_int(value: Any, default: int) -> int:
    """Coerce ``value`` to ``int``; invalid values fall back to ``default``."""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def coerce_float(value: Any, default: float) -> float:
    """Coerce ``value`` to ``float``; invalid values fall back to ``default``."""
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def split_csv_list(value: Any) -> list[str]:
    """Split a comma-separated string into a list of non-empty items."""
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [part.strip() for part in str(value).split(",") if part.strip()]


# --------------------------------------------------------------------------- #
# File helpers (report files produced by the teammate)
# --------------------------------------------------------------------------- #


def read_json_file(path: Path) -> Any | None:
    """Return parsed JSON from ``path`` or ``None`` when missing/unreadable."""
    try:
        if not path.is_file():
            return None
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def read_csv_rows(path: Path, *, limit: int | None = None) -> list[dict[str, str]]:
    """Return CSV rows as dictionaries with stripped string values.

    Returns an empty list when the file does not exist, is empty or cannot be
    decoded. ``limit`` caps the number of rows (used for ``error_analysis.csv``).
    """
    if not path.is_file():
        return []
    rows: list[dict[str, str]] = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None:
                return []
            for raw_row in reader:
                rows.append(
                    {
                        str(key): ("" if value is None else str(value).strip())
                        for key, value in raw_row.items()
                        if key is not None
                    }
                )
                if limit is not None and len(rows) >= limit:
                    break
    except (OSError, UnicodeDecodeError, csv.Error):
        return []
    return rows


def first_present(mapping: Mapping[str, Any], keys: Iterable[str]) -> Any | None:
    """Return the first non-``None`` value among ``keys`` in ``mapping``."""
    for key in keys:
        if key in mapping and mapping[key] is not None:
            return mapping[key]
    return None
