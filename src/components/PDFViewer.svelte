<script lang="ts">
  import { onMount } from 'svelte';
  import { renderPageToCanvas, type PdfDocument } from '../lib/pdf/loader';
  import { getCachedPdf } from '../lib/pdf/docCache';
  import { editorStore, activeDocument, type PlacedSignature } from '../stores/editor';
  import { signatureStore } from '../stores/signature';
  import { watermarkText, includeTimestamp, watermarkPosition, type WatermarkPosition } from '../stores/watermark';
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
  }

  // Let the placed signature be moved after it's dropped.
  let moving = false;
  let moveOffset = { x: 0, y: 0 };

  function onOverlayPointerDown(e: PointerEvent) {
    const current = wrapperEl.querySelector('[data-placed-signature]') as HTMLElement | null;
    if (!current) return;
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

  // Resize via the corner handle, always preserving the signature's aspect ratio.
  const MIN_SIZE = 24;
  let resizing = false;
  let resizeStart: (PlacedSignature & { pointerX: number; pointerY: number }) | null = null;

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

    const rect = canvasEl.getBoundingClientRect();
    const aspect = resizeStart.width / resizeStart.height;
    const deltaX = e.clientX - resizeStart.pointerX;

    let width = clamp(resizeStart.width + deltaX, MIN_SIZE, rect.width - resizeStart.x);
    let height = width / aspect;

    const maxHeight = rect.height - resizeStart.y;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    if (height < MIN_SIZE) {
      height = MIN_SIZE;
      width = height * aspect;
    }

    editorStore.updatePlacement({ width, height });
  }

  function onResizePointerUp(e: PointerEvent) {
    resizing = false;
    resizeStart = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const placement = $activeDocument?.placedSignature;
    if (placement) rememberPlacement(placement);
  }
</script>

<div
  bind:this={wrapperEl}
  class="relative mx-auto w-fit"
  class:ring-2={isDragOver}
  class:ring-blue-400={isDragOver}
  ondragover={onDragOver}
  ondragleave={() => (isDragOver = false)}
  ondrop={onDrop}
>
  <canvas bind:this={canvasEl} class="rounded-lg shadow-lg"></canvas>

  {#if error}
    <div class="p-4 text-sm text-red-600">{error}</div>
  {/if}

  {#if placementOnCurrentPage && $signatureStore.previewUrl}
    <div
      data-placed-signature
      class="absolute cursor-move touch-none border-2 border-blue-400/70 bg-blue-100/10"
      style:left="{placementOnCurrentPage.x}px"
      style:top="{placementOnCurrentPage.y}px"
      style:width="{placementOnCurrentPage.width}px"
      style:height="{placementOnCurrentPage.height}px"
      onpointerdown={onOverlayPointerDown}
      onpointermove={onOverlayPointerMove}
      onpointerup={onOverlayPointerUp}
    >
      <img
        src={$signatureStore.previewUrl}
        alt="Placed signature"
        draggable="false"
        class="h-full w-full select-none object-contain"
      />

      {#if previewLines.length > 0}
        <div
          class="pointer-events-none absolute inset-0 flex select-none flex-col overflow-hidden leading-tight text-black"
          style:font-size="{placementOnCurrentPage.height * 0.12}px"
          style:opacity="0.25"
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

      <div
        class="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize touch-none rounded-full
          border border-white bg-blue-500 shadow"
        onpointerdown={onResizePointerDown}
        onpointermove={onResizePointerMove}
        onpointerup={onResizePointerUp}
      ></div>
    </div>
  {/if}
</div>
