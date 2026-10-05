/** Triggers a client-side download for JSON payloads. */
export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** `Data Science` -> `data-science`, used to build safe filenames. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'prediction'
  );
}

/** ISO timestamp without characters that are illegal in filenames. */
export function fileStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
