"""Application settings, loaded from environment variables and an optional ``.env``.

Every value can be set as an environment variable (upper-case name) or in the
``.env`` file next to the project root. The defaults live in
:data:`src.config.SETTING_DEFAULTS` so the API layer and the ``src`` layer can
never drift apart.

The full table (name, default, meaning) is reproduced in ``README.md`` and
``.env.example``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from src.config import (
    BASE_DIR,
    SETTING_DEFAULTS,
    SETTINGS_DESCRIPTIONS,
    SettingsLike,
    max_upload_bytes,
    resolve_path,
)
from src.utils import split_csv_list

__all__ = ["ENV_FILE", "Settings", "get_settings", "reset_settings"]

ENV_FILE: Path = BASE_DIR / ".env"
"""Location of the optional ``.env`` file (resolved, never hard-coded)."""


class Settings(BaseSettings):
    """Runtime configuration of the API.

    Attributes
    ----------
    MODEL_PATH:
        Full fitted ``sklearn`` pipeline (``vectorizer`` + ``classifier``).
    VECTORIZER_PATH:
        Standalone fitted vectorizer; only used when ``MODEL_PATH`` is absent.
    CLASSIFIER_PATH:
        Standalone fitted classifier; only used when ``MODEL_PATH`` is absent.
    LABEL_ENCODER_PATH:
        Optional ``LabelEncoder`` used to name the class indices.
    MODEL_METADATA_PATH:
        Optional JSON metadata produced during training.
    REPORTS_DIR:
        Directory with the optional evaluation report files.
    ALLOWED_ORIGINS:
        Browser origins allowed by CORS.
    MAX_UPLOAD_MB:
        Maximum upload size in megabytes.
    MAX_TEXT_CHARS:
        Maximum accepted resume text length.
    MIN_TEXT_CHARS:
        Minimum accepted resume text length.
    TOP_K:
        Default number of ranked alternatives.
    CONFIDENCE_THRESHOLD:
        Threshold below which a prediction is flagged ``low_confidence``.
    APPLY_EXTERNAL_PREPROCESSING:
        Run ``clean_text`` before inference. Disable when the saved pipeline
        already cleans the text.
    RATE_LIMIT:
        slowapi limit applied to ``/predict`` and ``/predict/batch``.
    LOG_LEVEL:
        Logging level name.
    ENVIRONMENT:
        Deployment label, e.g. ``development`` or ``production``.
    """

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        validate_assignment=True,
    )

    MODEL_PATH: str = Field(
        default=SETTING_DEFAULTS["MODEL_PATH"],
        description=SETTINGS_DESCRIPTIONS["MODEL_PATH"],
    )
    VECTORIZER_PATH: str = Field(
        default=SETTING_DEFAULTS["VECTORIZER_PATH"],
        description=SETTINGS_DESCRIPTIONS["VECTORIZER_PATH"],
    )
    CLASSIFIER_PATH: str = Field(
        default=SETTING_DEFAULTS["CLASSIFIER_PATH"],
        description=SETTINGS_DESCRIPTIONS["CLASSIFIER_PATH"],
    )
    LABEL_ENCODER_PATH: str = Field(
        default=SETTING_DEFAULTS["LABEL_ENCODER_PATH"],
        description=SETTINGS_DESCRIPTIONS["LABEL_ENCODER_PATH"],
    )
    MODEL_METADATA_PATH: str = Field(
        default=SETTING_DEFAULTS["MODEL_METADATA_PATH"],
        description=SETTINGS_DESCRIPTIONS["MODEL_METADATA_PATH"],
    )
    REPORTS_DIR: str = Field(
        default=SETTING_DEFAULTS["REPORTS_DIR"],
        description=SETTINGS_DESCRIPTIONS["REPORTS_DIR"],
    )
    ALLOWED_ORIGINS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: split_csv_list(SETTING_DEFAULTS["ALLOWED_ORIGINS"]),
        description=SETTINGS_DESCRIPTIONS["ALLOWED_ORIGINS"],
    )
    MAX_UPLOAD_MB: float = Field(
        default=SETTING_DEFAULTS["MAX_UPLOAD_MB"],
        gt=0,
        description=SETTINGS_DESCRIPTIONS["MAX_UPLOAD_MB"],
    )
    MAX_TEXT_CHARS: int = Field(
        default=SETTING_DEFAULTS["MAX_TEXT_CHARS"],
        gt=0,
        description=SETTINGS_DESCRIPTIONS["MAX_TEXT_CHARS"],
    )
    MIN_TEXT_CHARS: int = Field(
        default=SETTING_DEFAULTS["MIN_TEXT_CHARS"],
        ge=1,
        description=SETTINGS_DESCRIPTIONS["MIN_TEXT_CHARS"],
    )
    TOP_K: int = Field(
        default=SETTING_DEFAULTS["TOP_K"],
        ge=1,
        le=10,
        description=SETTINGS_DESCRIPTIONS["TOP_K"],
    )
    CONFIDENCE_THRESHOLD: float = Field(
        default=SETTING_DEFAULTS["CONFIDENCE_THRESHOLD"],
        ge=0.0,
        le=1.0,
        description=SETTINGS_DESCRIPTIONS["CONFIDENCE_THRESHOLD"],
    )
    APPLY_EXTERNAL_PREPROCESSING: bool = Field(
        default=SETTING_DEFAULTS["APPLY_EXTERNAL_PREPROCESSING"],
        description=SETTINGS_DESCRIPTIONS["APPLY_EXTERNAL_PREPROCESSING"],
    )
    RATE_LIMIT: str = Field(
        default=SETTING_DEFAULTS["RATE_LIMIT"],
        description=SETTINGS_DESCRIPTIONS["RATE_LIMIT"],
    )
    LOG_LEVEL: str = Field(
        default=SETTING_DEFAULTS["LOG_LEVEL"],
        description=SETTINGS_DESCRIPTIONS["LOG_LEVEL"],
    )
    ENVIRONMENT: str = Field(
        default=SETTING_DEFAULTS["ENVIRONMENT"],
        description=SETTINGS_DESCRIPTIONS["ENVIRONMENT"],
    )

    # ------------------------------------------------------------------ #
    # Validators
    # ------------------------------------------------------------------ #

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> list[str]:
        """Accept ``"http://a,http://b"`` as well as a JSON list."""
        if isinstance(value, (list, tuple, set)):
            return split_csv_list(list(value))
        if isinstance(value, str):
            return split_csv_list(value)
        return split_csv_list(SETTING_DEFAULTS["ALLOWED_ORIGINS"])

    @field_validator("LOG_LEVEL", mode="before")
    @classmethod
    def _upper_log_level(cls, value: Any) -> str:
        """Normalise the log level name."""
        return str(value).strip().upper() or str(SETTING_DEFAULTS["LOG_LEVEL"])

    # ------------------------------------------------------------------ #
    # Derived paths
    # ------------------------------------------------------------------ #

    @property
    def resolved_model_path(self) -> Path:
        """Absolute path of the pipeline artifact."""
        return resolve_path(self.MODEL_PATH)

    @property
    def resolved_vectorizer_path(self) -> Path:
        """Absolute path of the standalone vectorizer artifact."""
        return resolve_path(self.VECTORIZER_PATH)

    @property
    def resolved_classifier_path(self) -> Path:
        """Absolute path of the standalone classifier artifact."""
        return resolve_path(self.CLASSIFIER_PATH)

    @property
    def resolved_label_encoder_path(self) -> Path:
        """Absolute path of the optional label encoder."""
        return resolve_path(self.LABEL_ENCODER_PATH)

    @property
    def resolved_metadata_path(self) -> Path:
        """Absolute path of the optional metadata JSON."""
        return resolve_path(self.MODEL_METADATA_PATH)

    @property
    def resolved_reports_dir(self) -> Path:
        """Absolute path of the reports directory."""
        return resolve_path(self.REPORTS_DIR)

    @property
    def max_upload_bytes(self) -> int:
        """Upload limit in bytes."""
        return max_upload_bytes(self)


_SETTINGS_CACHE: dict[str, Settings] = {}


def _assert_structural_type() -> None:
    """Fail fast if ``Settings`` stops matching the ``src`` protocol."""
    _structural_check: type[SettingsLike] = Settings


_assert_structural_type()


def get_settings() -> Settings:
    """Return the process-wide settings instance (created on first use)."""
    cached = _SETTINGS_CACHE.get("settings")
    if cached is None:
        cached = Settings()
        _SETTINGS_CACHE["settings"] = cached
    return cached


def reset_settings() -> None:
    """Forget the cached settings so the next call re-reads the environment."""
    _SETTINGS_CACHE.clear()
