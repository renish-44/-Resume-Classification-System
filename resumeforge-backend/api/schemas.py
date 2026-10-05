"""Pydantic v2 request and response models (the public API contract).

Every response model documents its fields and carries an example so that the
interactive OpenAPI documentation (``/docs``) is directly usable by the frontend
team. Unavailable values are always ``null`` - never a fabricated number or a
placeholder metric.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from src.config import MAX_BATCH_ITEMS

__all__ = [
    "BATCH_REQUEST_EXAMPLE",
    "CLASSES_EXAMPLE",
    "BatchPredictionRequest",
    "ClassesResponse",
    "ConfusionMatrixResponse",
    "ERROR_EXAMPLE",
    "HEALTH_EXAMPLE",
    "ErrorResponse",
    "HealthResponse",
    "MODEL_INFO_EXAMPLE",
    "ModelInfoResponse",
    "PREDICTION_EXAMPLE",
    "PredictionResponse",
    "RESULTS_EXAMPLE",
    "TOP_PREDICTION_EXAMPLE",
    "ResultsResponse",
    "TopPredictionResponse",
]

ERROR_EXAMPLE: dict[str, Any] = {
    "error": "The provided text has 12 characters; at least 50 are required.",
    "code": "INPUT_TOO_SHORT",
    "request_id": "5f1c9a2b7d3e4f8a9b0c1d2e3f4a5b6c",
}

HEALTH_EXAMPLE: dict[str, Any] = {
    "status": "ok",
    "model_loaded": True,
    "model_name": "TfidfVectorizer+LogisticRegression",
    "version": "1.0.0",
}

CLASSES_EXAMPLE: dict[str, Any] = {
    "classes": ["Accounting", "Data Science", "Engineering"],
    "count": 3,
}

MODEL_INFO_EXAMPLE: dict[str, Any] = {
    "model_name": "TfidfVectorizer+LogisticRegression",
    "model_type": "sklearn_pipeline",
    "ngram_range": [1, 2],
    "num_classes": 3,
    "vocab_size": 120,
    "preprocessing_version": "default-v1",
    "sklearn_runtime_version": "1.5.2",
    "sklearn_trained_version": "1.5.2",
    "trained_date": "2026-01-15",
    "confidence_threshold": 0.5,
}

CONFUSION_MATRIX_EXAMPLE: dict[str, Any] = {
    "labels": ["Accounting", "Data Science", "Engineering"],
    "matrix": [[3, 0, 0], [0, 4, 1], [0, 1, 2]],
}

RESULTS_EXAMPLE: dict[str, Any] = {
    "available": True,
    "model_results": [{"model": "LogisticRegression", "macro_f1": "0.86"}],
    "per_class_metrics": [{"category": "Data Science", "f1": "0.91"}],
    "confusion_matrix": CONFUSION_MATRIX_EXAMPLE,
    "error_analysis": [],
}

TOP_PREDICTION_EXAMPLE: dict[str, Any] = {
    "category": "Data Science",
    "probability": 0.7412,
}

PREDICTION_EXAMPLE: dict[str, Any] = {
    "predicted_category": "Data Science",
    "confidence": 0.7412,
    "top_predictions": [
        {"category": "Data Science", "probability": 0.7412},
        {"category": "Engineering", "probability": 0.1533},
        {"category": "Accounting", "probability": 0.1055},
    ],
    "model": "TfidfVectorizer+LogisticRegression",
    "extracted_chars": 2481,
    "low_confidence": False,
}

BATCH_REQUEST_EXAMPLE: dict[str, Any] = {
    "texts": [
        "Data scientist with 4 years of experience in Python, pandas and SQL, building "
        "forecasting models for retail demand.",
        "Mechanical engineer with CAD, SolidWorks and manufacturing process improvement "
        "experience across two plants.",
    ]
}


class ErrorResponse(BaseModel):
    """Error envelope returned by every failing endpoint."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": ERROR_EXAMPLE,
            "description": "Uniform error envelope: a message, a machine code and the "
            "request id (also returned in the X-Request-ID response header).",
        }
    )

    error: str = Field(..., description="Human readable, user-safe error message.")
    code: str = Field(..., description="Stable SNAKE_CASE error code.")
    request_id: str = Field(..., description="Correlation id for the server logs.")


