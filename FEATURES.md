# Signy — Feature Status

Tracks what's actually implemented in the codebase versus what's still on the roadmap. See `CLAUDE.md` for the full product spec and vision this is measured against.

_Last updated: 2026-08-06._

## Implemented

### Upload & storage

- Upload PDF via drag & drop or click-to-browse (`components/UploadCard.svelte`).
- Upload signature image via drag & drop or click-to-browse (`components/SignatureUploader.svelte`).
- Signature persisted locally in IndexedDB (`lib/signature/db.ts`, `stores/signature.ts`) — never localStorage, never uploaded anywhere.
- Returning users see their saved signature automatically, with Replace and Delete actions.
- The editor only opens once **both** a PDF and a signature are present — uploading the PDF first no longer skips ahead.

### Editor

- PDF rendered client-side with pdf.js (`lib/pdf/loader.ts`). **Only the first page** is rendered and signed — see Known limitations.
- Drag the signature from the floating panel onto the document; drop position is calculated from the cursor.
- Click-to-place fallback for non-drag interactions.
- Move a placed signature by dragging it.
- Resize a placed signature via a corner handle, with aspect ratio always locked to the original image (`lib/signature/layout.ts`).
- Zoom in / out / reset controls in the toolbar; the placed signature rescales to stay in the same spot on the page as you zoom (`stores/editor.ts`).
- Toolbar stays fixed (sticky) at the top while scrolling.
- Dark mode toggle (`components/ThemeToggle.svelte`, `stores/theme.ts`): defaults to the OS's `prefers-color-scheme`, can be switched manually, and the choice is persisted in `localStorage`.

### Visible watermark

- Multi-line custom watermark text (textarea input).
- Optional "stamp current date & time" checkbox, formatted as `1 Jan 2026, 14:30` (24-hour, `lib/watermark/visible.ts`).
- 9-position picker (top/center/bottom × left/center/right) for where the text sits on the signature.
- Live preview of the watermark directly on the placed signature in the editor, using the exact same layout math as the final export.
- At export, the watermark is flattened into the signature image itself (never drawn on the PDF page directly), per the spec's anti-crop/anti-screenshot goal.
- Watermark text, timestamp checkbox, and position preference are saved in `localStorage` so they persist across sessions (`lib/utils/persist.ts`).

### Export

- Exports a signed PDF via pdf-lib, embedding the watermarked signature at the placed position (`lib/pdf/export.ts`).
- Downloads as `original_filename_signed.pdf`.

### Deployment

- Vite config sets the correct `base` path for GitHub Pages (`vite.config.ts`).
- `npm run deploy` script using `gh-pages`.

## Not yet implemented

### From the CLAUDE.md roadmap

- **Rotate** the placed signature (listed as a future interaction in the PDF Editor spec).
- **Snap to page edges** when dragging.
- **Watermark opacity control** — the spec calls for configurable opacity; it's currently hardcoded at 0.25 in `lib/watermark/visible.ts`.
- **Invisible watermark** (v0.3) — DWT/DCT-based payload embedding. No code exists for this yet.
- **Verification page** (v0.4) — a way to check whether a PDF was signed with Signy and read back the watermark payload.

### Other gaps found during development

- **Multi-page PDF support.** The viewer and export path are both hardcoded to page 1 (`doc.getPage(1)` in the viewer, `pdfDoc.getPage(0)` in export). There's no page selector, and documents with more than one page can only be signed on the first page.
- **Single signature placement.** Only one placed signature is tracked at a time; there's no way to sign multiple spots or multiple pages in one export.
- **No way to remove a placed signature** without resetting the whole session (the "Start Over" button clears the PDF too).
- **No upload validation.** File type/size aren't checked on drop, so a very large PDF or a non-image file dropped onto the signature card could slip through past the `accept` attribute (which only filters the file picker, not drag & drop).
- **Signature background removal.** Scanned/photographed signatures often have an off-white background; there's no automatic cleanup (CLAUDE.md lists OpenCV.js as a candidate for this).
- **No offline/PWA support.** Despite "no backend, works entirely offline" being a core principle, there's no service worker yet — the app still requires a network fetch for the very first load.
- **No automated tests.** In particular, the pixel-to-PDF-point coordinate mapping in `lib/pdf/export.ts` and the resize/zoom rescaling logic in `stores/editor.ts` are easy to get subtly wrong and aren't covered by any tests.
