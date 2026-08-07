# Signy

Sign PDF documents with protected handwritten signatures, entirely in your browser.

**Live app:** https://rendicahya.github.io/signy/

No backend, no uploads, no accounts — everything runs client-side and is designed to work fully offline once loaded. The app itself says so up front: a "100% local" badge is shown on the landing screen before any file is touched.

## Stack

Svelte 5 + Vite + TypeScript, Tailwind CSS, pdf.js, pdf-lib, IndexedDB (via `idb`), JSZip.

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

_Last updated: 2026-08-07._

### Implemented

**Onboarding**

- Two-step flow: step 1 is upload-PDF only (`components/UploadCard.svelte`, supports selecting/dropping multiple PDFs at once); step 2 shows the uploaded-PDF summary (with per-file remove and "+ Add more") plus the signature step.
- Step 2 always requires an explicit **Continue to Editor** click before entering the editor — even for returning users whose signature is already saved from IndexedDB — so there's a chance to review or replace the signature before it's applied to a new batch of PDFs (`App.svelte`).
- Signature upload/replace/delete via drag & drop or click-to-browse (`components/SignatureUploader.svelte`), persisted in IndexedDB (`lib/signature/db.ts`, `stores/signature.ts`) — never localStorage, never uploaded anywhere.
- File type is validated on both the PDF and signature upload slots — including drag & drop, where the browser's `accept` attribute alone doesn't help (`lib/utils/fileValidation.ts`).
- A "100% local — your files never leave this device" badge on the landing screen, ahead of any upload.

**Multi-PDF support**

- Upload and manage several PDFs in one session; each tracks its own pages, rotation, and signature placement independently (`stores/editor.ts`'s `PdfDocumentState[]`).
- Switch the active document via a dropdown in the bottom toolbar, which also shows a "N / M signed" count and a button to remove the current document (`components/BottomToolbar.svelte`).
- **Download This PDF** exports just the active document; **Download All (ZIP)** (shown once more than one PDF is uploaded) bundles every document into a single ZIP via JSZip, auto-applying the last-used placement ratio to any document that wasn't manually positioned, and reporting which (if any) had to be skipped for having no placement at all (`lib/pdf/export.ts`, `components/ExportButton.svelte`).
- A shared pdf.js document cache (`lib/pdf/docCache.ts`) avoids re-parsing the same PDF for the main viewer and the page-thumbnail sidebar.

**Editor layout**

- Three-column layout: a collapsible left sidebar of page thumbnails, the center PDF viewer with a sticky bottom toolbar, and a right sidebar for the signature panel and downloads.
- **Left sidebar** (`components/PageSidebar.svelte`, `components/PageThumbnail.svelte`): thumbnails of every page in the active document; click one to jump to that page. Toggled via a button in the top toolbar (`stores/layout.ts`).
- **Top toolbar** (`components/Toolbar.svelte`): sidebar toggle, enlarged "Signy" branding, and the Previous/Next page controls with a "Page X / Y" indicator (shown once the active document has more than one page).
- **Bottom toolbar** (`components/BottomToolbar.svelte`, sticky): the document-selector dropdown (multi-PDF only), zoom in/out/reset, and rotate left/right.
- **Right sidebar**: the signature preview/drag source, a **Replace Signature** link (works mid-session, not just during onboarding), watermark controls, a **Start Over** button, and the download button(s).
- App background is a subtle gray (`bg-neutral-100` / `dark:bg-neutral-950`) so the white PDF page visually stands out from the surrounding chrome.
- Dark mode toggle (`components/ThemeToggle.svelte`, `stores/theme.ts`): defaults to the OS's `prefers-color-scheme`, can be switched manually, and the choice is persisted in `localStorage`.

**Placing the signature**

- Drag the signature from the sidebar onto the document; drop position is calculated from the cursor. Click-to-place fallback for non-drag interactions.
- Move a placed signature by dragging it; resize via a corner handle, with aspect ratio always locked to the original image (`lib/signature/layout.ts`).
- Zoom in / out / reset; every document's placement rescales together to stay in the same spot on the page as you zoom (`stores/editor.ts`).
- **Use last position**, in the right sidebar: the signature's last placement (position and size, as a ratio of the page dimensions) carries over to the next page or document. Computed via pdf.js viewport math rather than a live canvas rect (`lib/pdf/placement.ts`), so it also works for documents not currently on screen (used for the ZIP bulk-export fallback too).
- **Rotate the PDF page** 90° at a time — useful for sideways-scanned documents. Applied permanently to the exported file (via pdf-lib's `setRotation`), with the signature position mapped back to the correct PDF coordinates using pdf.js's viewport conversion regardless of rotation (`lib/pdf/loader.ts`, `lib/pdf/export.ts`). Rotating clears that document's placement, since the canvas dimensions change.
- **Start Over** (right sidebar, above the download buttons) resets the whole session. If nothing has been downloaded yet, a confirmation dialog warns that uploaded PDFs and placements will be discarded (`stores/editor.ts`'s `hasExported` flag, `components/StartOverButton.svelte`).

**Visible watermark**

- Multi-line custom watermark text (textarea input).
- Optional "stamp current date & time" checkbox, formatted as `1 Jan 2026, 14:30` (24-hour, `lib/watermark/visible.ts`).
- 9-position picker (top/center/bottom × left/center/right) for where the text sits on the signature.
- Live preview of the watermark directly on the placed signature in the editor, using the exact same layout math as the final export.
- At export, the watermark is flattened into the signature image itself (never drawn on the PDF page directly), for anti-crop/anti-screenshot protection.
- Watermark text, timestamp checkbox, and position preference are saved in `localStorage` so they persist across sessions (`lib/utils/persist.ts`).

**Deployment**

- Vite config sets the correct `base` path for GitHub Pages (`vite.config.ts`).
- `npm run deploy` script using `gh-pages`.

### Not yet implemented

- **Rotate the placed signature itself** (independent of the page rotation above — e.g. angling the signature image within its box).
- **Snap to page edges** when dragging.
- **Watermark opacity control** — currently hardcoded at 0.25 in `lib/watermark/visible.ts`.
- **Invisible watermark** — DWT/DCT-based payload embedding. No code exists for this yet.
- **Verification page** — a way to check whether a PDF was signed with Signy and read back the watermark payload.
- **One signature placement per PDF.** Each document tracks a single placed signature at a time — no way to sign multiple spots on the same document in one export yet (though different documents in the same session can each have their own placement).
- **No way to clear a single placement** short of rotating the page or removing/re-adding the document — "Start Over" clears the whole session.
- **No file size limit on uploads.** Type is validated, but there's still no cap on file size, so an extremely large PDF or image could be dropped without warning.
- **Signature background removal.** Scanned/photographed signatures often have an off-white background; there's no automatic cleanup.
- **No offline/PWA support.** Despite "no backend, works entirely offline" being a core principle, there's no service worker yet — the app still requires a network fetch for the very first load.
- **No automated tests.** In particular, the pixel-to-PDF-point coordinate mapping in `lib/pdf/export.ts` and the resize/zoom rescaling logic in `stores/editor.ts` are easy to get subtly wrong and aren't covered by any tests.
