# Signy

## Product Vision

Signy is a privacy-first web application for signing PDF documents using handwritten signature images.

Unlike traditional PDF signing tools, Signy focuses on protecting scanned handwritten signatures by binding them to the document context using watermarking techniques.

Signy is **not** a replacement for PKI-based digital signatures. It is a lightweight protection layer for organizations that still rely on handwritten signature images.

The application should feel modern, approachable, and extremely easy to use.

The entire signing process should take less than one minute.

---

# Core Principles

- Privacy first.
- Everything runs locally in the browser.
- No backend.
- No database.
- No authentication.
- No cloud storage.
- Never upload user files.
- GitHub Pages compatible.

---

# Tech Stack

Framework

- Svelte 5
- Vite
- TypeScript

Styling

- Tailwind CSS

PDF

- pdf.js
- pdf-lib

Image Processing

- HTML Canvas API

Future

- OpenCV.js
- DWT / DCT watermarking

Deployment

- GitHub Pages

---

# User Experience

The application should require as few clicks as possible.

Avoid dialogs and unnecessary configuration.

Users should immediately understand what to do.

The interface should feel similar to modern tools like Canva or Figma: drag, drop, resize.

---

# User Flow

## First Visit

Display two large upload cards.

- Upload PDF
- Upload Signature

Both support:

- Drag & Drop
- Click to Browse

After the signature is uploaded:

Store it locally using IndexedDB.

---

## Returning Users

Automatically load the saved signature.

Display:

- Signature preview
- Replace Signature
- Delete Signature

Users should only need to upload a new PDF.

---

## PDF Editor

Display the PDF using pdf.js.

Display the saved signature inside a floating signature panel.

The user drags the signature from the panel onto the document.

Supported interactions:

- Move
- Resize

Future:

- Rotate
- Snap to page edges

---

## Export

When Export PDF is pressed:

1. Generate a protected signature.
2. Apply visible watermark.
3. (Future) Embed invisible watermark.
4. Insert the signature into the PDF.
5. Download:

original_filename_signed.pdf

---

# Visible Watermark

Visible watermark is part of the signature image.

Never draw the watermark directly onto the PDF.

The protected signature should become a single image.

Goals:

- Harder to reuse after screenshot.
- Harder to crop cleanly.
- Still professional.
- Minimal visual distraction.

Watermark examples:

- Signer name
- Document name
- Document ID
- Date
- Timestamp
- Unique identifier

Opacity should be configurable.

---

# Invisible Watermark

Future module.

The implementation should be completely independent from the visible watermark.

Possible payload:

- signer
- document ID
- timestamp
- signature ID

Preferred algorithms:

- DWT
- DCT

The module should be replaceable.

---

# Local Storage

Save the latest signature in IndexedDB.

Do not use localStorage for image data.

Users should never need to upload their signature every time they use Signy.

---

# Components

components/

- UploadCard
- PDFViewer
- SignaturePanel
- SignatureUploader
- Toolbar
- ExportButton

lib/

pdf/

watermark/

signature/

stores/

---

# Development Roadmap

## MVP

- Upload PDF
- Upload Signature
- Save Signature
- Drag Signature
- Resize Signature
- Export PDF

## Version 0.2

- Visible watermark customization

## Version 0.3

- Invisible watermark

## Version 0.4

- Verification page

---

# Coding Guidelines

- TypeScript strict mode.
- Prefer reusable components.
- Separate UI from business logic.
- Keep components small.
- Avoid unnecessary dependencies.
- Write readable and maintainable code.
- Optimize for GitHub Pages deployment.

---

# UI Guidelines

Prefer a clean and minimal interface.

Large upload targets.

Smooth animations.

Minimal toolbar.

Generous whitespace.

Responsive layout.

Dark mode support.

---

# Out of Scope

Do not implement:

- User accounts
- Authentication
- Cloud synchronization
- Online storage
- Server-side processing

Everything must work entirely offline after the application is loaded.
