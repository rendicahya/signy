import { PDFDocument, degrees } from 'pdf-lib';
import { loadPdf, getTotalRotation } from './loader';
import { applyVisibleWatermark, type WatermarkOptions } from '../watermark/visible';
import type { PlacedSignature } from '../../stores/editor';

export interface ExportParams {
  pdfFile: File;
  signatureBlob: Blob;
  placement: PlacedSignature;
  /** Canvas render scale used by PDFViewer, needed to map pixels back to PDF points. */
  renderScale: number;
  /** Additional rotation (0/90/180/270) the user chose in the editor, on top of the page's own rotation. */
  rotation?: number;
  watermark?: WatermarkOptions;
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * Watermarks the signature, embeds it into the first page of the PDF at the
 * placed position, and returns the signed PDF bytes. Nothing here touches
 * the network — everything runs with pdf-lib (and pdf.js for coordinate
 * mapping) in the browser.
 */
export async function exportSignedPdf(params: ExportParams): Promise<Uint8Array> {
  const { pdfFile, signatureBlob, placement, renderScale, rotation = 0, watermark } = params;

  const watermarkedBlob = await applyVisibleWatermark(signatureBlob, watermark);
  const pngBytes = await blobToBytes(watermarkedBlob);

  const pdfBytes = await blobToBytes(pdfFile);

  // `placement` is in canvas pixel coordinates for whatever scale + rotation
  // PDFViewer was displaying. Re-derive the exact same pdf.js viewport here
  // and use its built-in point conversion — far less error-prone than
  // reimplementing the rotation trigonometry by hand, and it stays correct
  // for all four 90°-multiple rotations.
  const pdfjsDoc = await loadPdf(pdfFile);
  const pdfjsPage = await pdfjsDoc.getPage(1);
  const totalRotation = getTotalRotation(pdfjsPage, rotation);
  const viewport = pdfjsPage.getViewport({ scale: renderScale, rotation: totalRotation });

  const [x1, y1] = viewport.convertToPdfPoint(placement.x, placement.y);
  const [x2, y2] = viewport.convertToPdfPoint(placement.x + placement.width, placement.y + placement.height);

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const pngImage = await pdfDoc.embedPng(pngBytes);

  page.drawImage(pngImage, { x, y, width, height });

  // Persist the rotation the user chose in the editor into the exported file itself.
  if (rotation !== 0) {
    page.setRotation(degrees(totalRotation));
  }

  return pdfDoc.save();
}

export function downloadSignedPdf(bytes: Uint8Array, originalFileName: string): void {
  const base = originalFileName.replace(/\.pdf$/i, '');
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}_signed.pdf`;
  a.click();

  URL.revokeObjectURL(url);
}
