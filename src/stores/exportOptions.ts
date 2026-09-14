import { persistedWritable } from '../lib/utils/persist';

/**
 * Whether to strip embedded JavaScript/auto-run actions carried over from
 * the source PDF at export time. Opt-in (see `lib/pdf/sanitize.ts`) since it
 * can drop legitimate form behavior — persisted like the watermark
 * preferences so the choice doesn't reset every session.
 */
export const stripEmbeddedScripts = persistedWritable<boolean>('stripEmbeddedScripts', false);

/**
 * Whether to lock the exported PDF's copy/extract permission at export time
 * (see `applyCopyProtection` in `lib/pdf/export.ts`). Opt-in and persisted
 * like the script-stripping preference above.
 */
export const securePdf = persistedWritable<boolean>('securePdf', false);
