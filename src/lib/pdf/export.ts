import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import { loadPdf, getTotalRotation } from './loader';
import { placementFromRatioForDocument } from './placement';
import { stripEmbeddedScripts } from './sanitize';
import { applyRedactions } from './redact';
import { applyVisibleWatermark, type WatermarkOptions } from '../watermark/visible';
import { drawTextBox, embedTextFont, hexToRgb } from './textRender';
import type { PdfDocumentState, PlacedSignature, PlacedText, RedactionBox } from '../../stores/editor';
import type { PlacementRatio } from '../../stores/placement';

export interface ExportParams {
  pdfFile: File;
  /** Present only if signatures should be drawn onto the pages — signing is optional now that redaction can stand alone. */
  signatureBlob?: Blob;
  placements?: PlacedSignature[];
  /** Canvas render scale used by PDFViewer, needed to map pixels back to PDF points. */
  renderScale: number;
  /** Additional rotation (0/90/180/270) the user chose in the editor, on top of each page's own rotation. */
  rotation?: number;
  watermark?: WatermarkOptions;
  /** Strip any embedded JavaScript/auto-run actions carried over from the source PDF. Opt-in — see `lib/pdf/sanitize.ts`. */
  stripScripts?: boolean;
  /** Areas to permanently strip from the exported PDF before the signature is drawn. */
  redactions?: RedactionBox[];
  /** Typed text boxes to draw onto the exported PDF. */
  texts?: PlacedText[];
  /** If set, the exported PDF contains only this 1-indexed page (with any placements/redactions/text still applied) instead of every page. */
  onlyPage?: number;
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * Applies redaction and/or a signature to a document and returns the result.
 * Nothing here touches the network — everything runs with pdf-lib (and
 * pdf.js for coordinate mapping) in the browser. Signing and redacting are
 * independent: either, both, or (if neither is given) just a pass-through
 * copy of the original bytes.
 */
export async function exportSignedPdf(params: ExportParams): Promise<Uint8Array> {
  const {
    pdfFile,
    signatureBlob,
    placements = [],
    renderScale,
    rotation = 0,
    watermark,
    stripScripts = false,
    redactions = [],
    texts = [],
    onlyPage,
  } = params;

  const pdfBytes = await blobToBytes(pdfFile);
  const pdfjsDoc = await loadPdf(pdfFile);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Flatten any redacted pages — including pages with signatures — before
  // drawing signatures, so each signature ends up as a normal image on top of
  // the flattened page rather than being wiped out by it.
  await applyRedactions(pdfDoc, pdfjsDoc, redactions, renderScale, rotation);

  if (signatureBlob && placements.length > 0) {
    const watermarkedBlob = await applyVisibleWatermark(signatureBlob, watermark);
    const pngBytes = await blobToBytes(watermarkedBlob);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    for (const placement of placements) {
      // Each `placement` is in canvas pixel coordinates for whatever page/scale/rotation
      // PDFViewer was displaying. Re-derive the exact same pdf.js viewport for that
      // page here and use its built-in point conversion — far less error-prone
      // than reimplementing the rotation trigonometry by hand, and it stays
      // correct for all four 90°-multiple rotations.
      const pdfjsPage = await pdfjsDoc.getPage(placement.page);
      const totalRotation = getTotalRotation(pdfjsPage, rotation);
      const viewport = pdfjsPage.getViewport({ scale: renderScale, rotation: totalRotation });

      const [x1, y1] = viewport.convertToPdfPoint(placement.x, placement.y);
      const [x2, y2] = viewport.convertToPdfPoint(placement.x + placement.width, placement.y + placement.height);

      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      const targetPage = pdfDoc.getPage(placement.page - 1); // pdf-lib pages are 0-indexed
      targetPage.drawImage(pngImage, { x, y, width, height });
    }
  }

  if (texts.length > 0) {
    // One embedded font per (family, bold, italic) combination, reused across
    // every text box that shares it rather than re-embedding per box.
    const fontCache = new Map<string, Awaited<ReturnType<typeof embedTextFont>>>();

    for (const t of texts) {
      if (!t.text.trim()) continue;

      const fontKey = `${t.fontFamily}-${t.bold}-${t.italic}`;
      let font = fontCache.get(fontKey);
      if (!font) {
        font = await embedTextFont(pdfDoc, t.fontFamily, t.bold, t.italic);
        fontCache.set(fontKey, font);
      }

      const pdfjsPage = await pdfjsDoc.getPage(t.page);
      const totalRotation = getTotalRotation(pdfjsPage, rotation);
      const viewport = pdfjsPage.getViewport({ scale: renderScale, rotation: totalRotation });

      const [x1, y1] = viewport.convertToPdfPoint(t.x, t.y);
      const [x2, y2] = viewport.convertToPdfPoint(t.x + t.width, t.y + t.height);

      const x = Math.min(x1, x2);
      const topY = Math.max(y1, y2);
      const boxWidth = Math.abs(x2 - x1);
      // Canvas-px-to-PDF-point scale factor for this page/rotation, derived
      // from the box itself rather than a fixed constant so it stays correct
      // across zoom levels and rotations.
      const pxToPt = t.width > 0 ? boxWidth / t.width : renderScale;

      const targetPage = pdfDoc.getPage(t.page - 1);
      drawTextBox(targetPage, {
        text: t.text,
        x,
        topY,
        width: boxWidth,
        font,
        fontSize: t.fontSize * pxToPt,
        color: hexToRgb(t.color),
        letterSpacing: t.letterSpacing * pxToPt,
        underline: t.underline,
        align: t.align,
      });
    }
  }

  // The rotation the user chose represents "this scan is sideways" and is
  // applied to every page uniformly (each relative to its own existing
  // rotation), so the whole exported document keeps a consistent orientation.
  if (rotation !== 0) {
    for (const page of pdfDoc.getPages()) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(((current + rotation) % 360 + 360) % 360));
    }
  }

  if (stripScripts) stripEmbeddedScripts(pdfDoc);

  // Extracting a single page happens last, after every placement/redaction/
  // text/rotation has already been drawn onto the full document — copyPages
  // carries a page's finished content over as-is, so this is just a trim,
  // not a separate render pass.
  if (onlyPage !== undefined) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [onlyPage - 1]);
    singlePageDoc.addPage(copiedPage);
    return singlePageDoc.save();
  }

  return pdfDoc.save();
}

