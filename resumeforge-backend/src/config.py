"""Project paths, shared constants and the canonical settings defaults.

This module is the single source of truth for every default value used by the
service. ``api.settings.Settings`` imports these defaults so the API layer and
the ``src`` layer can never drift apart, while ``src`` stays importable on its
own (no dependency on FastAPI or the API package).

Relative artifact paths (``models/model.joblib`` ...) are resolved against
:data:`BASE_DIR`, which is the backend project directory. Set the environment
variable ``RESUMEFORGE_BASE_DIR`` to relocate the project root (used by the
Docker image, where the code lives in ``/app``).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

from src.utils import coerce_bool, coerce_float, coerce_int, split_csv_list

__all__ = [
    "API_DESCRIPTION",
    "API_TITLE",
    "API_VERSION",
    "APP_NAME",
    "BASE_DIR",
    "MAX_BATCH_ITEMS",
    "MAX_TOP_K",
    "MIN_TOP_K",
    "PROJECT_ROOT",
    "REPORT_FILENAMES",
    "RESPONSIBLE_AI_NOTICE",
    "RuntimeConfig",
    "SETTING_DEFAULTS",
    "SETTINGS_DESCRIPTIONS",
    "SettingsLike",
    "SUPPORTED_UPLOAD_EXTENSIONS",
    "max_upload_bytes",
    "resolve_path",
]

PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent


def _resolve_base_dir() -> Path:
    """Return the directory that relative artifact paths are resolved against."""
    override = os.getenv("RESUMEFORGE_BASE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return PROJECT_ROOT


BASE_DIR: Path = _resolve_base_dir()

# --------------------------------------------------------------------------- #
# Request limits
# --------------------------------------------------------------------------- #

SUPPORTED_UPLOAD_EXTENSIONS: tuple[str, ...] = (".pdf", ".docx", ".txt")
MIN_TOP_K = 1
MAX_TOP_K = 10
MAX_BATCH_ITEMS = 20

# --------------------------------------------------------------------------- #
# Application metadata
# --------------------------------------------------------------------------- #

APP_NAME = "resumeforge-backend"
API_TITLE = "ResumeForge API"
API_VERSION = "1.0.0"
RESPONSIBLE_AI_NOTICE = (
    "This system is intended for resume classification/organization and should not be "
    "used as the sole basis for employment decisions."
)
API_DESCRIPTION = f"""
Inference-only HTTP API for **ResumeForge**, the resume classification system built for the
SAMATRIX RESUMEFORGE 2026 hackathon.

The service loads a pre-trained **TF-IDF (1-2 grams) + Logistic Regression** artifact
produced by the training pipeline and exposes it as a stateless JSON API.

**What the endpoints do**

* `POST /predict` - classify a resume sent either as `multipart/form-data`
  (`file` field: PDF / DOCX / TXT) or as `application/json` (`{{"text": "..."}}`).
* `POST /predict/batch` - classify up to {MAX_BATCH_ITEMS} text items in one call.
* `GET /health`, `GET /classes`, `GET /model-info` - service and artifact introspection.
* `GET /results` - evaluation artefacts that were produced during training and that actually
  exist in the reports directory. Missing files are reported as empty, never invented.

**Privacy**

Uploads are parsed in memory only and are never written to disk, and resume content is never
logged. Logs contain request metadata only (request id, endpoint, status, latency, sizes).

**Responsible AI**

{RESPONSIBLE_AI_NOTICE}

