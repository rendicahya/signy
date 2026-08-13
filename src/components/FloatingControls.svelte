<script lang="ts">
  import { editorStore, activeDocument, DEFAULT_RENDER_SCALE } from '../stores/editor';

  const zoomPercent = $derived(Math.round(($editorStore.renderScale / DEFAULT_RENDER_SCALE) * 100));
  const pageNumbers = $derived(
    $activeDocument ? Array.from({ length: $activeDocument.pageCount }, (_, i) => i + 1) : [],
  );
</script>

<div class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
  <div class="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-full border
    border-neutral-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur dark:border-neutral-800
    dark:bg-neutral-900/90">
    <div class="flex items-center gap-1 rounded-full border border-neutral-200 px-1 py-1 dark:border-neutral-800">
      <button
        type="button"
        aria-label="Previous page"
        title="Previous page (←)"
        class="flex h-7 w-7 items-center justify-center rounded-full text-base text-neutral-600
          hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-300
          dark:hover:bg-neutral-800"
        disabled={($activeDocument?.pageNumber ?? 1) <= 1}
        onclick={() => editorStore.prevPage()}
      >
        ‹
      </button>
      <select
        aria-label="Go to page"
        class="min-w-[4.5rem] rounded-full border-none bg-transparent px-1 py-0.5 text-center text-xs tabular-nums
          text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-400
          disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent
          dark:text-neutral-400 dark:hover:bg-neutral-800"
        disabled={($activeDocument?.pageCount ?? 1) <= 1}
        value={$activeDocument?.pageNumber}
        onchange={(e) => editorStore.goToPage(Number((e.target as HTMLSelectElement).value))}
      >
        {#each pageNumbers as pageNumber (pageNumber)}
          <option value={pageNumber}>Page {pageNumber} / {$activeDocument?.pageCount}</option>
        {/each}
      </select>
      <button
        type="button"
        aria-label="Next page"
        title="Next page (→)"
        class="flex h-7 w-7 items-center justify-center rounded-full text-base text-neutral-600
          hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-300
          dark:hover:bg-neutral-800"
        disabled={($activeDocument?.pageNumber ?? 1) >= ($activeDocument?.pageCount ?? 1)}
        onclick={() => editorStore.nextPage()}
      >
        ›
      </button>
    </div>

    <div class="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"></div>

    <div class="flex items-center gap-1 rounded-full border border-neutral-200 px-1 py-1 dark:border-neutral-800">
      <button
        type="button"
        aria-label="Zoom out"
        class="rounded-full px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        onclick={() => editorStore.zoomOut()}
      >
        −
      </button>
      <button
        type="button"
        class="w-12 rounded-full px-1 py-0.5 text-center text-xs tabular-nums text-neutral-500 hover:bg-neutral-100
          dark:text-neutral-400 dark:hover:bg-neutral-800"
        onclick={() => editorStore.resetZoom()}
        title="Reset zoom"
      >
        {zoomPercent}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        class="rounded-full px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        onclick={() => editorStore.zoomIn()}
      >
        +
      </button>
    </div>

    <div class="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"></div>

    <div class="flex items-center gap-1 rounded-full border border-neutral-200 px-1 py-1 dark:border-neutral-800">
      <button
        type="button"
        aria-label="Rotate left"
        title="Rotate left"
        class="rounded-full p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
        class="rounded-full p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
</div>