export function signedFileName(originalFileName: string): string {
  const base = originalFileName.replace(/\.pdf$/i, '');
  return `${base}_signed.pdf`;
}

export function pageOnlyFileName(originalFileName: string, pageNumber: number): string {
  const base = originalFileName.replace(/\.pdf$/i, '');
  return `${base}_page${pageNumber}.pdf`;
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
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), signedFileName(originalFileName));
}

export function downloadPageOnlyPdf(bytes: Uint8Array, originalFileName: string, pageNumber: number): void {
  downloadBlob(
    new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    pageOnlyFileName(originalFileName, pageNumber),
  );
}

export function downloadZip(blob: Blob): void {
  downloadBlob(blob, `signy_signed_pdfs.zip`);
}

export function downloadMergedPdf(bytes: Uint8Array): void {
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), 'signy_merged.pdf');
}

/**
 * Opens the browser's print dialog for a PDF without downloading or
 * navigating away — loads it into a hidden iframe (so the browser's built-in
 * PDF viewer renders it) and calls print() on that frame once it's loaded.
 */
export function printPdfBytes(bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.setAttribute('aria-hidden', 'true');

  const cleanup = () => {
    iframe.remove();
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // The print dialog is modal, so removing the iframe right after
      // print() would tear down the document it's printing — wait long
      // enough for the user to actually interact with the dialog first.
      window.setTimeout(cleanup, 60_000);
    }
  };

  // Set src before inserting into the DOM — appending a src-less iframe
  // first makes it briefly navigate to about:blank, which fires its own
  // `load` event (and thus its own blank print()) before the real PDF loads.
  iframe.src = url;
  document.body.appendChild(iframe);
}

