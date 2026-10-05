"""Shared dependencies: settings access, model access, rate limiting, request ids.

Nothing here touches FastAPI's dependency injection system for the model on
purpose: the classifier is loaded **once** during the application lifespan and
stored on ``app.state``, so every request reuses the same in-memory artifact.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.errors import ModelUnavailableError
from api.settings import Settings
from src.predict import ResumeClassifier
from src.utils import current_request_id

__all__ = [
    "build_limiter",
    "get_request_id",
    "get_settings_from_state",
    "rate_limit",
    "require_classifier",
]

#: ``app.state`` attribute names (kept in one place to avoid typos).
CLASSIFIER_ATTR = "classifier"
MODEL_ERROR_ATTR = "model_error"
SETTINGS_ATTR = "settings"

MODEL_NOT_LOADED_MESSAGE = (
    "The classification model is not loaded. Place the trained artifacts in the models "
    "directory and restart the API; check /health and the API logs for details."
)


def build_limiter() -> Limiter:
    """Create a slowapi limiter keyed by the client IP address."""
    return Limiter(key_func=get_remote_address, default_limits=[], headers_enabled=False)


def rate_limit(limit: str, limiter_instance: Limiter) -> Callable[[Any], Any]:
    """Return the slowapi decorator enforcing ``limit`` on an endpoint.

    The limit is read from the settings of the application that owns the router,
    so tests can create an app with a tiny limit without touching the global
    configuration.
    """

    def decorator(func: Any) -> Any:
        return limiter_instance.limit(limit, key_func=get_remote_address)(func)

    return decorator


def get_request_id(request: Request) -> str:
    """Return the request id assigned by the middleware.

    Prefers the value stored on the ASGI scope and falls back to the ambient
    context variable (useful inside background tasks).
    """
    return str(getattr(request.state, "request_id", None) or current_request_id())


def get_settings_from_state(request: Request) -> Settings:
    """Return the settings attached to the running application."""
    settings = getattr(request.app.state, SETTINGS_ATTR, None)
    if settings is None:  # pragma: no cover - create_app always sets it
        from api.settings import get_settings

        settings = get_settings()
        request.app.state.settings = settings
    return settings


def require_classifier(request: Request) -> ResumeClassifier:
    """Return the loaded classifier or raise a 503-mapped :class:`AppError`."""
    classifier = getattr(request.app.state, CLASSIFIER_ATTR, None)
    if classifier is None:
        raise ModelUnavailableError(MODEL_NOT_LOADED_MESSAGE)
    return classifier
