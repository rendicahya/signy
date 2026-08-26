/**
 * Best-effort "where does the signature probably go" heuristic, driven by
 * the page's extracted text (via pdf.js) rather than any image/ML analysis
 * — no OpenCV dependency needed for this first pass. It looks for a blank
 * signature line (a run of underscores/dots/dashes) or a "Signature" /
 * "Tanda Tangan" / "TTD" label, in that priority order. This is a guess, not
 * a guarantee — the caller always lets the user confirm or dismiss it rather
 * than placing anything automatically.
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { getTotalRotation, type PdfDocument } from './loader';
import { fitWithinBox } from '../signature/layout';

export interface SignatureSpot {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Short human-readable reason, shown in the UI so the guess is explainable. */
  reason: string;
}

const BLANK_LINE_RE = /^[_.\-]{4,}$/;
const KEYWORD_RE = /(sign(ature)?|tanda\s*tangan|ttd)/i;
const MAX_LABEL_LENGTH = 40;
const SUGGESTION_MAX_WIDTH = 160;
const EDGE_MARGIN = 8;

interface ItemBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Maps a pdf.js text item's position (in the page's own unrotated content-stream
 * point space — the same space item.transform is already given in) into canvas
 * pixel coordinates for the given viewport, mirroring the convertToPdfPoint/
 * convertToViewportPoint pattern used throughout lib/pdf. */
function itemToBox(transform: number[], width: number, height: number, viewport: { convertToViewportPoint(x: number, y: number): number[] }): ItemBox {
  const [ax, ay] = [transform[4], transform[5]];
  const [v1x, v1y] = viewport.convertToViewportPoint(ax, ay);
  const [v2x, v2y] = viewport.convertToViewportPoint(ax + width, ay + height);
  return {
    x: Math.min(v1x, v2x),
    y: Math.min(v1y, v2y),
    width: Math.abs(v2x - v1x),
    height: Math.abs(v2y - v1y),
  };
}

function clampToPage(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return {
    x: clamp(x, EDGE_MARGIN, Math.max(EDGE_MARGIN, viewportWidth - width - EDGE_MARGIN)),
    y: clamp(y, EDGE_MARGIN, Math.max(EDGE_MARGIN, viewportHeight - height - EDGE_MARGIN)),
  };
}

async function findSpotOnPage(
  pdfjsDoc: PdfDocument,
  pageNumber: number,
  renderScale: number,
  rotation: number,
  sigNaturalWidth: number,
  sigNaturalHeight: number,
): Promise<SignatureSpot | null> {
  const page = await pdfjsDoc.getPage(pageNumber);
  const totalRotation = getTotalRotation(page, rotation);
  const viewport = page.getViewport({ scale: renderScale, rotation: totalRotation });
  const textContent = await page.getTextContent();

  const items = textContent.items.filter(
    (it): it is TextItem => 'str' in it && it.str.trim().length > 0,
  );

  // Pass 1: a blank signature line — the signature sits on top of it, so the
  // box goes just above, slightly overlapping the line like real ink would.
  for (const item of items) {
    if (!BLANK_LINE_RE.test(item.str.trim())) continue;

    const lineBox = itemToBox(item.transform, item.width, item.height, viewport);
    const { width, height } = fitWithinBox(
      sigNaturalWidth,
      sigNaturalHeight,
      Math.max(60, Math.min(lineBox.width, SUGGESTION_MAX_WIDTH)),
    );
    const rawX = lineBox.x + (lineBox.width - width) / 2;
    const rawY = lineBox.y - height * 0.75;
    const { x, y } = clampToPage(rawX, rawY, width, height, viewport.width, viewport.height);
    return { page: pageNumber, x, y, width, height, reason: 'blank signature line' };
  }

  // Pass 2: a "Signature" / "Tanda Tangan" / "TTD" label — place beside it,
  // falling back to below it if there isn't room to the right.
  for (const item of items) {
    const trimmed = item.str.trim();
    if (trimmed.length > MAX_LABEL_LENGTH || !KEYWORD_RE.test(trimmed)) continue;

    const labelBox = itemToBox(item.transform, item.width, item.height, viewport);
    const { width, height } = fitWithinBox(sigNaturalWidth, sigNaturalHeight, SUGGESTION_MAX_WIDTH);

    let rawX = labelBox.x + labelBox.width + EDGE_MARGIN;
    let rawY = labelBox.y + labelBox.height / 2 - height / 2;
    if (rawX + width > viewport.width - EDGE_MARGIN) {
      rawX = labelBox.x;
      rawY = labelBox.y + labelBox.height + EDGE_MARGIN;
    }
    const { x, y } = clampToPage(rawX, rawY, width, height, viewport.width, viewport.height);
    return { page: pageNumber, x, y, width, height, reason: `near "${trimmed}"` };
  }

  return null;
}

/**
 * Searches a document for a likely signature spot: the current page first,
 * then the last page (signature blocks are very often there), then every
 * other page front to back. Returns null if nothing looked likely anywhere.
 */
export async function findSignatureSpot(
  pdfjsDoc: PdfDocument,
  renderScale: number,
  rotation: number,
  currentPage: number,
  sigNaturalWidth: number,
  sigNaturalHeight: number,
): Promise<SignatureSpot | null> {
  const numPages = pdfjsDoc.numPages;
  const order: number[] = [];
  const addOnce = (p: number) => {
    if (p >= 1 && p <= numPages && !order.includes(p)) order.push(p);
  };
  addOnce(currentPage);
  addOnce(numPages);
  for (let p = 1; p <= numPages; p++) addOnce(p);

  for (const pageNumber of order) {
    const spot = await findSpotOnPage(pdfjsDoc, pageNumber, renderScale, rotation, sigNaturalWidth, sigNaturalHeight);
    if (spot) return spot;
  }
  return null;
}