Logistic Regression probabilities are only *roughly* calibrated; treat `confidence` as a
relative ranking signal rather than a calibrated likelihood, and keep a human in the loop.
"""

# --------------------------------------------------------------------------- #
# Report files
# --------------------------------------------------------------------------- #

#: Report files the teammate may drop into ``REPORTS_DIR`` (all optional).
REPORT_FILENAMES: Mapping[str, str] = {
    "model_results": "model_results.csv",
    "per_class_metrics": "per_class_metrics.csv",
    "confusion_matrix": "confusion_matrix.json",
    "error_analysis": "error_analysis.csv",
}
MAX_ERROR_ANALYSIS_ROWS = 200

# --------------------------------------------------------------------------- #
# Settings defaults - single source of truth
# --------------------------------------------------------------------------- #

SETTING_DEFAULTS: Mapping[str, Any] = {
    "MODEL_PATH": "models/model.joblib",
    "VECTORIZER_PATH": "models/vectorizer.joblib",
    "CLASSIFIER_PATH": "models/classifier.joblib",
    "LABEL_ENCODER_PATH": "models/label_encoder.joblib",
    "MODEL_METADATA_PATH": "models/metadata.json",
    "REPORTS_DIR": "reports",
    "ALLOWED_ORIGINS": "http://localhost:5173",
    "MAX_UPLOAD_MB": 5,
    "MAX_TEXT_CHARS": 100_000,
    "MIN_TEXT_CHARS": 50,
    "TOP_K": 5,
    "CONFIDENCE_THRESHOLD": 0.5,
    "APPLY_EXTERNAL_PREPROCESSING": True,
    "RATE_LIMIT": "30/minute",
    "LOG_LEVEL": "INFO",
    "ENVIRONMENT": "development",
}

SETTINGS_DESCRIPTIONS: Mapping[str, str] = {
    "MODEL_PATH": "Full fitted sklearn Pipeline (vectorizer + classifier) as .joblib.",
    "VECTORIZER_PATH": "Standalone fitted TfidfVectorizer; used only when MODEL_PATH is absent.",
    "CLASSIFIER_PATH": "Standalone fitted LogisticRegression; used only when MODEL_PATH is absent.",
    "LABEL_ENCODER_PATH": "Optional fitted LabelEncoder used to map class indices to names.",
    "MODEL_METADATA_PATH": "Optional JSON with training metadata (versions, date, model name).",
    "REPORTS_DIR": "Directory holding the optional evaluation report files.",
    "ALLOWED_ORIGINS": "Comma-separated list of browser origins allowed by CORS.",
    "MAX_UPLOAD_MB": "Maximum accepted upload size in megabytes.",
    "MAX_TEXT_CHARS": "Maximum accepted resume text length in characters.",
    "MIN_TEXT_CHARS": "Minimum accepted resume text length in characters.",
    "TOP_K": "Default number of ranked alternatives returned by /predict.",
    "CONFIDENCE_THRESHOLD": "Confidence below which a prediction is flagged low_confidence.",
    "APPLY_EXTERNAL_PREPROCESSING": (
        "Apply clean_text before inference; disable when the pipeline already cleans."
    ),
    "RATE_LIMIT": "slowapi rate limit applied to /predict and /predict/batch, e.g. '30/minute'.",
    "LOG_LEVEL": "Python logging level name, e.g. DEBUG, INFO, WARNING, ERROR.",
    "ENVIRONMENT": "Deployment environment label, e.g. development or production.",
}

_BOOL_FIELDS = frozenset({"APPLY_EXTERNAL_PREPROCESSING"})
_FLOAT_FIELDS = frozenset({"CONFIDENCE_THRESHOLD"})
_INT_FIELDS = frozenset({"MAX_UPLOAD_MB", "MAX_TEXT_CHARS", "MIN_TEXT_CHARS", "TOP_K"})
_LIST_FIELDS = frozenset({"ALLOWED_ORIGINS"})


def resolve_path(value: str | os.PathLike[str]) -> Path:
    """Resolve ``value`` against :data:`BASE_DIR` when it is relative."""
    candidate = Path(str(value)).expanduser()
    if candidate.is_absolute():
        return candidate
    return (BASE_DIR / candidate).resolve()


def max_upload_bytes(settings: SettingsLike) -> int:
    """Return the configured upload limit in bytes."""
    return int(float(settings.MAX_UPLOAD_MB) * 1024 * 1024)


@runtime_checkable
class SettingsLike(Protocol):
    """Structural type implemented by ``api.settings.Settings``.

    ``src`` modules depend on this protocol only, so they can also be used from
    the CLI with :class:`RuntimeConfig`.
    """

    MODEL_PATH: str
    VECTORIZER_PATH: str
    CLASSIFIER_PATH: str
    LABEL_ENCODER_PATH: str
    MODEL_METADATA_PATH: str
    REPORTS_DIR: str
    ALLOWED_ORIGINS: Any
    MAX_UPLOAD_MB: float
    MAX_TEXT_CHARS: int
    MIN_TEXT_CHARS: int
    TOP_K: int
    CONFIDENCE_THRESHOLD: float
    APPLY_EXTERNAL_PREPROCESSING: bool
    RATE_LIMIT: str
    LOG_LEVEL: str
    ENVIRONMENT: str


def _coerce_setting(name: str, raw: Any) -> Any:
    """Coerce a raw environment value to the type of its default."""
    default = SETTING_DEFAULTS[name]
    if name in _BOOL_FIELDS:
        return coerce_bool(raw, bool(default))
    if name in _FLOAT_FIELDS:
        return coerce_float(raw, float(default))
    if name in _INT_FIELDS:
        return coerce_int(raw, int(default))
    if name in _LIST_FIELDS:
        return split_csv_list(raw)
    return str(raw)


class RuntimeConfig:
    """Environment-backed settings used when no ``Settings`` object is given.

    The CLI (``python -m src.predict``) and the tests use this class; the API
    layer always injects ``api.settings.Settings``.
    """

    __slots__ = tuple(SETTING_DEFAULTS)

    def __init__(self, values: Mapping[str, Any] | None = None, **overrides: Any) -> None:
        merged: dict[str, Any] = dict(values or {})
        merged.update(overrides)
        for name, default in SETTING_DEFAULTS.items():
            raw = merged.get(name)
            if raw is None:
                raw = os.getenv(name, default)
            object.__setattr__(self, name, _coerce_setting(name, raw))

    @classmethod
    def from_env(cls) -> RuntimeConfig:
        """Build a configuration purely from environment variables."""
        return cls()

    def __repr__(self) -> str:
        rendered = ", ".join(f"{name}={getattr(self, name)!r}" for name in SETTING_DEFAULTS)
        return f"{type(self).__name__}({rendered})"
