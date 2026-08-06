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

export async function renderPageToCanvas(
  doc: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
  extraRotation = 0,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const rotation = getTotalRotation(page, extraRotation);
  const viewport = page.getViewport({ scale, rotation });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, canvasContext: context, viewport }).promise;
}