class HealthResponse(BaseModel):
    """Liveness and model status."""

    model_config = ConfigDict(json_schema_extra={"example": HEALTH_EXAMPLE})

    status: str = Field(..., description="'ok' while the process is serving requests.")
    model_loaded: bool = Field(..., description="True when the artifacts loaded at startup.")
    model_name: str | None = Field(
        default=None, description="Name of the loaded model, or null when unavailable."
    )
    version: str = Field(..., description="Backend version.")


class ClassesResponse(BaseModel):
    """The label set of the loaded model."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": CLASSES_EXAMPLE,
            "description": "Class names are taken from the loaded artifact, never from the "
            "API code.",
        }
    )

    classes: list[str] = Field(..., description="Ordered class labels of the model.")
    count: int = Field(..., description="Number of classes.")


class ModelInfoResponse(BaseModel):
    """Everything known about the loaded artifact."""

    model_config = ConfigDict(json_schema_extra={"example": MODEL_INFO_EXAMPLE})

    model_name: str | None = Field(
        default=None, description="Model name from metadata, or derived."
    )
    model_type: str | None = Field(
        default=None, description="sklearn_pipeline or vectorizer+classifier."
    )
    ngram_range: list[int] | None = Field(
        default=None, description="Vectorizer n-gram range, e.g. [1, 2]."
    )
    num_classes: int | None = Field(default=None, description="Number of classes.")
    vocab_size: int | None = Field(default=None, description="Vectorizer vocabulary size.")
    preprocessing_version: str = Field(
        default="default-v1", description="Version marker of the inference preprocessing."
    )
    sklearn_runtime_version: str = Field(default="", description="scikit-learn version in use.")
    sklearn_trained_version: str | None = Field(
        default=None, description="scikit-learn version recorded during training, if known."
    )
    trained_date: str | None = Field(
        default=None, description="Training date recorded in the metadata file, if present."
    )
    confidence_threshold: float = Field(
        default=0.5,
        description="Threshold below which low_confidence is true.",
    )


class ConfusionMatrixResponse(BaseModel):
    """Confusion matrix read from ``reports/confusion_matrix.json``."""

    model_config = ConfigDict(json_schema_extra={"example": CONFUSION_MATRIX_EXAMPLE})

    labels: list[str] = Field(..., description="Class labels; row = true, column = predicted.")
    matrix: list[list[int]] = Field(..., description="Row-major confusion matrix.")


class ResultsResponse(BaseModel):
    """Evaluation artefacts produced during training (never fabricated)."""

    model_config = ConfigDict(json_schema_extra={"example": RESULTS_EXAMPLE})

    available: bool = Field(
        ..., description="True when at least one report file was found and parsed."
    )
    model_results: list[dict[str, Any]] = Field(
        default_factory=list, description="Rows of reports/model_results.csv."
    )
    per_class_metrics: list[dict[str, Any]] = Field(
        default_factory=list, description="Rows of reports/per_class_metrics.csv."
    )
    confusion_matrix: ConfusionMatrixResponse | None = Field(
        default=None, description="Content of reports/confusion_matrix.json, when valid."
    )
    error_analysis: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Up to 200 rows of reports/error_analysis.csv.",
    )


class TopPredictionResponse(BaseModel):
    """One ranked alternative category."""

    model_config = ConfigDict(json_schema_extra={"example": TOP_PREDICTION_EXAMPLE})

    category: str = Field(..., description="Class name as reported by the model.")
    probability: float = Field(
        ..., ge=0.0, le=1.0, description="Probability, rounded to 4 decimals (roughly calibrated)."
    )


class PredictionResponse(BaseModel):
    """Result of a single classification."""

    model_config = ConfigDict(json_schema_extra={"example": PREDICTION_EXAMPLE})

    predicted_category: str = Field(..., description="Highest probability class.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Probability of the predicted class (0-1)."
    )
    top_predictions: list[TopPredictionResponse] = Field(
        ..., description="Ranked alternatives, highest probability first."
    )
    model: str = Field(..., description="Name of the model that produced the prediction.")
    extracted_chars: int = Field(
        ..., ge=0, description="Number of characters of the received resume text."
    )
    low_confidence: bool = Field(
        ..., description="True when confidence is below the configured threshold."
    )


class BatchPredictionRequest(BaseModel):
    """Body of ``POST /predict/batch``."""

    model_config = ConfigDict(json_schema_extra={"example": BATCH_REQUEST_EXAMPLE})

    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_ITEMS,
        description=f"Between 1 and {MAX_BATCH_ITEMS} resume texts.",
    )
