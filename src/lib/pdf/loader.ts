import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfDocument = pdfjsLib.PDFDocumentProxy;

/**
 * Loads a PDF entirely in-memory. The file bytes never leave the browser —
 * pdf.js parses the array buffer locally.
 */
export async function loadPdf(file: File): Promise<PdfDocument> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  return loadingTask.promise;
}

/**
 * Combines the page's own intrinsic rotation with any additional rotation
 * the user chose, so a "rotate" button always turns the page relative to
 * what's currently on screen rather than fighting the source PDF's own
 * /Rotate value.
 */
export function getTotalRotation(page: { rotate: number }, extraRotation = 0): number {
  return ((page.rotate + extraRotation) % 360 + 360) % 360;
}

// Tracks the in-flight render task per canvas so a newer render can cancel a
// stale one. pdf.js does not do this on its own — two overlapping render()
// calls on the same canvas race to set canvas.width/height and draw, which
// tears the frame (visible as a corrupted/mirrored page) instead of queuing.
// This can happen whenever something re-triggers PDFViewer's render effect
// before the previous render finished, e.g. "Apply to All Documents" firing
// several rapid store updates.
const pendingRenders = new WeakMap<HTMLCanvasElement, ReturnType<PdfPage['render']>>();

type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>;

export async function renderPageToCanvas(
  doc: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
  extraRotation = 0,
): Promise<void> {
  pendingRenders.get(canvas)?.cancel();

  const page = await doc.getPage(pageNumber);
  const rotation = getTotalRotation(page, extraRotation);
  const viewport = page.getViewport({ scale, rotation });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderTask = page.render({ canvas, canvasContext: context, viewport });
  pendingRenders.set(canvas, renderTask);
  try {
    await renderTask.promise;
  } catch (e) {
    // A render cancelled by a newer one isn't a real failure — the newer
    // render will finish and draw the correct frame.
    if (!(e instanceof Error) || e.name !== 'RenderingCancelledException') throw e;
  } finally {
    if (pendingRenders.get(canvas) === renderTask) pendingRenders.delete(canvas);
  }
}
