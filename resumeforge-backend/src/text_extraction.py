"""In-memory text extraction for PDF, DOCX and TXT uploads.

Every upload is validated **twice**: once by file extension and once by magic
bytes / container structure, so a renamed executable or a ``.pdf`` that is
really a ZIP is rejected before any parser runs.

Privacy and safety rules enforced here:

* uploads live in an :class:`io.BytesIO` buffer only - no temporary file is ever
  created, and nothing is written to disk;
* embedded content (scripts, macros, external references) is never executed or
  resolved - only text is read;
* library exceptions never escape: they are translated into the domain errors
  below so the API layer can return a clean HTTP response.
"""

from __future__ import annotations

import io
import logging
import zipfile
from collections.abc import Iterator
from typing import Final

from docx import Document
from docx.document import Document as DocxDocument
from docx.opc.exceptions import PackageNotFoundError
from docx.table import Table
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from src.config import SUPPORTED_UPLOAD_EXTENSIONS
from src.utils import format_size_limit, normalize_whitespace, safe_filename

__all__ = [
    "CorruptedFileError",
    "EmptyFileError",
    "EncryptedPdfError",
    "FileTooLargeError",
    "NoExtractableTextError",
    "TextExtractionError",
    "UnsupportedFileTypeError",
    "extract_text",
    "supported_extensions",
]

logger = logging.getLogger(__name__)

_PDF_MAGIC: Final[bytes] = b"%PDF-"
_ZIP_MAGICS: Final[tuple[bytes, ...]] = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
_DOCX_MAIN_DOCUMENT: Final[str] = "word/document.xml"
#: Signatures that must never be accepted as plain text, even though latin-1
#: could technically decode them.
_BINARY_SIGNATURES: Final[tuple[tuple[bytes, str], ...]] = (
    (b"%PDF-", "PDF"),
    (b"PK\x03\x04", "ZIP/DOCX/XLSX archive"),
    (b"\x89PNG\r\n\x1a\n", "PNG image"),
    (b"\xff\xd8\xff", "JPEG image"),
    (b"GIF87a", "GIF image"),
    (b"MZ", "Windows executable"),
    (b"\x7fELF", "Linux executable"),
    (b"{\\rtf", "RTF document"),
)
_BINARY_SNIFF_BYTES: Final[int] = 4096
_MAX_DOCX_TABLE_DEPTH: Final[int] = 3


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class TextExtractionError(Exception):
    """Base class for every text-extraction failure."""


class UnsupportedFileTypeError(TextExtractionError):
    """The extension is not supported, or the content does not match it."""


class EmptyFileError(TextExtractionError):
    """The uploaded file contains zero bytes."""


class CorruptedFileError(TextExtractionError):
    """The container is recognised but structurally broken."""


class EncryptedPdfError(TextExtractionError):
    """The PDF is password protected; no attempt is made to decrypt it."""


class NoExtractableTextError(TextExtractionError):
    """No text layer was found (typically a scanned or image-only PDF)."""


class FileTooLargeError(TextExtractionError):
    """The upload exceeds ``MAX_UPLOAD_MB``."""


def supported_extensions() -> tuple[str, ...]:
    """Return the extensions accepted by :func:`extract_text`."""
    return SUPPORTED_UPLOAD_EXTENSIONS


# --------------------------------------------------------------------------- #
# Validation helpers
# --------------------------------------------------------------------------- #


def _extension_of(filename: str) -> str:
    """Return the lower-cased extension of ``filename`` including the dot."""
    safe = safe_filename(filename)
    _, dot, extension = safe.rpartition(".")
    if not dot:
        return ""
    return f".{extension.lower()}"


def _require_supported_extension(filename: str) -> str:
    """Validate the extension and return it in lower case."""
    extension = _extension_of(filename)
    if not extension:
        raise UnsupportedFileTypeError(
            f"The uploaded file has no extension. Supported types: "
            f"{', '.join(SUPPORTED_UPLOAD_EXTENSIONS)}."
        )
    if extension == ".doc":
        raise UnsupportedFileTypeError(
            "Legacy .doc files are not supported. Please upload a .docx or a .pdf."
        )
    if extension not in SUPPORTED_UPLOAD_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{extension}'. Supported types: "
            f"{', '.join(SUPPORTED_UPLOAD_EXTENSIONS)}."
        )
    return extension


def _looks_binary(data: bytes) -> bool:
    """Heuristically decide whether ``data`` is binary rather than text."""
    head = data[:_BINARY_SNIFF_BYTES]
    if b"\x00" in head:
        return True
    if not head:
        return False
    control = sum(1 for byte in head if byte < 32 and byte not in (9, 10, 12, 13))
    return control / len(head) > 0.05


def _require_matching_magic(data: bytes, extension: str, filename: str) -> None:
    """Verify that the file content matches the declared extension."""
    if extension == ".pdf":
        if not data.startswith(_PDF_MAGIC):
            raise UnsupportedFileTypeError(
                f"'{safe_filename(filename)}' is not a valid PDF: the file does not start "
                "with the %PDF- signature."
            )
        return

    if extension == ".docx":
        if not data.startswith(_ZIP_MAGICS):
            raise UnsupportedFileTypeError(
                f"'{safe_filename(filename)}' is not a valid DOCX: a DOCX must be a ZIP archive."
            )
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
        except (zipfile.BadZipFile, OSError) as exc:
            raise CorruptedFileError(
                f"'{safe_filename(filename)}' is not a readable ZIP-based DOCX archive."
            ) from exc
        if _DOCX_MAIN_DOCUMENT not in names:
            raise UnsupportedFileTypeError(
                f"'{safe_filename(filename)}' is a ZIP archive but not a DOCX document "
                f"(missing {_DOCX_MAIN_DOCUMENT})."
            )
        return

    # .txt
    if _looks_binary(data):
        raise UnsupportedFileTypeError(
            f"'{safe_filename(filename)}' contains binary data and is not a plain text file."
        )
    for signature, label in _BINARY_SIGNATURES:
        if data.startswith(signature):
            raise UnsupportedFileTypeError(
                f"'{safe_filename(filename)}' looks like a {label}, not a plain text file. "
                "Rename it to the correct extension and upload it again."
            )


