import { PDFDocument } from 'pdf-lib';
import { applyVisibleWatermark, type WatermarkOptions } from '../watermark/visible';
import type { PlacedSignature } from '../../stores/editor';

export interface ExportParams {
  pdfFile: File;
  signatureBlob: Blob;
  placement: PlacedSignature;
  /** Canvas render scale used by PDFViewer, needed to map pixels back to PDF points. */
  renderScale: number;
  watermark?: WatermarkOptions;
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * Watermarks the signature, embeds it into the first page of the PDF at the
 * placed position, and returns the signed PDF bytes. Nothing here touches
 * the network — everything runs with pdf-lib in the browser.
 */
export async function exportSignedPdf(params: ExportParams): Promise<Uint8Array> {
  const { pdfFile, signatureBlob, placement, renderScale, watermark } = params;

  const watermarkedBlob = await applyVisibleWatermark(signatureBlob, watermark);
  const pngBytes = await blobToBytes(watermarkedBlob);

  const pdfBytes = await blobToBytes(pdfFile);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  const pngImage = await pdfDoc.embedPng(pngBytes);

  // PDFViewer renders at `renderScale`; convert overlay pixel coords back to
  // PDF points and flip the Y axis (canvas origin is top-left, PDF is bottom-left).
  const x = placement.x / renderScale;
  const width = placement.width / renderScale;
  const height = placement.height / renderScale;
  const { height: pageHeight } = page.getSize();
  const y = pageHeight - placement.y / renderScale - height;

  page.drawImage(pngImage, { x, y, width, height });

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
