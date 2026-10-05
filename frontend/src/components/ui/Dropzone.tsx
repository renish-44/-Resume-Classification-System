import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/validators';

export interface DropzoneProps {
  /** Extension accepted by this zone: '.pdf' | '.docx' | '.txt'. */
  accept: '.pdf' | '.docx' | '.txt';
  title: string;
  hint: string;
  file: File | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  error?: string | null;
  disabled?: boolean;
  id: string;
}

/** `accept` attribute for the native file input. */
const ACCEPT_ATTR: Record<DropzoneProps['accept'], string> = {
  '.pdf': 'application/pdf,.pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx',
  '.txt': 'text/plain,.txt',
};

/**
 * Accessible drag-and-drop upload zone.
 * A visually hidden native file input wrapped in a <label> keeps keyboard and
 * screen-reader behaviour native — no custom dialog required.
 */
export function Dropzone({
  accept,
  title,
  hint,
  file,
  onFile,
  onClear,
  error,
  disabled = false,
  id,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onFile(selected);
    // Allow re-selecting the same file after a validation error.
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  const hasError = Boolean(error);

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-app',
          disabled && 'cursor-not-allowed opacity-60',
          hasError
            ? 'border-rose2/50 bg-rose2/[0.05]'
            : isDragging
              ? 'border-brand-400 bg-brand-500/10'
              : 'border-line bg-surface/50 hover:border-brand-400/60 hover:bg-elevated/60',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT_ATTR[accept]}
          className="sr-only"
          disabled={disabled}
          onChange={handleChange}
        />

        {file ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-400/35 bg-brand-500/10 text-brand-300">
              <FileText aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="max-w-full truncate text-sm font-medium text-content">
              {file.name}
            </span>
            <span className="text-xs text-muted">{formatBytes(file.size)}</span>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-elevated text-brand-300">
              <UploadCloud aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium text-content">{title}</span>
            <span className="max-w-xs text-xs leading-relaxed text-muted">{hint}</span>
          </>
        )}
      </label>

      {file && onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-rose2 disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Remove file
        </button>
      )}

      {hasError && (
        <p role="alert" className="text-sm font-medium text-rose2">
          {error}
        </p>
      )}
    </div>
  );
}
