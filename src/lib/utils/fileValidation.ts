/**
 * Checks a File against an `<input accept>`-style pattern list (MIME types,
 * MIME wildcards like "image/*", or extensions like ".pdf"). Used to reject
 * files dropped via drag & drop, since the browser's `accept` attribute only
 * filters the file picker dialog — it does nothing for drag & drop.
 */
export function isFileAccepted(file: File, accept: string): boolean {
  if (!accept.trim()) return true;

  const patterns = accept
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (patterns.length === 0) return true;

  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) {
      return file.name.toLowerCase().endsWith(pattern.toLowerCase());
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    return file.type === pattern;
  });
}

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_SIGNATURE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Formats a byte count as a short human-readable size, e.g. "12.3 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
