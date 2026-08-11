import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import { loadPdf, getTotalRotation } from './loader';
import { placementFromRatioForDocument } from './placement';
import { stripEmbeddedScripts } from './sanitize';
import { applyVisibleWatermark, type WatermarkOptions } from '../watermark/visible';
import type { PdfDocumentState, PlacedSignature } from '../../stores/editor';
import type { PlacementRatio } from '../../stores/placement';

export interface ExportParams {
  pdfFile: File;
  signatureBlob: Blob;
  placement: PlacedSignature;
  /** Canvas render scale used by PDFViewer, needed to map pixels back to PDF points. */
  renderScale: number;
  /** Additional rotation (0/90/180/270) the user chose in the editor, on top of each page's own rotation. */
  rotation?: number;
  watermark?: WatermarkOptions;
  /** Strip any embedded JavaScript/auto-run actions carried over from the source PDF. Opt-in — see `lib/pdf/sanitize.ts`. */
  stripScripts?: boolean;
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * Watermarks the signature, embeds it into the page it was placed on, and
 * returns the signed PDF bytes. Nothing here touches the network —
 * everything runs with pdf-lib (and pdf.js for coordinate mapping) in the
 * browser. All pages are preserved; only the placement's own page gets the
 * signature.
 */
export async function exportSignedPdf(params: ExportParams): Promise<Uint8Array> {
  const { pdfFile, signatureBlob, placement, renderScale, rotation = 0, watermark, stripScripts = false } = params;

  const watermarkedBlob = await applyVisibleWatermark(signatureBlob, watermark);
  const pngBytes = await blobToBytes(watermarkedBlob);

  const pdfBytes = await blobToBytes(pdfFile);

  // `placement` is in canvas pixel coordinates for whatever page/scale/rotation
  // PDFViewer was displaying. Re-derive the exact same pdf.js viewport for that
  // page here and use its built-in point conversion — far less error-prone
  // than reimplementing the rotation trigonometry by hand, and it stays
  // correct for all four 90°-multiple rotations.
  const pdfjsDoc = await loadPdf(pdfFile);
  const pdfjsPage = await pdfjsDoc.getPage(placement.page);
  const totalRotation = getTotalRotation(pdfjsPage, rotation);
  const viewport = pdfjsPage.getViewport({ scale: renderScale, rotation: totalRotation });

  const [x1, y1] = viewport.convertToPdfPoint(placement.x, placement.y);
  const [x2, y2] = viewport.convertToPdfPoint(placement.x + placement.width, placement.y + placement.height);

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const targetPage = pdfDoc.getPage(placement.page - 1); // pdf-lib pages are 0-indexed
  const pngImage = await pdfDoc.embedPng(pngBytes);

  targetPage.drawImage(pngImage, { x, y, width, height });

  // The rotation the user chose represents "this scan is sideways" and is
  // applied to every page uniformly (each relative to its own existing
  // rotation), so the whole exported document keeps a consistent orientation
  // — not just the page that got signed.
  if (rotation !== 0) {
    for (const page of pdfDoc.getPages()) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(((current + rotation) % 360 + 360) % 360));
    }
  }

  if (stripScripts) stripEmbeddedScripts(pdfDoc);

  return pdfDoc.save();
}

export function signedFileName(originalFileName: string): string {
  const base = originalFileName.replace(/\.pdf$/i, '');
  return `${base}_signed.pdf`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(url);
}

export function downloadSignedPdf(bytes: Uint8Array, originalFileName: string): void {
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), signedFileName(originalFileName));
}

export function downloadZip(blob: Blob): void {
  downloadBlob(blob, `signy_signed_pdfs.zip`);
}

/**
 * Resolves what placement to use for a document: its own manual placement if
 * the user positioned one, otherwise the last-used ratio applied to page 1 —
 * matching the "Use last position" shortcut in the editor. Returns null if
 * neither is available, meaning this document should be skipped.
 */
export async function resolvePlacement(
  doc: PdfDocumentState,
  renderScale: number,
  lastPlacementRatio: PlacementRatio | null,
): Promise<PlacedSignature | null> {
  if (doc.placedSignature) return doc.placedSignature;
  if (!lastPlacementRatio) return null;

  const pdfjsDoc = await loadPdf(doc.file);
  return placementFromRatioForDocument(pdfjsDoc, 1, renderScale, doc.rotation, lastPlacementRatio);
}

export interface BulkExportResult {
  zipBlob: Blob;
  exportedCount: number;
  /** File names of documents that had no placement available and were left out of the ZIP. */
  skipped: string[];
}

/**
 * Exports every document that has a resolvable placement into a single ZIP.
 * Documents with neither a manual placement nor a remembered ratio are
 * skipped and reported back so the caller can tell the user.
 */
export async function exportAllAsZip(
  documents: PdfDocumentState[],
  signatureBlob: Blob,
  renderScale: number,
  lastPlacementRatio: PlacementRatio | null,
  watermark?: WatermarkOptions,
  stripScripts?: boolean,
): Promise<BulkExportResult> {
  const zip = new JSZip();
  const skipped: string[] = [];
  const usedNames = new Set<string>();

  for (const doc of documents) {
    const placement = await resolvePlacement(doc, renderScale, lastPlacementRatio);
    if (!placement) {
      skipped.push(doc.file.name);
      continue;
    }

    const bytes = await exportSignedPdf({
      pdfFile: doc.file,
      signatureBlob,
      placement,
      renderScale,
      rotation: doc.rotation,
      watermark,
      stripScripts,
    });

    let name = signedFileName(doc.file.name);
    if (usedNames.has(name)) {
      const base = name.replace(/\.pdf$/i, '');
      let suffix = 2;
      while (usedNames.has(`${base}_${suffix}.pdf`)) suffix++;
      name = `${base}_${suffix}.pdf`;
    }
    usedNames.add(name);

    zip.file(name, bytes);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zipBlob, exportedCount: documents.length - skipped.length, skipped };
}