# --------------------------------------------------------------------------- #
# Per-format extraction
# --------------------------------------------------------------------------- #


def _extract_pdf(data: bytes, filename: str) -> str:
    """Extract the text layer of a PDF, skipping blank pages."""
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
    except PdfReadError as exc:
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' could not be parsed as a PDF."
        ) from exc
    except Exception as exc:  # defensive: pypdf raises several parser errors
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' is a malformed PDF file."
        ) from exc

    if reader.is_encrypted:
        raise EncryptedPdfError(
            f"'{safe_filename(filename)}' is password protected. Please upload an "
            "unprotected PDF or paste the resume text as JSON."
        )

    chunks: list[str] = []
    try:
        pages = list(reader.pages)
    except Exception as exc:
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' has an unreadable page tree."
        ) from exc

    for index, page in enumerate(pages):
        try:
            page_text = page.extract_text() or ""
        except Exception:  # one broken page must not fail the whole request
            logger.debug("pdf_page_extraction_failed", extra={"page_index": index})
            continue
        if page_text.strip():
            chunks.append(page_text)
    return "\n\n".join(chunks)


def _iter_docx_table(table: Table, depth: int) -> Iterator[str]:
    """Yield every cell paragraph of a table, recursing into nested tables."""
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                yield paragraph.text
            for nested in cell.tables:
                yield from _iter_docx_table(nested, depth + 1)


def _iter_docx_blocks(document: DocxDocument, depth: int = 0) -> Iterator[str]:
    """Yield paragraphs and table text of a python-docx document."""
    for paragraph in document.paragraphs:
        yield paragraph.text
    if depth >= _MAX_DOCX_TABLE_DEPTH:
        return
    for table in document.tables:
        yield from _iter_docx_table(table, depth)


def _extract_docx(data: bytes, filename: str) -> str:
    """Extract paragraphs **and** table cells from a DOCX document."""
    try:
        document = Document(io.BytesIO(data))
    except PackageNotFoundError as exc:
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' is not a readable DOCX package."
        ) from exc
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' is a corrupted DOCX file."
        ) from exc
    except Exception as exc:  # defensive: lxml/xml errors vary by version
        raise CorruptedFileError(
            f"'{safe_filename(filename)}' could not be parsed as a DOCX document."
        ) from exc

    chunks = [block for block in _iter_docx_blocks(document) if block and block.strip()]
    return "\n".join(chunks)


def _decode_txt(data: bytes) -> str:
    """Decode plain text, stripping a UTF-8 BOM, with cp1252/latin-1 fallbacks."""
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _extract_txt(data: bytes) -> str:
    """Extract text from a plain-text file."""
    return _decode_txt(data)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def extract_text(
    file_bytes: bytes,
    filename: str,
    *,
    max_bytes: int | None = None,
    min_chars: int = 1,
) -> str:
    """Extract and normalise the text of an uploaded document.

    Parameters
    ----------
    file_bytes:
        Raw upload content, already read into memory.
    filename:
        Original client file name; only its extension and a sanitised display
        form are used. The value is never used to build a file-system path.
    max_bytes:
        Optional size limit in bytes (usually ``MAX_UPLOAD_MB * 1024 * 1024``).
        Checked **before** parsing.
    min_chars:
        Minimum number of non-whitespace characters required in the result.
        Defaults to ``1``; the API layer raises ``InputTooShortError`` for short
        (but non-empty) text so the caller gets a 400 with a precise code.

    Returns
    -------
    str
        Whitespace-normalised text.

    Raises
    ------
    FileTooLargeError, EmptyFileError, UnsupportedFileTypeError,
    CorruptedFileError, EncryptedPdfError, NoExtractableTextError
    """
    if not isinstance(file_bytes, (bytes, bytearray, memoryview)):
        raise UnsupportedFileTypeError("Expected the upload content as bytes.")
    payload = bytes(file_bytes)

    if max_bytes is not None and len(payload) > max_bytes:
        raise FileTooLargeError(
            f"The uploaded file is larger than the {format_size_limit(max_bytes)} limit."
        )
    if not payload:
        raise EmptyFileError("The uploaded file is empty.")

    extension = _require_supported_extension(filename)
    _require_matching_magic(payload, extension, filename)

    if extension == ".pdf":
        raw_text = _extract_pdf(payload, filename)
    elif extension == ".docx":
        raw_text = _extract_docx(payload, filename)
    else:
        raw_text = _extract_txt(payload)

    text = normalize_whitespace(raw_text)
    if len(text.strip()) < max(1, min_chars):
        raise NoExtractableTextError(
            f"No text could be extracted from '{safe_filename(filename)}'. Scanned or "
            "image-only documents must be converted to text first."
        )
    return text
