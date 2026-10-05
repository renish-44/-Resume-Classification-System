"""ResumeForge HTTP API (FastAPI application, routing and schemas).

The package is a thin transport layer: it parses requests, delegates to
:mod:`src` (extraction, preprocessing, prediction) and serialises results. All
business logic lives in ``src`` so it can be tested without FastAPI and reused
from the CLI.
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "1.0.0"
