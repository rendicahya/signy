# Signy

Sign PDF documents with protected handwritten signatures, entirely in your browser.

**Live app:** https://rendicahya.github.io/signy/

No backend, no uploads, no accounts — everything runs client-side and is designed to work fully offline once loaded. See `CLAUDE.md` for the full product spec, and `FEATURES.md` for what's actually implemented versus still on the roadmap.

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

## Project status

The core flow works end to end: upload PDF/signature, save the signature locally, drag/resize/watermark it on the page, and export a signed PDF. Watermark position, text, and timestamp preferences are configurable and persisted.

Notably missing right now: multi-page PDF support (only the first page is signed), signature rotation, and watermark opacity control. Invisible watermarking (v0.3) and the verification page (v0.4) haven't been started.

See `FEATURES.md` for the full, itemized breakdown of what's implemented, known bugs, and what's left.