/**
 * Resolves what placements to use for a document: its own manual placements if
 * the user positioned any, otherwise the last-used ratio applied to page 1 —
 * matching the "Use last position" shortcut in the editor. Returns an empty
 * array if neither is available, meaning no signatures will be drawn.
 */
export async function resolvePlacements(
  doc: PdfDocumentState,
  renderScale: number,
  lastPlacementRatio: PlacementRatio | null,
): Promise<PlacedSignature[]> {
  if (doc.placedSignatures.length > 0) return doc.placedSignatures;
  if (!lastPlacementRatio) return [];

  const pdfjsDoc = await loadPdf(doc.file);
  const placement = await placementFromRatioForDocument(pdfjsDoc, 1, renderScale, doc.rotation, lastPlacementRatio);
  return [placement];
}

export interface BulkExportResult {
  zipBlob: Blob;
  exportedCount: number;
  /** File names of documents skipped because they had neither a resolvable signature placement nor a redaction. */
  skipped: string[];
}

/**
 * Exports every document that has a resolvable signature placement and/or a
 * redaction into a single ZIP. Documents with neither are skipped and
 * reported back so the caller can tell the user.
 */
export async function exportAllAsZip(
  documents: PdfDocumentState[],
  signatureBlob: Blob | null,
  renderScale: number,
  lastPlacementRatio: PlacementRatio | null,
  watermark?: WatermarkOptions,
  stripScripts?: boolean,
): Promise<BulkExportResult> {
  const zip = new JSZip();
  const skipped: string[] = [];
  const usedNames = new Set<string>();

  for (const doc of documents) {
    const placements = signatureBlob ? await resolvePlacements(doc, renderScale, lastPlacementRatio) : [];
    if (placements.length === 0 && doc.redactions.length === 0 && doc.texts.length === 0) {
      skipped.push(doc.file.name);
      continue;
    }

    const bytes = await exportSignedPdf({
      pdfFile: doc.file,
      signatureBlob: placements.length > 0 ? (signatureBlob ?? undefined) : undefined,
      placements: placements.length > 0 ? placements : undefined,
      renderScale,
      rotation: doc.rotation,
      watermark,
      stripScripts,
      redactions: doc.redactions,
      texts: doc.texts,
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

/**
 * Merges every given document — each with its own signature/redaction/text
 * already applied — into a single PDF, in the given order. Unlike "Save All
 * (ZIP)", a document with nothing signed/redacted/annotated is still
 * included: merging is about combining pages into one file, not skipping
 * untouched ones.
 */
export async function exportMergedPdf(
  documents: PdfDocumentState[],
  orderedIds: string[],
  signatureBlob: Blob | null,
  renderScale: number,
  lastPlacementRatio: PlacementRatio | null,
  watermark?: WatermarkOptions,
  stripScripts?: boolean,
): Promise<Uint8Array> {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const merged = await PDFDocument.create();

  for (const id of orderedIds) {
    const doc = byId.get(id);
    if (!doc) continue;

    const placements = signatureBlob ? await resolvePlacements(doc, renderScale, lastPlacementRatio) : [];
    const bytes = await exportSignedPdf({
      pdfFile: doc.file,
      signatureBlob: placements.length > 0 ? (signatureBlob ?? undefined) : undefined,
      placements: placements.length > 0 ? placements : undefined,
      renderScale,
      rotation: doc.rotation,
      watermark,
      stripScripts,
      redactions: doc.redactions,
      texts: doc.texts,
    });

    const sourceDoc = await PDFDocument.load(bytes);
    const copiedPages = await merged.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
