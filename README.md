# Signy

Sign PDF documents with protected handwritten signatures, entirely in your browser.

**Live app:** https://rendicahya.github.io/signy/

No backend, no uploads, no accounts — everything runs client-side and is designed to work fully offline once loaded.

## Stack

Svelte 5 + Vite + TypeScript, Tailwind CSS, pdf.js, pdf-lib, IndexedDB (via `idb`).

## Getting started

```bash
npm install
npm run dev
```

## Build & deploy (GitHub Pages)

```bash
npm run build
npm run deploy
```

`vite.config.ts` sets `base: '/signy/'` in production builds — update `REPO_NAME` there if the repository is renamed. Deploys to https://rendicahya.github.io/signy/ via the `gh-pages` branch.

## Feature status

Tracks what's actually implemented in the codebase versus what's still on the roadmap.

_Last updated: 2026-08-06._

### Implemented

**Upload & storage**

- Upload PDF via drag & drop or click-to-browse (`components/UploadCard.svelte`).
- Upload signature image via drag & drop or click-to-browse (`components/SignatureUploader.svelte`).
- File type is validated on both the PDF and signature upload slots — including drag & drop, where the browser's `accept` attribute alone doesn't help (`lib/utils/fileValidation.ts`). A PDF dropped onto the signature slot (or vice versa) is rejected with an inline message instead of silently accepted.
- Signature persisted locally in IndexedDB (`lib/signature/db.ts`, `stores/signature.ts`) — never localStorage, never uploaded anywhere.
- Returning users see their saved signature automatically, with Replace and Delete actions.
- The editor only opens once **both** a PDF and a signature are present — uploading the PDF first no longer skips ahead.

**Editor**

- PDF rendered client-side with pdf.js (`lib/pdf/loader.ts`). **Only the first page** is rendered and signed — see Not yet implemented.
- Drag the signature from the floating panel onto the document; drop position is calculated from the cursor.
- Click-to-place fallback for non-drag interactions.
- Move a placed signature by dragging it.
- Resize a placed signature via a corner handle, with aspect ratio always locked to the original image (`lib/signature/layout.ts`).
- Zoom in / out / reset controls in the toolbar; the placed signature rescales to stay in the same spot on the page as you zoom (`stores/editor.ts`).
- Toolbar stays fixed (sticky) at the top while scrolling.
- **Use last position**: the signature's placement (position and size) is remembered as a ratio of the page dimensions, so it carries over to the next document. A "Use last position" button appears over the page when a saved placement exists and nothing has been placed yet (`stores/placement.ts`).
- **Rotate the PDF page** 90° at a time from the toolbar — useful for sideways-scanned documents. The rotation is applied permanently to the exported file (via pdf-lib's `setRotation`), and the signature position is mapped back to the correct PDF coordinates using pdf.js's viewport conversion regardless of rotation (`lib/pdf/loader.ts`, `lib/pdf/export.ts`). Rotating clears any already-placed signature, since the canvas dimensions change; use "Use last position" to quickly re-place it.
- Dark mode toggle (`components/ThemeToggle.svelte`, `stores/theme.ts`): defaults to the OS's `prefers-color-scheme`, can be switched manually, and the choice is persisted in `localStorage`.

**Visible watermark**

- Multi-line custom watermark text (textarea input).
- Optional "stamp current date & time" checkbox, formatted as `1 Jan 2026, 14:30` (24-hour, `lib/watermark/visible.ts`).
- 9-position picker (top/center/bottom × left/center/right) for where the text sits on the signature.
- Live preview of the watermark directly on the placed signature in the editor, using the exact same layout math as the final export.
- At export, the watermark is flattened into the signature image itself (never drawn on the PDF page directly), for anti-crop/anti-screenshot protection.
- Watermark text, timestamp checkbox, and position preference are saved in `localStorage` so they persist across sessions (`lib/utils/persist.ts`).

**Export**

- Exports a signed PDF via pdf-lib, embedding the watermarked signature at the placed position (`lib/pdf/export.ts`).
- Downloads as `original_filename_signed.pdf`.

**Deployment**

- Vite config sets the correct `base` path for GitHub Pages (`vite.config.ts`).
- `npm run deploy` script using `gh-pages`.

### Not yet implemented

- **Rotate the placed signature itself** (independent of the page rotation above — e.g. angling the signature image within its box).
- **Snap to page edges** when dragging.
- **Watermark opacity control** — currently hardcoded at 0.25 in `lib/watermark/visible.ts`.
- **Invisible watermark** — DWT/DCT-based payload embedding. No code exists for this yet.
- **Verification page** — a way to check whether a PDF was signed with Signy and read back the watermark payload.
- **Multi-page PDF support.** The viewer and export path are both hardcoded to page 1 (`doc.getPage(1)` in the viewer, `pdfDoc.getPage(0)` in export). There's no page selector, and documents with more than one page can only be signed on the first page.
- **Single signature placement.** Only one placed signature is tracked at a time; there's no way to sign multiple spots or multiple pages in one export.
- **No way to remove a placed signature** without resetting the whole session (the "Start Over" button clears the PDF too).
- **No file size limit on uploads.** Type is now validated, but there's still no cap on file size, so an extremely large PDF or image could be dropped without warning.
- **Signature background removal.** Scanned/photographed signatures often have an off-white background; there's no automatic cleanup.
- **No offline/PWA support.** Despite "no backend, works entirely offline" being a core principle, there's no service worker yet — the app still requires a network fetch for the very first load.
- **No automated tests.** In particular, the pixel-to-PDF-point coordinate mapping in `lib/pdf/export.ts` and the resize/zoom rescaling logic in `stores/editor.ts` are easy to get subtly wrong and aren't covered by any tests.
