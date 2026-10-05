import { useState } from 'react';
import { FileText, FileType, FileUp, Loader2, RotateCcw, Sparkles, Type, X } from 'lucide-react';
import type { PredictInput } from '@/lib/api';
import { SAMPLE_RESUMES } from '@/data/samples';
import { dataHandlingNote } from '@/data/results';
import { UPLOAD_LIMITS } from '@/data/site';
import { countChars, countWords, validatePastedText, validateUploadFile } from '@/lib/validators';
import { formatNumber } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dropzone } from '@/components/ui/Dropzone';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import type { TabItem } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';

export type InputTabId = 'text' | 'pdf' | 'docx' | 'txt';

export interface InputPanelProps {
  onSubmit: (input: PredictInput) => void;
  onClear: () => void;
  onCancel?: () => void;
  loading: boolean;
}

const TABS: TabItem[] = [
  { id: 'text', label: 'Paste Text', icon: <Type className="h-4 w-4" aria-hidden="true" /> },
  { id: 'pdf', label: 'Upload PDF', icon: <FileUp className="h-4 w-4" aria-hidden="true" /> },
  { id: 'docx', label: 'Upload DOCX', icon: <FileType className="h-4 w-4" aria-hidden="true" /> },
  { id: 'txt', label: 'Upload TXT', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
];

type FileTab = 'pdf' | 'docx' | 'txt';

const EXTENSIONS: Record<FileTab, '.pdf' | '.docx' | '.txt'> = {
  pdf: '.pdf',
  docx: '.docx',
  txt: '.txt',
};

export function InputPanel({ onSubmit, onClear, onCancel, loading }: InputPanelProps) {
  const [tab, setTab] = useState<InputTabId>('text');
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<FileTab, File | null>>({ pdf: null, docx: null, txt: null });
  const [fileErrors, setFileErrors] = useState<Record<FileTab, string | null>>({
    pdf: null,
    docx: null,
    txt: null,
  });

  const handleFile = (file: File, kind: FileTab) => {
    const validation = validateUploadFile(file);

    if (!validation.ok) {
      setFiles((current) => ({ ...current, [kind]: null }));
      setFileErrors((current) => ({ ...current, [kind]: validation.error ?? 'Invalid file.' }));
      return;
    }

    setFiles((current) => ({ ...current, [kind]: file }));
    setFileErrors((current) => ({ ...current, [kind]: null }));
  };

  const clearFile = (kind: FileTab) => {
    setFiles((current) => ({ ...current, [kind]: null }));
    setFileErrors((current) => ({ ...current, [kind]: null }));
  };

  const submit = () => {
    if (tab === 'text') {
      const validation = validatePastedText(text);
      if (!validation.ok) {
        setTextError(validation.error ?? 'Invalid input.');
        return;
      }
      setTextError(null);
      onSubmit({ kind: 'text', text });
      return;
    }

    const kind = tab as FileTab;
    const file = files[kind];

    if (!file) {
      setFileErrors((current) => ({ ...current, [kind]: `Choose a ${kind.toUpperCase()} file first.` }));
      return;
    }

    onSubmit({ kind: 'file', file, extension: EXTENSIONS[kind] });
  };

  const resetAll = () => {
    setText('');
    setTextError(null);
    setFiles({ pdf: null, docx: null, txt: null });
    setFileErrors({ pdf: null, docx: null, txt: null });
    onClear();
  };

  const canSubmit =
    tab === 'text'
      ? text.trim().length >= UPLOAD_LIMITS.minTextChars
      : files[tab as FileTab] !== null;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resume input</h2>
          <p className="mt-1 text-sm text-muted">
            {UPLOAD_LIMITS.acceptedDescription}, or paste extracted text directly.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Tabs
          items={TABS}
          value={tab}
          onChange={(id) => setTab(id as InputTabId)}
          ariaLabel="Resume input method"
          idPrefix="input"
        />
      </div>

      <div className="mt-5 flex-1">
        {/* ---- Paste text ------------------------------------------------- */}
        <TabPanel id="text" activeId={tab} idPrefix="input" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="resume-text" className="text-sm font-medium text-content">
              Extracted resume text
            </label>
            <textarea
              id="resume-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (textError) setTextError(null);
              }}
              rows={12}
              spellCheck={false}
              placeholder="Paste the plain-text contents of a resume here…"
              aria-describedby="resume-text-meta"
              aria-invalid={Boolean(textError)}
              className="w-full resize-y rounded-2xl border border-line bg-app/60 p-4 font-mono text-[13px] leading-relaxed text-content placeholder:font-sans placeholder:text-faint focus:border-brand-400/70 focus:outline-none aria-[invalid=true]:border-rose2/60"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
              <p id="resume-text-meta" className="tabular">
                {formatNumber(countWords(text))} words · {formatNumber(countChars(text))} characters
              </p>
              <p>
                Backend accepts {UPLOAD_LIMITS.minTextCharsLabel} up to{' '}
                {UPLOAD_LIMITS.maxTextCharsLabel}
              </p>
            </div>
          </div>

          {textError && (
            <Alert tone="error" live>
              {textError}
            </Alert>
          )}

          <div className="rounded-2xl border border-line bg-elevated/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
              Load a sample resume
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Three fictional CVs written for this demo — no real person or company.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SAMPLE_RESUMES.map((sample) => (
                <Button
                  key={sample.id}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setText(sample.text);
                    setTextError(null);
                  }}
                  title={sample.description}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </div>
        </TabPanel>

        {/* ---- File uploads (PDF / DOCX / TXT) ----------------------------- */}
        {(['pdf', 'docx', 'txt'] as const).map((kind) => (
          <TabPanel key={kind} id={kind} activeId={tab} idPrefix="input">
            <Dropzone
              id={`${kind}-upload`}
              accept={EXTENSIONS[kind]}
              title={`Drop a ${kind.toUpperCase()} here`}
              hint={`or click to browse · ${UPLOAD_LIMITS.acceptedDescription}`}
              file={files[kind]}
              onFile={(file) => handleFile(file, kind)}
              onClear={() => clearFile(kind)}
              error={fileErrors[kind]}
              disabled={loading}
            />
          </TabPanel>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button
          onClick={submit}
          loading={loading}
          disabled={loading || !canSubmit}
          iconLeft={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        >
          {loading ? 'Predicting…' : 'Predict Category'}
        </Button>

        {loading && onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            iconLeft={<X className="h-4 w-4" aria-hidden="true" />}
          >
            Cancel
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={resetAll}
          disabled={loading}
          iconLeft={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Clear
        </Button>

        {loading && (
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Contacting the prediction API
          </span>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-faint">{dataHandlingNote}.</p>
    </Card>
  );
}