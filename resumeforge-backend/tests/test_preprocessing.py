"""Tests for :func:`src.preprocessing.clean_text`.

The reference strings double as a **drift detector**: if somebody edits
``clean_text`` without intending to change the training-time behaviour, these
tests fail and the change has to be justified (and ``PREPROCESSING_VERSION``
bumped).
"""

from __future__ import annotations

import pytest

from src.preprocessing import PREPROCESSING_VERSION, clean_text, get_cleaner, strip_html_tags

TECH_INPUT = (
    "C++ and C# developer with .NET, Node.js, SQL, AWS, TensorFlow and NLP skills."
)

#: ``(raw input, expected output)`` pairs for the default implementation.
REFERENCE_CASES: tuple[tuple[str, str], ...] = (
    (
        TECH_INPUT,
        "c++ and c# developer with .net node.js sql aws tensorflow and nlp skills.",
    ),
    (
        "ASP.NET MVC developer, C++/CLI and Objective-C on macOS; scikit-learn, TensorFlow.",
        "asp.net mvc developer c++ cli and objective-c on macos scikit-learn tensorflow.",
    ),
    (
        "Contact: jane.doe@example.com or visit https://example.com/cv?id=42 (web)",
        "contact email or visit url web",
    ),
    (
        "Phone: +1 (555) 123-4567 and 020 7946 0958, email a.b@sub.domain.co.uk",
        "phone phone and phone email email",
    ),
    (
        "Machine   Learning\r\n\r\n\r\n\r\nEngineer   with\t\ttabs",
        "machine learning\n\nengineer with tabs",
    ),
    (
        "Senior Data Scientist\nPython, SQL, AWS",
        "senior data scientist\npython sql aws",
    ),
)


@pytest.mark.parametrize(("raw", "expected"), REFERENCE_CASES)
def test_clean_text_matches_reference_strings(raw: str, expected: str) -> None:
    """The default cleaning pipeline must stay reproducible."""
    assert clean_text(raw) == expected


@pytest.mark.parametrize(
    "token",
    ["c++", "c#", ".net", "node.js", "sql", "aws", "tensorflow", "nlp"],
)
def test_technical_tokens_are_preserved(token: str) -> None:
    """Stack-specific tokens must survive cleaning (upper and lower case)."""
    for raw in (token.upper(), token, token.title()):
        assert token in clean_text(f"experience with {raw} in production systems")


def test_technical_tokens_are_not_split_by_punctuation_removal() -> None:
    """``C++``/``C#`` keep their symbols; surrounding commas do not matter."""
    cleaned = clean_text("C++, C#, .NET; Node.js | SQL, AWS")
    assert "c++" in cleaned
    assert "c#" in cleaned
    assert ".net" in cleaned
    assert "node.js" in cleaned


def test_urls_emails_and_phones_are_replaced() -> None:
    """Personal contact data never reaches the vectorizer."""
    cleaned = clean_text(
        "Reach me at jane.doe@example.com, https://linkedin.com/in/janedoe or "
        "+1 (555) 010-2030."
    )
    assert "jane.doe@example.com" not in cleaned
    assert "linkedin.com" not in cleaned
    assert "555" not in cleaned
    assert "email" in cleaned
    assert "url" in cleaned


def test_html_markup_and_entities_are_removed() -> None:
    """The dataset stores an HTML column; its markup must not reach the model."""
    cleaned = clean_text(
        "<html><head><style>p{color:red}</style></head><body>"
        "<p>Senior&nbsp;Data&nbsp;Scientist</p><script>alert('x')</script>"
        "<ul><li>Python</li><li>SQL</li></ul></body></html>"
    )
    assert "<" not in cleaned
    assert ">" not in cleaned
    assert "alert" not in cleaned
    assert "senior data scientist" in cleaned.replace("\n", " ")


def test_unicode_is_normalised_and_accents_kept() -> None:
    """NFKC normalisation without destroying meaningful characters."""
    assert clean_text("Caf\u00e9 na\u00efve r\u00e9sum\u00e9") == (
        "caf\u00e9 na\u00efve r\u00e9sum\u00e9"
    )


def test_lowercasing_and_whitespace_collapsing() -> None:
    """Output is lower-case with collapsed whitespace and no leading/trailing blanks."""
    cleaned = clean_text("   DATA    SCIENTIST \n\n\n PYTHON   ")
    assert cleaned == "data scientist\n\npython"
    assert cleaned == cleaned.strip()


def test_line_breaks_are_preserved_as_single_newlines() -> None:
    """Paragraph structure is kept, blank-line runs are collapsed."""
    assert clean_text("Header\n\n\n\nBody") == "header\n\nbody"


@pytest.mark.parametrize("value", [None, "", "   ", "\n\t"])
def test_empty_like_inputs_return_empty_string(value: object) -> None:
    """Empty input never raises and never returns whitespace."""
    assert clean_text(value) == ""  # type: ignore[arg-type]


def test_non_string_inputs_are_coerced() -> None:
    """Numbers, bytes and objects are coerced instead of raising."""
    assert clean_text(1234) == "1234"  # type: ignore[arg-type]
    assert "python" in clean_text(b"Python developer")  # type: ignore[arg-type]
    assert clean_text(42.5) == "42.5"  # type: ignore[arg-type]


def test_cleaning_is_idempotent() -> None:
    """Cleaning twice must not change the text (no double substitution)."""
    once = clean_text(TECH_INPUT)
    assert clean_text(once) == once


def test_get_cleaner_respects_the_switch() -> None:
    """``APPLY_EXTERNAL_PREPROCESSING=false`` bypasses the cleaning entirely."""
    raw = "  <b>MiXeD</b> Case  "
    assert get_cleaner(True)(raw) == "mixed case"
    assert get_cleaner(False)(raw) == raw


def test_strip_html_tags_is_usable_standalone() -> None:
    """The HTML helper is exported for reuse in notebooks."""
    assert strip_html_tags("<p>Data&nbsp;Scientist</p>").strip() == "Data\u00a0Scientist"


def test_preprocessing_version_is_exposed() -> None:
    """``/model-info`` reports this marker, so drift stays traceable."""
    assert PREPROCESSING_VERSION == "default-v1"
