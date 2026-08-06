<script lang="ts">
  import { onMount } from 'svelte';
  import { loadPdf, renderPageToCanvas, type PdfDocument } from '../lib/pdf/loader';
  import { editorStore, type PlacedSignature } from '../stores/editor';
  import { signatureStore } from '../stores/signature';
  import { watermarkText, includeTimestamp, watermarkPosition, type WatermarkPosition } from '../stores/watermark';
  import { lastPlacement, type PlacementRatio } from '../stores/placement';
  import { fitWithinBox } from '../lib/signature/layout';
  import { buildWatermarkLines } from '../lib/watermark/visible';

  interface Props {
    file: File;
  }

  let { file }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let wrapperEl: HTMLDivElement;
  let doc: PdfDocument | null = $state(null);
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

  async function loadDocument() {
    try {
      doc = await loadPdf(file);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load PDF';
    }
  }

  onMount(loadDocument);

  // Re-render the current page whenever the zoom level (or the document) changes.
  $effect(() => {
    const scale = $editorStore.renderScale;
    if (!doc || !canvasEl) return;
    renderPageToCanvas(doc, 1, canvasEl, scale).catch((e) => {
      error = e instanceof Error ? e.message : 'Failed to render PDF';
    });
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

  function placementFromRatio(ratio: PlacementRatio): PlacedSignature {
    const rect = canvasEl.getBoundingClientRect();
    const width = ratio.widthRatio * rect.width;
    const height = ratio.heightRatio * rect.height;
    return {
      width,
      height,
      x: clamp(ratio.xRatio * rect.width, 0, rect.width - width),
      y: clamp(ratio.yRatio * rect.height, 0, rect.height - height),
    };
  }

  function useLastPosition() {
    const ratio = $lastPlacement;
    if (!ratio) return;
    editorStore.placeSignature(placementFromRatio(ratio));
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;

    const sig = $signatureStore;
    const { width, height } = fitWithinBox(sig.naturalWidth, sig.naturalHeight);

    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - width / 2, 0, rect.width - width);
    const y = clamp(e.clientY - rect.top - height / 2, 0, rect.height - height);

    const placement = { x, y, width, height };
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
    const placement = $editorStore.placedSignature;
    if (!placement) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - moveOffset.x, 0, rect.width - placement.width);
    const y = clamp(e.clientY - rect.top - moveOffset.y, 0, rect.height - placement.height);
    editorStore.updatePlacement({ x, y });
  }

  function onOverlayPointerUp() {
    moving = false;
    const placement = $editorStore.placedSignature;
    if (placement) rememberPlacement(placement);
  }

  // Resize via the corner handle, always preserving the signature's aspect ratio.
  const MIN_SIZE = 24;
  let resizing = false;
  let resizeStart: { pointerX: number; pointerY: number; x: number; y: number; width: number; height: number } | null =
    null;

  function onResizePointerDown(e: PointerEvent) {
    e.stopPropagation();
    const placement = $editorStore.placedSignature;
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
    const placement = $editorStore.placedSignature;
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
  {#if !$editorStore.placedSignature && $lastPlacement && $signatureStore.previewUrl}
    <!-- Placed before the canvas so its static (pre-sticky) position starts at the top of the
         page; height:0 keeps it from pushing the canvas down, and sticky pins it below the
         toolbar while scrolling instead of scrolling away with the page. -->
    <div class="sticky top-20 z-10 flex justify-center overflow-visible" style="height: 0;">
      <button
        type="button"
        class="rounded-full border border-blue-300 bg-white/95 px-4 py-1.5 text-sm
          font-medium text-blue-600 shadow-lg backdrop-blur transition-colors hover:bg-blue-50
          dark:border-blue-700 dark:bg-neutral-900/95 dark:text-blue-400 dark:hover:bg-neutral-800"
        onclick={useLastPosition}
      >
        Use last position
      </button>
    </div>
  {/if}

  <canvas bind:this={canvasEl} class="rounded-lg shadow-lg"></canvas>

  {#if error}
    <div class="p-4 text-sm text-red-600">{error}</div>
  {/if}

  {#if $editorStore.placedSignature && $signatureStore.previewUrl}
    <div
      data-placed-signature
      class="absolute cursor-move touch-none border-2 border-blue-400/70 bg-blue-100/10"
      style:left="{$editorStore.placedSignature.x}px"
      style:top="{$editorStore.placedSignature.y}px"
      style:width="{$editorStore.placedSignature.width}px"
      style:height="{$editorStore.placedSignature.height}px"
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
          style:font-size="{$editorStore.placedSignature.height * 0.12}px"
          style:opacity="0.25"
          style:padding="{$editorStore.placedSignature.height * 0.06}px"
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
