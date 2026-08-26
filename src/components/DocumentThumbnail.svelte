<script lang="ts">
  import { renderPageToCanvas } from '../lib/pdf/loader';
  import { getCachedPdf } from '../lib/pdf/docCache';

  interface Props {
    id: string;
    file: File;
  }

  let { id, file }: Props = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let error = $state(false);

  const THUMB_SCALE = 0.2;

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    error = false;
    getCachedPdf(id, file)
      .then((pdfDoc) => renderPageToCanvas(pdfDoc, 1, canvas, THUMB_SCALE, 0))
      .catch(() => {
        error = true;
      });
  });
</script>

<div
  class="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded border
    border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
>
  {#if error}
    <span class="text-[9px] leading-tight text-red-500">Error</span>
  {:else}
    <canvas bind:this={canvasEl} class="max-h-full max-w-full"></canvas>
  {/if}
</div>
