import { getTotalRotation, type PdfDocument } from './loader';
import type { PlacedSignature } from '../../stores/editor';
import type { PlacementRatio } from '../../stores/placement';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Re-derives a pixel placement from a saved ratio for a page that isn't
 * currently rendered on screen, using pdf.js's own viewport math instead of
 * a live canvas. Used to auto-place the signature on documents the user
 * hasn't manually positioned yet (e.g. bulk export), mirroring what
 * PDFViewer's "Use last position" does for the page that's actually visible.
 */
export async function placementFromRatioForDocument(
  pdfjsDoc: PdfDocument,
  pageNumber: number,
  renderScale: number,
  rotation: number,
  ratio: PlacementRatio,
): Promise<PlacedSignature> {
  const page = await pdfjsDoc.getPage(pageNumber);
  const totalRotation = getTotalRotation(page, rotation);
  const viewport = page.getViewport({ scale: renderScale, rotation: totalRotation });

  const width = ratio.widthRatio * viewport.width;
  const height = ratio.heightRatio * viewport.height;

  return {
    width,
    height,
    x: clamp(ratio.xRatio * viewport.width, 0, viewport.width - width),
    y: clamp(ratio.yRatio * viewport.height, 0, viewport.height - height),
    page: pageNumber,
  };
}
