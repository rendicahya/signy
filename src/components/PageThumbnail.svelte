<script lang="ts">
  import { renderPageToCanvas, type PdfDocument } from '../lib/pdf/loader';

  interface Props {
    pdfDoc: PdfDocument;
    pageNumber: number;
    rotation: number;
    isActive: boolean;
    onSelect: () => void;
  }

  let { pdfDoc, pageNumber, rotation, isActive, onSelect }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let error = $state(false);

  const THUMB_SCALE = 0.22;

  $effect(() => {
    if (!canvasEl) return;
    renderPageToCanvas(pdfDoc, pageNumber, canvasEl, THUMB_SCALE, rotation).catch(() => {
      error = true;
    });
  });
</script>

<button
  type="button"
  class="flex w-full flex-col items-center gap-1 rounded-lg border-2 p-1 transition-colors"
  class:border-blue-500={isActive}
  class:border-transparent={!isActive}
  class:hover:border-neutral-300={!isActive}
  class:dark:hover:border-neutral-600={!isActive}
  onclick={onSelect}
>
  <canvas bind:this={canvasEl} class="w-full rounded shadow-sm"></canvas>
  {#if error}
    <span class="text-[10px] text-red-500">Failed to render</span>
  {/if}
  <span class="text-[11px] text-neutral-500 dark:text-neutral-400">{pageNumber}</span>
</button>
