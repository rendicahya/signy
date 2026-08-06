<script lang="ts">
  import { editorStore, DEFAULT_RENDER_SCALE } from '../stores/editor';
  import ExportButton from './ExportButton.svelte';

  const zoomPercent = $derived(Math.round(($editorStore.renderScale / DEFAULT_RENDER_SCALE) * 100));

  function startOver() {
    editorStore.reset();
  }
</script>

<header class="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/90
  px-6 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
  <div class="flex items-center gap-2">
    <span class="text-lg font-semibold">Signy</span>
  </div>

  <div class="flex items-center gap-1 rounded-lg border border-neutral-200 px-1 py-1 dark:border-neutral-800">
    <button
      type="button"
      aria-label="Zoom out"
      class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      onclick={() => editorStore.zoomOut()}
    >
      −
    </button>
    <button
      type="button"
      class="w-12 rounded px-1 py-0.5 text-center text-xs tabular-nums text-neutral-500 hover:bg-neutral-100
        dark:text-neutral-400 dark:hover:bg-neutral-800"
      onclick={() => editorStore.resetZoom()}
      title="Reset zoom"
    >
      {zoomPercent}%
    </button>
    <button
      type="button"
      aria-label="Zoom in"
      class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      onclick={() => editorStore.zoomIn()}
    >
      +
    </button>
  </div>

  <div class="flex items-center gap-3">
    <button
      type="button"
      class="text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      onclick={startOver}
    >
      Start Over
    </button>
    <ExportButton />
  </div>
</header>
