"""Text cleaning applied *before* inference.

.. warning::

   **REPLACE THE BODY OF ``clean_text`` WITH THE EXACT PREPROCESSING USED
   DURING TRAINING.**

   This is the single most important integration point of the backend. A
   TF-IDF + Logistic Regression model only understands the text it was fitted
   on: if training lower-cased, stripped HTML and replaced URLs, inference must
   do the same, otherwise the vocabulary lookups miss and the accuracy drops
   silently. Copy the training function verbatim (including regexes, stop-word
   handling and the final whitespace normalisation), then bump
   :data:`PREPROCESSING_VERSION` so ``/model-info`` shows the new value.

The default implementation below is a *sensible, documented fallback* that
keeps the API runnable before the teammate's version is pasted in. It is
deliberately conservative: it never removes meaningful punctuation, and it
protects technical tokens such as ``C++``, ``C#``, ``.NET``, ``Node.js``,
``SQL``, ``AWS``, ``TensorFlow`` and ``NLP`` from mangling.

If the saved pipeline already performs cleaning (a ``FunctionTransformer`` or a
custom analyzer), set ``APPLY_EXTERNAL_PREPROCESSING=false`` so this module is
skipped entirely and the raw text is handed to the vectorizer.
"""

from __future__ import annotations

import html as html_module
import re
from collections.abc import Callable
from typing import Final

from src.utils import normalize_whitespace

__all__ = [
    "PREPROCESSING_VERSION",
    "TECHNICAL_TOKENS",
    "clean_text",
    "get_cleaner",
    "strip_html_tags",
]

# --------------------------------------------------------------------------- #
# Version marker
# --------------------------------------------------------------------------- #

PREPROCESSING_VERSION: Final[str] = "default-v1"
"""Identifier returned by ``/model-info``; bump it when ``clean_text`` changes."""

# --------------------------------------------------------------------------- #
# Technical token protection
# --------------------------------------------------------------------------- #

_SENTINEL_START = "\ue000"
_SENTINEL_END = "\ue001"

#: Technical tokens that must survive cleaning verbatim (matched case-insensitively
#: unless the pattern itself carries a required case).
TECHNICAL_TOKENS: Final[tuple[str, ...]] = (
    "C++",
    "C#",
    ".NET",
    "ASP.NET",
    "Node.js",
    "NodeJS",
    "Objective-C",
    "TensorFlow",
    "PyTorch",
    "scikit-learn",
    "NumPy",
    "Pandas",
    "JavaScript",
    "TypeScript",
    "PostgreSQL",
    "SQL",
    "AWS",
    "NLP",
)

# Longest patterns first so that "ASP.NET" wins over ".NET" and "Node.js" over "C".
_TOKEN_BOUNDARY_BEFORE = r"(?<![A-Za-z0-9])"
_TOKEN_BOUNDARY_AFTER = r"(?![A-Za-z0-9])"
_TECH_TOKEN_RE: Final[re.Pattern[str]] = re.compile(
    "|".join(
        _TOKEN_BOUNDARY_BEFORE + re.escape(token) + _TOKEN_BOUNDARY_AFTER
        for token in sorted(TECHNICAL_TOKENS, key=len, reverse=True)
    ),
    re.IGNORECASE,
)

# --------------------------------------------------------------------------- #
# Patterns
# --------------------------------------------------------------------------- #

