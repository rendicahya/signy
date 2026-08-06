<script lang="ts">
  import { editorStore, DEFAULT_RENDER_SCALE } from '../stores/editor';
  import ExportButton from './ExportButton.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

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

  <div class="flex items-center gap-3">
    {#if $editorStore.pageCount > 1}
      <div class="flex items-center gap-1 rounded-lg border border-neutral-200 px-1 py-1 dark:border-neutral-800">
        <button
          type="button"
          aria-label="Previous page"
          title="Previous page"
          class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed
            disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
          disabled={$editorStore.pageNumber <= 1}
          onclick={() => editorStore.prevPage()}
        >
          ‹
        </button>
        <span class="min-w-[4.5rem] px-1 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          Page {$editorStore.pageNumber} / {$editorStore.pageCount}
        </span>
        <button
          type="button"
          aria-label="Next page"
          title="Next page"
          class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed
            disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
          disabled={$editorStore.pageNumber >= $editorStore.pageCount}
          onclick={() => editorStore.nextPage()}
        >
          ›
        </button>
      </div>
    {/if}

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

    <div class="flex items-center gap-1 rounded-lg border border-neutral-200 px-1 py-1 dark:border-neutral-800">
      <button
        type="button"
        aria-label="Rotate left"
        title="Rotate left"
        class="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        onclick={() => editorStore.rotateLeft()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 14 4 9l5-5" />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 9h10a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6H9"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Rotate right"
        title="Rotate right"
        class="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        onclick={() => editorStore.rotateRight()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="m15 14 5-5-5-5" />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20 9H10a6 6 0 0 0-6 6v0a6 6 0 0 0 6 6h5"
          />
        </svg>
      </button>
    </div>
  </div>

  <div class="flex items-center gap-3">
    <ThemeToggle />
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
