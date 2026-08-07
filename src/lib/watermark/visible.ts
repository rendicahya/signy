/**
 * Visible watermark: composites signer/document metadata directly onto the
 * signature image (never onto the PDF page) so the two become a single,
 * flattened image before insertion. This makes the signature harder to
 * cleanly crop or reuse after a screenshot.
 */

import type { WatermarkPosition } from '../../stores/watermark';

export interface WatermarkOptions {
  /** Free-text watermark typed by the user; supports multiple lines. */
  customText?: string;
  /** Stamp the current date/time as an extra line, controlled by a checkbox in the UI. */
  includeTimestamp?: boolean;
  /** Where the text sits on top of the signature image. Defaults to 'center'. */
  position?: WatermarkPosition;
  /** Optional metadata reserved for future automatic watermarking (v0.2). */
  signerName?: string;
  documentName?: string;
  documentId?: string;
  timestamp?: Date;
  /** 0 (invisible) – 1 (fully opaque). */
  opacity?: number;
  /** Font size as a ratio of the signature image's height. Defaults to 0.12. */
  fontScale?: number;
}

/** Formats as "1 Jan 2026, 14:30" — 24-hour time, locale-independent. */
export function formatTimestamp(date: Date): string {
  const datePart = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
}

/** Exported so the editor can render a live preview that matches the exported watermark. */
export function buildWatermarkLines(opts: WatermarkOptions): string[] {
  const lines: string[] = [];

  if (opts.customText?.trim()) {
    lines.push(
      ...opts.customText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  if (opts.includeTimestamp) {
    lines.push(formatTimestamp(opts.timestamp ?? new Date()));
  }

  return lines;
}

function parsePosition(position: WatermarkPosition = 'center') {
  const [vAlign, hAlign] = position.split('-') as [string, string | undefined];
  const vertical = vAlign === 'top' || vAlign === 'bottom' ? vAlign : 'center';
  const horizontal = hAlign === 'left' || hAlign === 'right' ? hAlign : 'center';
  return { vertical, horizontal } as const;
}

/**
 * Draws the signature image plus a horizontal (non-rotated) text watermark
 * onto an offscreen canvas and returns the flattened result as a PNG blob.
 */
export async function applyVisibleWatermark(
  signatureBlob: Blob,
  opts: WatermarkOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(signatureBlob);

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(bitmap, 0, 0);

  const lines = buildWatermarkLines(opts);

  if (lines.length > 0) {
    const opacity = opts.opacity ?? 0.25;
    const fontSize = Math.max(10, Math.round(canvas.height * (opts.fontScale ?? 0.12)));
    const lineHeight = fontSize * 1.2;
    const padding = Math.round(canvas.height * 0.06);
    const { vertical, horizontal } = parsePosition(opts.position);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    ctx.textAlign = horizontal as CanvasTextAlign;
    const x =
      horizontal === 'left' ? padding : horizontal === 'right' ? canvas.width - padding : canvas.width / 2;

    const totalHeight = lineHeight * lines.length;
    const startY =
      vertical === 'top'
        ? padding + lineHeight / 2
        : vertical === 'bottom'
          ? canvas.height - padding - totalHeight + lineHeight / 2
          : canvas.height / 2 - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineHeight);
    });
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode watermarked signature'));
    }, 'image/png');
  });
}
