"""ResumeForge inference backend (SAMATRIX RESUMEFORGE 2026).

This package is **inference only**. It contains no training, evaluation or
notebook code: the classifier is trained by a teammate and loaded from disk.

Modules
-------
``config``
    Project paths, shared constants and the canonical settings defaults.
``utils``
    Structured logging with PII redaction plus small shared helpers.
``preprocessing``
    ``clean_text`` - the function that must match the training pipeline.
``text_extraction``
    In-memory PDF / DOCX / TXT text extraction with strict validation.
``model_loader``
    Artifact discovery, loading and startup self-check.
``predict``
    :class:`~src.predict.ResumeClassifier` and a small CLI.
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "1.0.0"
