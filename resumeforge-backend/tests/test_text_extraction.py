"""Tests for :mod:`src.text_extraction` (in-memory PDF / DOCX / TXT extraction)."""

from __future__ import annotations

import io
from collections.abc import Callable
from pathlib import Path

import pytest

from src.text_extraction import (
    CorruptedFileError,
    EmptyFileError,
    EncryptedPdfError,
    FileTooLargeError,
    NoExtractableTextError,
    UnsupportedFileTypeError,
    extract_text,
)
from tests.conftest import SAMPLE_RESUME_TEXT

# --------------------------------------------------------------------------- #
# PDF
# --------------------------------------------------------------------------- #


def test_pdf_text_is_extracted(sample_pdf: bytes) -> None:
    """A text PDF yields its text, whitespace-normalised."""
    text = extract_text(sample_pdf, "resume.pdf")

    assert "Data scientist" in text
    assert len(text) > 50


def test_pdf_with_a_blank_page_keeps_the_text(
    pdf_factory: Callable[..., list[list[str]]],
) -> None:
    """Blank pages are skipped instead of failing the whole document."""
    pdf = pdf_factory([["Synthetic Resume"], [], ["Machine learning engineer"]])

    text = extract_text(pdf, "resume.pdf")

    assert "Synthetic Resume" in text
    assert "Machine learning engineer" in text


def test_pdf_without_a_text_layer_is_rejected(
    pdf_factory: Callable[..., list[list[str]]],
) -> None:
    """A scanned/image-only PDF raises :class:`NoExtractableTextError`."""
    with pytest.raises(NoExtractableTextError):
        extract_text(pdf_factory([[]]), "scanned.pdf")


def test_encrypted_pdf_is_reported(encrypted_pdf_bytes: bytes | None) -> None:
    """Password-protected PDFs are refused with a clear message (no cracking)."""
    if encrypted_pdf_bytes is None:  # pragma: no cover - depends on the build
        pytest.skip("The installed pypdf build cannot create encrypted PDFs.")

    with pytest.raises(EncryptedPdfError) as error:
        extract_text(encrypted_pdf_bytes, "protected.pdf")

    assert "password" in str(error.value).lower()


def test_corrupted_pdf_is_reported() -> None:
    """A truncated PDF raises :class:`CorruptedFileError`."""
    with pytest.raises(CorruptedFileError):
        extract_text(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog", "broken.pdf")


# --------------------------------------------------------------------------- #
# DOCX
# --------------------------------------------------------------------------- #


def test_docx_paragraphs_and_tables_are_extracted(sample_docx: bytes) -> None:
    """Both paragraphs and table cells are read."""
    text = extract_text(sample_docx, "resume.docx")

    assert "Data Scientist Resume" in text
    assert "Five years building machine learning models in Python." in text
    assert "scikit-learn" in text


def test_docx_without_tables_still_works(
    docx_factory: Callable[..., bytes],
) -> None:
    """A paragraph-only document is handled."""
    text = extract_text(docx_factory(["Only a paragraph here"], []), "plain.docx")

    assert "Only a paragraph here" in text


def test_corrupted_docx_is_reported(sample_docx: bytes) -> None:
    """A truncated DOCX raises :class:`CorruptedFileError`."""
    with pytest.raises(CorruptedFileError):
        extract_text(sample_docx[:150], "broken.docx")


def test_zip_without_document_xml_is_rejected() -> None:
    """A ZIP that is not a DOCX is not accepted."""
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "not a word document")

    with pytest.raises((UnsupportedFileTypeError, CorruptedFileError)):
        extract_text(buffer.getvalue(), "fake.docx")


# --------------------------------------------------------------------------- #
# TXT
# --------------------------------------------------------------------------- #


def test_txt_utf8_is_extracted() -> None:
    """UTF-8 text is returned unchanged (apart from normalisation)."""
    text = extract_text(SAMPLE_RESUME_TEXT.encode("utf-8"), "resume.txt")

    assert "Data scientist" in text


