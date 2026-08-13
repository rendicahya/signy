import { PDFName, type PDFDocument } from 'pdf-lib';
import { getTotalRotation, type PdfDocument as PdfJsDocument } from './loader';
import type { RedactionBox } from '../../stores/editor';

// Rendered independently of the on-screen zoom level, high enough to stay
// crisp when the exported page is printed rather than just viewed on screen.
const RASTER_SCALE = 3;

/**
 * Renders a page with the given boxes painted solid black, in the page's own
 * native (un-rotated) coordinate space — the space pdf-lib's `drawImage` and
 * `getSize()` operate in, which is independent of the page's /Rotate entry.
 */
async function rasterizePageWithRedactions(
  pdfjsDoc: PdfJsDocument,
  pageNumber: number,
  displayScale: number,
  rotation: number,
  boxes: RedactionBox[],
): Promise<HTMLCanvasElement> {
  const page = await pdfjsDoc.getPage(pageNumber);

  // The boxes were drawn against a canvas rendered at `displayScale` with
  // whatever rotation was on screen at the time — reconstruct that exact
  // viewport so `convertToPdfPoint` maps them back to real PDF coordinates.
  const displayViewport = page.getViewport({
    scale: displayScale,
    rotation: getTotalRotation(page, rotation),
  });

  // Render at a fixed high resolution and explicit rotation 0 — this matches
  // pdf-lib's page coordinate space (MediaBox-relative, unaffected by
  // /Rotate), so the flattened image can be dropped straight in without the
  // page's existing rotation double-applying.
  const nativeViewport = page.getViewport({ scale: RASTER_SCALE, rotation: 0 });

  const canvas = document.createElement('canvas');
  canvas.width = nativeViewport.width;
  canvas.height = nativeViewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  await page.render({ canvas, canvasContext: ctx, viewport: nativeViewport }).promise;

  ctx.fillStyle = '#000';
  for (const box of boxes) {
    const [px1, py1] = displayViewport.convertToPdfPoint(box.x, box.y);
    const [px2, py2] = displayViewport.convertToPdfPoint(box.x + box.width, box.y + box.height);
    const [vx1, vy1] = nativeViewport.convertToViewportPoint(px1, py1);
    const [vx2, vy2] = nativeViewport.convertToViewportPoint(px2, py2);

    ctx.fillRect(Math.min(vx1, vx2), Math.min(vy1, vy2), Math.abs(vx2 - vx1), Math.abs(vy2 - vy1));
  }

  return canvas;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to rasterize page'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject);
    }, 'image/png');
  });
}

/**
 * Permanently removes the given regions from each page that has one: the
 * page is rasterized with the regions blacked out, and its *original*
 * content stream — text, vector art, everything — is discarded and replaced
 * with just that flattened image. Drawing a black box on top of the existing
 * content would still leave the real text extractable underneath (e.g. via a
 * text-extraction tool that ignores paint order); this doesn't.
 */
export async function applyRedactions(
  pdfDoc: PDFDocument,
  pdfjsDoc: PdfJsDocument,
  redactions: RedactionBox[],
  displayScale: number,
  rotation: number,
): Promise<void> {
  if (redactions.length === 0) return;

  const byPage = new Map<number, RedactionBox[]>();
  for (const box of redactions) {
    const list = byPage.get(box.page) ?? [];
    list.push(box);
    byPage.set(box.page, list);
  }

  for (const [pageNumber, boxes] of byPage) {
    const canvas = await rasterizePageWithRedactions(pdfjsDoc, pageNumber, displayScale, rotation, boxes);
    const pngBytes = await canvasToPngBytes(canvas);
    const flattenedImage = await pdfDoc.embedPng(pngBytes);

    const targetPage = pdfDoc.getPage(pageNumber - 1);
    const { x, y, width, height } = targetPage.getMediaBox();

    // Discard the original content stream before drawing the flattened
    // replacement — otherwise the real content would still sit underneath,
    // just visually covered.
    targetPage.node.set(PDFName.Contents, pdfDoc.context.obj([]));
    targetPage.drawImage(flattenedImage, { x, y, width, height });
  }
}
