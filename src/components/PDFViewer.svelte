<script lang="ts">
  import { onMount } from 'svelte';
  import { renderPageToCanvas, type PdfDocument } from '../lib/pdf/loader';
  import { getCachedPdf } from '../lib/pdf/docCache';
  import { editorStore, activeDocument, type PlacedSignature, type RedactionBox } from '../stores/editor';
  import { redactMode } from '../stores/redact';
  import { signatureStore } from '../stores/signature';
  import {
    watermarkText,
    includeTimestamp,
    watermarkPosition,
    watermarkFontScale,
    watermarkColor,
    watermarkOpacity,
    type WatermarkPosition,
  } from '../stores/watermark';
  import { lastPlacement } from '../stores/placement';
  import { fitWithinBox } from '../lib/signature/layout';
  import { buildWatermarkLines } from '../lib/watermark/visible';

  let canvasEl: HTMLCanvasElement;
  let wrapperEl: HTMLDivElement;
  let pdfDoc: PdfDocument | null = $state(null);
  let error: string | null = $state(null);
  let isDragOver = $state(false);

  // Live preview of the watermark text, kept in sync with the export logic in lib/watermark/visible.ts.
  const previewLines = $derived(
    buildWatermarkLines({ customText: $watermarkText, includeTimestamp: $includeTimestamp }),
  );

  function positionToFlex(position: WatermarkPosition) {
    const [v, h] = position.split('-') as [string, string | undefined];
    const justifyContent = v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
    const alignItems = h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center';
    const textAlign = h === 'left' ? 'left' : h === 'right' ? 'right' : 'center';
    return { justifyContent, alignItems, textAlign };
  }

  const previewAlign = $derived(positionToFlex($watermarkPosition));

  // This component is remounted (via a #key block in App.svelte) whenever
  // the active document changes, so `onMount` always loads the right file.
  async function loadDocument() {
    const doc = $activeDocument;
    if (!doc) return;
    try {
      pdfDoc = await getCachedPdf(doc.id, doc.file);
      editorStore.setPageCount(pdfDoc.numPages);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load PDF';
    }
  }

  onMount(loadDocument);

  // Re-render the current page whenever the page number, zoom level, rotation, or the document changes.
  $effect(() => {
    const doc = $activeDocument;
    const scale = $editorStore.renderScale;
    if (!doc || !pdfDoc || !canvasEl) return;
    renderPageToCanvas(pdfDoc, doc.pageNumber, canvasEl, scale, doc.rotation).catch((e) => {
      error = e instanceof Error ? e.message : 'Failed to render PDF';
    });
  });

  // Only show a placement (or the placed-signature overlay) when we're looking at its own page.
  const placementOnCurrentPage = $derived.by(() => {
    const doc = $activeDocument;
    if (!doc?.placedSignature) return null;
    return doc.placedSignature.page === doc.pageNumber ? doc.placedSignature : null;
  });

  const redactionsOnCurrentPage = $derived.by(() => {
    const doc = $activeDocument;
    if (!doc) return [];
    return doc.redactions.filter((box) => box.page === doc.pageNumber);
  });

  // The move/resize/remove controls only show while the placed signature is
  // "selected" — right after it's placed, or after the user clicks it again
  // — and hide once the user clicks anywhere else, so the signature doesn't
  // permanently sit under a distracting border and handles.
  let selected = $state(false);

  // editorStore emits a new object on every drag/resize step (updatePlacement
  // runs per pointermove), so $activeDocument changes constantly while
  // dragging. Comparing against the last-seen page number — rather than
  // resetting unconditionally whenever this effect re-runs — keeps that from
  // clearing `selected` mid-drag; it should only reset on an actual page change.
  let lastPageForSelection: number | undefined;
  $effect(() => {
    const page = $activeDocument?.pageNumber;
    if (page === lastPageForSelection) return;
    lastPageForSelection = page;
    selected = false;
    selectedRedactionId = null;
  });

  // Auto-select on the transition from "no placement on this page" to
  // "placed" — covers the click-to-place fallback in SignaturePanel (used on
  // touch devices, where there's no drag & drop to hook into) in addition to
  // this file's own onDrop. Reads placementOnCurrentPage as a plain boolean
  // so the constant reference churn during drag (a new object every
  // pointermove) doesn't re-trigger this — only an actual null→non-null flip does.
  let hadPlacement = false;
  $effect(() => {
    const has = !!placementOnCurrentPage;
    if (has && !hadPlacement) selected = true;
    hadPlacement = has;
  });

  function onWindowPointerDown(e: PointerEvent) {
    const current = wrapperEl?.querySelector('[data-placed-signature]');
    if (!current?.contains(e.target as Node)) selected = false;

    const currentRedaction = selectedRedactionId
      ? wrapperEl?.querySelector(`[data-redaction="${selectedRedactionId}"]`)
      : null;
    if (!currentRedaction?.contains(e.target as Node)) selectedRedactionId = null;
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  // Remember where the signature was placed (as a ratio of the page size) so
  // it can be reused on the next document.
  function rememberPlacement(placement: PlacedSignature) {
    const rect = canvasEl.getBoundingClientRect();
    lastPlacement.set({
      xRatio: placement.x / rect.width,
      yRatio: placement.y / rect.height,
      widthRatio: placement.width / rect.width,
      heightRatio: placement.height / rect.height,
    });
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;

    const doc = $activeDocument;
    if (!doc) return;

    const sig = $signatureStore;
    const { width, height } = fitWithinBox(sig.naturalWidth, sig.naturalHeight);

    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - width / 2, 0, rect.width - width);
    const y = clamp(e.clientY - rect.top - height / 2, 0, rect.height - height);

    const placement = { x, y, width, height, page: doc.pageNumber };
    editorStore.placeSignature(placement);
    rememberPlacement(placement);
    selected = true;
  }

  // Let the placed signature be moved after it's dropped.
  let moving = false;
  let moveOffset = { x: 0, y: 0 };

  function onOverlayPointerDown(e: PointerEvent) {
    const current = wrapperEl.querySelector('[data-placed-signature]') as HTMLElement | null;
    if (!current) return;
    selected = true;
    moving = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const overlayRect = current.getBoundingClientRect();
    moveOffset = { x: e.clientX - overlayRect.left, y: e.clientY - overlayRect.top };
  }

  function onOverlayPointerMove(e: PointerEvent) {
    if (!moving) return;
    const placement = $activeDocument?.placedSignature;
    if (!placement) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - moveOffset.x, 0, rect.width - placement.width);
    const y = clamp(e.clientY - rect.top - moveOffset.y, 0, rect.height - placement.height);
    editorStore.updatePlacement({ x, y });
  }

  function onOverlayPointerUp() {
    moving = false;
    const placement = $activeDocument?.placedSignature;
    if (placement) rememberPlacement(placement);
  }

  // Nudge the placed signature with the arrow keys while its control box (the
  // resize handle / remove button) is showing — lets keyboard users reposition
  // it without needing to drag.
  const KEYBOARD_MOVE_STEP = 10;

  function onOverlayKeydown(e: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();

    const placement = $activeDocument?.placedSignature;
    if (!placement) return;

    const rect = canvasEl.getBoundingClientRect();
    const dx = e.key === 'ArrowLeft' ? -KEYBOARD_MOVE_STEP : e.key === 'ArrowRight' ? KEYBOARD_MOVE_STEP : 0;
    const dy = e.key === 'ArrowUp' ? -KEYBOARD_MOVE_STEP : e.key === 'ArrowDown' ? KEYBOARD_MOVE_STEP : 0;

    const x = clamp(placement.x + dx, 0, rect.width - placement.width);
    const y = clamp(placement.y + dy, 0, rect.height - placement.height);
    editorStore.updatePlacement({ x, y });
    rememberPlacement({ ...placement, x, y });
  }

  // Resize via the corner handle, always preserving the signature's aspect ratio.
  const MIN_SIZE = 24;
  const KEYBOARD_RESIZE_STEP = 10;
  let resizing = false;
  let resizeStart: (PlacedSignature & { pointerX: number; pointerY: number }) | null = null;

  // Shared by the pointer-drag and keyboard paths: grows/shrinks toward
  // `targetWidth` from `origin`'s position, preserving aspect ratio and
  // clamping so the signature never overflows the page or drops below MIN_SIZE.
  function clampedResize(targetWidth: number, origin: PlacedSignature): { width: number; height: number } {
    const rect = canvasEl.getBoundingClientRect();
    const aspect = origin.width / origin.height;

    let width = clamp(targetWidth, MIN_SIZE, rect.width - origin.x);
    let height = width / aspect;

    const maxHeight = rect.height - origin.y;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    if (height < MIN_SIZE) {
      height = MIN_SIZE;
      width = height * aspect;
    }

    return { width, height };
  }

  function onResizePointerDown(e: PointerEvent) {
    e.stopPropagation();
    const placement = $activeDocument?.placedSignature;
    if (!placement) return;
    resizing = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeStart = { pointerX: e.clientX, pointerY: e.clientY, ...placement };
  }

  function onResizePointerMove(e: PointerEvent) {
    if (!resizing || !resizeStart) return;
    const deltaX = e.clientX - resizeStart.pointerX;
    const { width, height } = clampedResize(resizeStart.width + deltaX, resizeStart);
    editorStore.updatePlacement({ width, height });
  }

  // Keyboard equivalent of the drag handle, for anyone who can't drag the
  // pointer-only resize handle: Right/Up grows, Left/Down shrinks.
  function onResizeKeydown(e: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const placement = $activeDocument?.placedSignature;
    if (!placement) return;

    const grow = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const { width, height } = clampedResize(placement.width + (grow ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP), placement);
    editorStore.updatePlacement({ width, height });
    rememberPlacement({ ...placement, width, height });
  }

  function onResizePointerUp(e: PointerEvent) {
    resizing = false;
    resizeStart = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const placement = $activeDocument?.placedSignature;
    if (placement) rememberPlacement(placement);
  }

  // Redaction: draw-a-box mode. While active, a plain pointer drag directly on
  // the canvas (not on an existing overlay — those stop being `e.target` once
  // something is stacked on top of them) starts a new box; releasing commits
  // it if it's big enough to be a deliberate box rather than a stray click.
  const REDACT_DRAW_MIN_SIZE = 8;
  let selectedRedactionId: string | null = $state(null);
  let drawingBox: { x: number; y: number; width: number; height: number } | null = $state(null);
  let drawStart = { x: 0, y: 0 };

  $effect(() => {
    if (!$redactMode) drawingBox = null;
  });

  function onWrapperPointerDown(e: PointerEvent) {
    if (!$redactMode || e.target !== canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    drawStart = { x, y };
    drawingBox = { x, y, width: 0, height: 0 };
    selectedRedactionId = null;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onWrapperPointerMove(e: PointerEvent) {
    if (!drawingBox) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    drawingBox = {
      x: Math.min(x, drawStart.x),
      y: Math.min(y, drawStart.y),
      width: Math.abs(x - drawStart.x),
      height: Math.abs(y - drawStart.y),
    };
  }

  function onWrapperPointerUp(e: PointerEvent) {
    if (!drawingBox) return;
    const doc = $activeDocument;
    const box = drawingBox;
    drawingBox = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!doc || box.width < REDACT_DRAW_MIN_SIZE || box.height < REDACT_DRAW_MIN_SIZE) return;
    editorStore.addRedaction({ ...box, page: doc.pageNumber });
  }

  // Move an existing box. Looks the box up fresh by id on every step (rather
  // than trusting a closure snapshot) since editorStore emits a new object on
  // every pointermove, same reasoning as the signature's move handler above.
  let movingRedactionId: string | null = null;
  let redactMoveOffset = { x: 0, y: 0 };

  function onRedactionPointerDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    selectedRedactionId = id;
    movingRedactionId = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const boxRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    redactMoveOffset = { x: e.clientX - boxRect.left, y: e.clientY - boxRect.top };
  }

  function onRedactionPointerMove(e: PointerEvent, id: string) {
    if (movingRedactionId !== id) return;
    const box = $activeDocument?.redactions.find((b) => b.id === id);
    if (!box) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - redactMoveOffset.x, 0, rect.width - box.width);
    const y = clamp(e.clientY - rect.top - redactMoveOffset.y, 0, rect.height - box.height);
    editorStore.updateRedaction(id, { x, y });
  }

  function onRedactionPointerUp() {
    movingRedactionId = null;
  }

  // Resize via the corner handle — a redaction box is a plain rectangle, so
  // unlike the signature's resize this doesn't need to preserve an aspect ratio.
  const REDACT_MIN_SIZE = 12;
  let resizingRedactionId: string | null = null;
  let redactResizeStart: (RedactionBox & { pointerX: number; pointerY: number }) | null = null;

  function onRedactionResizePointerDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    const box = $activeDocument?.redactions.find((b) => b.id === id);
    if (!box) return;
    resizingRedactionId = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    redactResizeStart = { pointerX: e.clientX, pointerY: e.clientY, ...box };
  }

  function onRedactionResizePointerMove(e: PointerEvent, id: string) {
    if (resizingRedactionId !== id || !redactResizeStart) return;
    const rect = canvasEl.getBoundingClientRect();
    const width = clamp(
      redactResizeStart.width + (e.clientX - redactResizeStart.pointerX),
      REDACT_MIN_SIZE,
      rect.width - redactResizeStart.x,
    );
    const height = clamp(
      redactResizeStart.height + (e.clientY - redactResizeStart.pointerY),
      REDACT_MIN_SIZE,
      rect.height - redactResizeStart.y,
    );
    editorStore.updateRedaction(id, { width, height });
  }

  function onRedactionResizePointerUp(e: PointerEvent) {
    resizingRedactionId = null;
    redactResizeStart = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function removeRedactionBox(e: MouseEvent, id: string) {
    e.stopPropagation();
    editorStore.removeRedaction(id);
    if (selectedRedactionId === id) selectedRedactionId = null;
  }

  function onRedactionKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      editorStore.removeRedaction(id);
      selectedRedactionId = null;
      return;
    }

    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();

    const box = $activeDocument?.redactions.find((b) => b.id === id);
    if (!box) return;

    const rect = canvasEl.getBoundingClientRect();
    const dx = e.key === 'ArrowLeft' ? -KEYBOARD_MOVE_STEP : e.key === 'ArrowRight' ? KEYBOARD_MOVE_STEP : 0;
    const dy = e.key === 'ArrowUp' ? -KEYBOARD_MOVE_STEP : e.key === 'ArrowDown' ? KEYBOARD_MOVE_STEP : 0;
    const x = clamp(box.x + dx, 0, rect.width - box.width);
    const y = clamp(box.y + dy, 0, rect.height - box.height);
    editorStore.updateRedaction(id, { x, y });
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div
  bind:this={wrapperEl}
  role="region"
  aria-label="PDF page — drop the signature here"
  class="relative mx-auto w-fit"
  class:ring-2={isDragOver}
  class:ring-blue-400={isDragOver}
  ondragover={onDragOver}
  ondragleave={() => (isDragOver = false)}
  ondrop={onDrop}
  onpointerdown={onWrapperPointerDown}
  onpointermove={onWrapperPointerMove}
  onpointerup={onWrapperPointerUp}