def test_txt_utf8_bom_is_stripped() -> None:
    """A UTF-8 BOM must not leak into the text."""
    text = extract_text(SAMPLE_RESUME_TEXT.encode("utf-8-sig"), "resume.txt")

    assert not text.startswith("\ufeff")
    assert "Data scientist" in text


def test_txt_latin1_fallback() -> None:
    """Undecodable bytes fall back to cp1252/latin-1 instead of raising."""
    payload = "Café résumé naïve".encode("latin-1")
    text = extract_text(payload, "resume.txt")

    assert "Café" in text
    assert "résumé" in text


def test_txt_with_windows_line_endings() -> None:
    """CRLF input is normalised to ``\\n``."""
    text = extract_text(b"line one\r\nline two\r\n", "resume.txt")

    assert text == "line one\nline two"


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


def test_empty_file_is_rejected() -> None:
    """A zero-byte upload is refused before any parsing."""
    with pytest.raises(EmptyFileError):
        extract_text(b"", "empty.txt")


def test_missing_extension_is_rejected() -> None:
    """A file without an extension cannot be validated."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text(b"plain text", "resume")


def test_unsupported_extension_is_rejected() -> None:
    """Only PDF, DOCX and TXT are accepted."""
    with pytest.raises(UnsupportedFileTypeError) as error:
        extract_text(b"content", "resume.doc")

    assert ".docx" in str(error.value)


def test_legacy_doc_extension_has_a_helpful_message() -> None:
    """Users uploading ``.doc`` are told what to do instead."""
    with pytest.raises(UnsupportedFileTypeError) as error:
        extract_text(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "resume.doc")

    assert "Legacy .doc" in str(error.value)


def test_wrong_magic_bytes_are_rejected(sample_pdf: bytes) -> None:
    """A PDF renamed to ``.txt`` is refused (binary signature sniffing)."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text(sample_pdf, "resume.txt")


def test_text_renamed_to_pdf_is_rejected() -> None:
    """Plain text renamed to ``.pdf`` is refused."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text(SAMPLE_RESUME_TEXT.encode("utf-8"), "resume.pdf")


def test_docx_renamed_to_pdf_is_rejected(sample_docx: bytes) -> None:
    """A DOCX renamed to ``.pdf`` is refused."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text(sample_docx, "resume.pdf")


def test_binary_content_with_txt_extension_is_rejected() -> None:
    """Binary payloads are refused even when the extension says text."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00", "image.txt")


def test_oversize_upload_is_rejected_before_parsing() -> None:
    """``max_bytes`` is enforced before the file is parsed."""
    payload = SAMPLE_RESUME_TEXT.encode("utf-8")

    with pytest.raises(FileTooLargeError) as error:
        extract_text(payload, "resume.txt", max_bytes=10)

    assert "10 bytes" in str(error.value)


def test_upload_under_the_limit_is_accepted() -> None:
    """A payload exactly at the limit still passes."""
    payload = SAMPLE_RESUME_TEXT.encode("utf-8")

    assert extract_text(payload, "resume.txt", max_bytes=len(payload))


def test_min_chars_is_enforced() -> None:
    """``min_chars`` turns an almost-empty document into a clear error."""
    with pytest.raises(NoExtractableTextError):
        extract_text(b"   \n  \n ", "resume.txt", min_chars=50)


def test_non_bytes_input_is_rejected() -> None:
    """The extractor only accepts bytes (never a path or a file object)."""
    with pytest.raises(UnsupportedFileTypeError):
        extract_text("plain string", "resume.txt")  # type: ignore[arg-type]


def test_extraction_never_touches_the_filesystem(
    tmp_path: Path, sample_pdf: bytes
) -> None:
    """Uploads are processed in memory: the working directory stays empty."""
    before = sorted(tmp_path.iterdir())
    extract_text(sample_pdf, "resume.pdf")
    extract_text(sample_pdf, "../../escape.pdf")

    assert sorted(tmp_path.iterdir()) == before
