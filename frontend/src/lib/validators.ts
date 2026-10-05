import { UPLOAD_LIMITS } from '@/data/site';

/** Result of a client-side check. `error` is a friendly, user-facing message. */
export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const OK: ValidationResult = { ok: true };

export const ACCEPTED_EXTENSIONS = UPLOAD_LIMITS.acceptedExtensions;
export const MAX_FILE_BYTES = UPLOAD_LIMITS.maxBytes;
export const MIN_TEXT_CHARS = UPLOAD_LIMITS.minTextChars;
export const MAX_TEXT_CHARS = UPLOAD_LIMITS.maxTextChars;

/** Lower-cased extension including the dot, e.g. `".pdf"`. */
export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index === -1 ? '' : filename.slice(index).toLowerCase();
}

/** True for PDF uploads. */
export function isPdfFile(file: File): boolean {
  return fileExtension(file.name) === '.pdf';
}

/** True for DOCX uploads. */
export function isDocxFile(file: File): boolean {
  return fileExtension(file.name) === '.docx';
}

/** True for plain-text uploads. */
export function isTxtFile(file: File): boolean {
  return fileExtension(file.name) === '.txt';
}

/** MIME types that are definitively incompatible with a PDF/DOCX/TXT upload. */
const CONFLICTING_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

/**
 * Validates an uploaded file.
 * Checks, in order: accepted extension, obviously-wrong MIME type, size, and
 * whether the file is empty. Mirrors the backend limits in UPLOAD_LIMITS.
 */
export function validateUploadFile(file: File): ValidationResult {
  const extension = fileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    const label = extension ? `"${extension}"` : 'that file type';
    return {
      ok: false,
      error: `Unsupported format ${label}. ${UPLOAD_LIMITS.acceptedDescription}.`,
    };
  }

  if (file.type && CONFLICTING_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return {
      ok: false,
      error: `This file is reported as ${file.type}, which is not a resume document. Upload a real PDF, DOCX or TXT file.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty (0 bytes). Pick another document.' };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `That file is ${formatBytes(file.size)}. The limit is ${UPLOAD_LIMITS.maxBytesLabel} — try a text-light or compressed version.`,
    };
  }

  return OK;
}

/**
 * Validates pasted resume text against the backend's MIN_TEXT_CHARS /
 * MAX_TEXT_CHARS, so the UI never sends a request the API will reject with 400
 * or 413.
 */
export function validatePastedText(text: string): ValidationResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { ok: false, error: 'Paste some resume text first, or load one of the sample resumes.' };
  }

  if (trimmed.length < MIN_TEXT_CHARS) {
    return {
      ok: false,
      error: `Only ${trimmed.length} characters pasted — the backend needs at least ${MIN_TEXT_CHARS}.`,
    };
  }

  if (trimmed.length > MAX_TEXT_CHARS) {
    return {
      ok: false,
      error: `That text is ${trimmed.length.toLocaleString('en-US')} characters — the backend accepts up to ${UPLOAD_LIMITS.maxTextCharsLabel}.`,
    };
  }

  return OK;
}

/** Human-readable file size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Word count used by the paste-text counter. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Character count used by the paste-text counter. */
export function countChars(text: string): number {
  return text.length;
}
