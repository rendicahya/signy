import { persistedWritable } from '../lib/utils/persist';

/**
 * Watermark preferences persist across sessions (localStorage) so users
 * don't have to retype them every time they open the app. This is plain
 * text/boolean preference data, not the signature image itself, which
 * always stays in IndexedDB per CLAUDE.md.
 */

/** Custom text (multi-line) the user wants overlaid onto the signature at export time. */
export const watermarkText = persistedWritable<string>('watermarkText', '');

/** Whether to stamp the current date/time onto the signature at export time. */
export const includeTimestamp = persistedWritable<boolean>('includeTimestamp', false);

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Where the watermark text sits on top of the signature image. */
export const watermarkPosition = persistedWritable<WatermarkPosition>('watermarkPosition', 'center');