>
  <canvas
    bind:this={canvasEl}
    class="rounded-lg shadow-lg"
    class:cursor-crosshair={$redactMode}
  ></canvas>

  {#if error}
    <div class="p-4 text-sm text-red-600">{error}</div>
  {/if}

  {#if placementOnCurrentPage && $signatureStore.previewUrl}
    <!-- role="group" is the closest ARIA fit for a movable/resizable object
         (it groups the resize handle and remove button), but that role is
         classified as non-interactive by Svelte's a11y check even though
         this element is deliberately focusable and arrow-key operable. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      data-placed-signature
      role="group"
      tabindex="0"
      aria-label="Placed signature — use arrow keys to move, drag the corner handle to resize"
      class="absolute cursor-move touch-none {selected ? 'ring-2 ring-blue-400/70 bg-blue-100/10' : ''}"
      style:left="{placementOnCurrentPage.x}px"
      style:top="{placementOnCurrentPage.y}px"
      style:width="{placementOnCurrentPage.width}px"
      style:height="{placementOnCurrentPage.height}px"
      onpointerdown={onOverlayPointerDown}
      onpointermove={onOverlayPointerMove}
      onpointerup={onOverlayPointerUp}
      onfocus={() => (selected = true)}
      onkeydown={onOverlayKeydown}
    >
      <img
        src={$signatureStore.previewUrl}
        alt="Placed signature"
        draggable="false"
        class="h-full w-full select-none object-contain"
      />

      {#if previewLines.length > 0}
        <div
          class="pointer-events-none absolute inset-0 flex select-none flex-col overflow-hidden leading-tight"
          style:font-size="{placementOnCurrentPage.height * $watermarkFontScale}px"
          style:color={$watermarkColor}
          style:opacity={$watermarkOpacity}
          style:padding="{placementOnCurrentPage.height * 0.06}px"
          style:justify-content={previewAlign.justifyContent}
          style:align-items={previewAlign.alignItems}
          style:text-align={previewAlign.textAlign}
        >
          {#each previewLines as line}
            <div>{line}</div>
          {/each}
        </div>
      {/if}

      {#if selected}
        <div
          role="button"
          tabindex="0"
          aria-label="Resize signature"
          title="Resize signature (drag, or use arrow keys)"
          class="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize touch-none rounded-full
            border border-white bg-blue-500 shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
          onpointerdown={onResizePointerDown}
          onpointermove={onResizePointerMove}
          onpointerup={onResizePointerUp}
          onkeydown={onResizeKeydown}
        ></div>

        <button
          type="button"
          aria-label="Remove placed signature"
          title="Remove placed signature"
          class="absolute -right-1.5 -top-1.5 flex h-5 w-5 touch-none items-center justify-center rounded-full
            border border-white bg-red-500 text-white shadow transition-colors hover:bg-red-600"
          onpointerdown={(e) => e.stopPropagation()}
          onclick={(e) => {
            e.stopPropagation();
            editorStore.clearPlacement();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-3 w-3">
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  {#each redactionsOnCurrentPage as box (box.id)}
    {@const isSelected = selectedRedactionId === box.id}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      data-redaction={box.id}
      role="group"
      tabindex="0"
      aria-label="Redacted area — permanently removed on export. Use arrow keys to move, Delete to remove."
      class="absolute cursor-move touch-none bg-black {isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}"
      style:left="{box.x}px"
      style:top="{box.y}px"
      style:width="{box.width}px"
      style:height="{box.height}px"
      onpointerdown={(e) => onRedactionPointerDown(e, box.id)}
      onpointermove={(e) => onRedactionPointerMove(e, box.id)}
      onpointerup={onRedactionPointerUp}
      onfocus={() => (selectedRedactionId = box.id)}
      onkeydown={(e) => onRedactionKeydown(e, box.id)}
    >
      {#if isSelected}
        <div
          role="button"
          tabindex="0"
          aria-label="Resize redacted area"
          title="Resize (drag, or use arrow keys)"
          class="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize touch-none rounded-full
            border border-white bg-blue-500 shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
          onpointerdown={(e) => onRedactionResizePointerDown(e, box.id)}
          onpointermove={(e) => onRedactionResizePointerMove(e, box.id)}
          onpointerup={onRedactionResizePointerUp}
        ></div>

        <button
          type="button"
          aria-label="Remove redacted area"
          title="Remove redacted area"
          class="absolute -right-1.5 -top-1.5 flex h-5 w-5 touch-none items-center justify-center rounded-full
            border border-white bg-red-500 text-white shadow transition-colors hover:bg-red-600"
          onpointerdown={(e) => e.stopPropagation()}
          onclick={(e) => removeRedactionBox(e, box.id)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-3 w-3">
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      {/if}
    </div>
  {/each}

  {#if drawingBox}
    <div
      class="pointer-events-none absolute border-2 border-dashed border-red-500 bg-black/60"
      style:left="{drawingBox.x}px"
      style:top="{drawingBox.y}px"
      style:width="{drawingBox.width}px"
      style:height="{drawingBox.height}px"
    ></div>
  {/if}
</div>
