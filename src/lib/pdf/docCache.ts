import { loadPdf, type PdfDocument } from './loader';

const cache = new Map<string, Promise<PdfDocument>>();

/**
 * Shares one parsed pdf.js document between the main viewer and the page
 * thumbnail sidebar, keyed by our own document id (a File isn't a stable
 * cache key) so the same PDF isn't parsed twice just to render thumbnails.
 */
export function getCachedPdf(id: string, file: File): Promise<PdfDocument> {
  let promise = cache.get(id);
  if (!promise) {
    promise = loadPdf(file);
    cache.set(id, promise);
  }
  return promise;
}

export function clearCachedPdf(id: string): void {
  cache.delete(id);
}