_URL_RE: Final[re.Pattern[str]] = re.compile(
    r"\b(?:https?://|www\.|ftp://)\S+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|dev|ai|co|edu|gov)\b\S*",
    re.IGNORECASE,
)
_EMAIL_RE: Final[re.Pattern[str]] = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)
_PHONE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?<![\w.])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\w)"
)
_SCRIPT_RE: Final[re.Pattern[str]] = re.compile(
    r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
_HTML_COMMENT_RE: Final[re.Pattern[str]] = re.compile(r"<!--.*?-->", re.DOTALL)
_HTML_BREAK_RE: Final[re.Pattern[str]] = re.compile(
    r"<\s*(?:br|/p|/div|/li|/tr|/h[1-6]|hr)\s*/?\s*>", re.IGNORECASE
)
_HTML_TAG_RE: Final[re.Pattern[str]] = re.compile(r"<[^<>]{0,400}>")
_BULLET_RE: Final[re.Pattern[str]] = re.compile(r"(?m)^\s*[•▪◦‣·*\-–—]+\s*", re.UNICODE)
_MOJIBAKE_RE: Final[re.Pattern[str]] = re.compile(r"(?:Ã.|Â.|â€.|â€™|â€œ|â€|â€“|â€”|ðŸ|ï»¿)")
_KEEP_CHARS_RE: Final[re.Pattern[str]] = re.compile(r"[^#+\s_.\-\w]", re.UNICODE)
_REPEATED_PUNCT_RE: Final[re.Pattern[str]] = re.compile(r"[.\-_]{2,}")


def strip_html_tags(text: str) -> str:
    """Remove HTML/XML markup and unescape entities (``Resume_html`` support)."""
    if not text:
        return ""
    without_scripts = _SCRIPT_RE.sub(" ", text)
    without_comments = _HTML_COMMENT_RE.sub(" ", without_scripts)
    with_breaks = _HTML_BREAK_RE.sub("\n", without_comments)
    without_tags = _HTML_TAG_RE.sub(" ", with_breaks)
    return html_module.unescape(without_tags)


def _repair_mojibake(text: str) -> str:
    """Best-effort repair of UTF-8 bytes decoded as latin-1/cp1252."""
    if not _MOJIBAKE_RE.search(text):
        return text
    for codec in ("cp1252", "latin-1"):
        try:
            repaired = text.encode(codec, errors="strict").decode("utf-8", errors="strict")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if _MOJIBAKE_RE.search(repaired) is None:
            return repaired
    return text


def _coerce_to_text(value: object) -> str:
    """Convert any input into a string without ever raising."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).decode("utf-8", errors="replace")
    return str(value)


def _protect_tokens(text: str) -> tuple[str, list[str]]:
    """Replace technical tokens with private sentinels."""
    protected: list[str] = []

    def _store(match: re.Match[str]) -> str:
        protected.append(match.group(0).lower())
        return f"{_SENTINEL_START}{len(protected) - 1}{_SENTINEL_END}"

    return _TECH_TOKEN_RE.sub(_store, text), protected


def _restore_tokens(text: str, protected: list[str]) -> str:
    """Undo :func:`_protect_tokens`, keeping the lowercase canonical form."""
    for index, token in enumerate(protected):
        text = text.replace(f"{_SENTINEL_START}{index}{_SENTINEL_END}", token)
    return text


def clean_text(text: str) -> str:
    """Normalise resume text so it matches the vectorizer's training input.

    Default pipeline (replace it with the training version):

    1. coerce non-string input (``None`` -> ``""``),
    2. repair mojibake and normalise unicode (NFKC) and line endings,
    3. strip HTML markup and unescape entities,
    4. protect technical tokens (``C++``, ``C#``, ``.NET``, ``Node.js`` ...),
    5. replace URLs, e-mail addresses and phone numbers with placeholders,
    6. lowercase and restore the protected technical tokens,
    7. drop remaining punctuation while keeping ``+``, ``#``, ``.``, ``-``,
    8. collapse whitespace.

    Parameters
    ----------
    text:
        Raw resume text (extracted from a document or sent as JSON ``text``).

    Returns
    -------
    str
        Cleaned text; ``""`` when the input is empty or unusable. Never raises.
    """
    # ======================================================================= #
    # REPLACE THE BODY OF clean_text WITH THE EXACT PREPROCESSING USED       #
    # DURING TRAINING.                                                        #
    #                                                                         #
    # 1. Open the training notebook / preprocessing module of your teammate.   #
    # 2. Copy the *entire* transformation chain used to build the              #
    #    ``Resume_str`` column the vectorizer was fitted on                    #
    #    (html stripping, url/email/phone handling, lower-casing, stop-words,  #
    #    punctuation rules, whitespace normalisation).                         #
    # 3. Paste it below, keeping the signature ``clean_text(text: str) -> str`` #
    #    and returning ``str`` (raise nothing).                                #
    # 4. Update PREPROCESSING_VERSION at the top of this module so that        #
    #    GET /model-info reports the change.                                    #
    # 5. Update tests/test_preprocessing.py reference strings to match.         #
    #                                                                         #
    # The implementation below is a runnable fallback, NOT the training one.   #
    # ======================================================================= #
    coerced = _coerce_to_text(text)
    if not coerced.strip():
        return ""

    working = _repair_mojibake(coerced)
    working = strip_html_tags(working)
    working = normalize_whitespace(working)

    protected_text, protected = _protect_tokens(working)
    protected_text = _EMAIL_RE.sub(" email ", protected_text)
    protected_text = _URL_RE.sub(" url ", protected_text)
    protected_text = _PHONE_RE.sub(" phone ", protected_text)
    protected_text = _BULLET_RE.sub(" ", protected_text)

    lowered = protected_text.lower()
    lowered = _restore_tokens(lowered, protected)
    lowered = _KEEP_CHARS_RE.sub(" ", lowered)
    lowered = _REPEATED_PUNCT_RE.sub(" ", lowered)
    return normalize_whitespace(lowered)


def get_cleaner(apply_external_preprocessing: bool) -> Callable[[str], str]:
    """Return the cleaner to use for inference.

    When ``apply_external_preprocessing`` is ``False`` the identity function is
    returned, because the saved pipeline is expected to clean the text itself.
    """

    def _passthrough(value: str) -> str:
        return value

    return clean_text if apply_external_preprocessing else _passthrough
