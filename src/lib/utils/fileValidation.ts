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
