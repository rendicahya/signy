<script lang="ts">
  import { editorStore, activeDocument, DEFAULT_RENDER_SCALE } from '../stores/editor';
  import { clearCachedPdf } from '../lib/pdf/docCache';

  const zoomPercent = $derived(Math.round(($editorStore.renderScale / DEFAULT_RENDER_SCALE) * 100));
  const pageNumbers = $derived(
    $activeDocument ? Array.from({ length: $activeDocument.pageCount }, (_, i) => i + 1) : [],
  );
  const signedCount = $derived($editorStore.documents.filter((d) => d.placedSignature).length);
  const activeIndex = $derived($editorStore.documents.findIndex((d) => d.id === $activeDocument?.id));

  function onSelectDocument(e: Event) {
    editorStore.setActiveDocument((e.target as HTMLSelectElement).value);
  }

  function removeActiveDocument() {
    const doc = $activeDocument;
    if (!doc) return;
    clearCachedPdf(doc.id);
    editorStore.removeDocument(doc.id);
  }
</script>

<div class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
  <div class="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-full border
    border-neutral-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur dark:border-neutral-800
    dark:bg-neutral-900/90">
    {#if $editorStore.documents.length > 1}
      <div class="flex items-center gap-1 rounded-full border border-neutral-200 px-1 py-1 dark:border-neutral-800">
        <button
          type="button"
          aria-label="Previous document"
          title="Previous document (Ctrl+←)"
          class="flex h-7 w-7 items-center justify-center rounded-full text-sm text-neutral-600
            hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-300
            dark:hover:bg-neutral-800"
          disabled={activeIndex <= 0}
          onclick={() => editorStore.prevDocument()}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next document"
          title="Next document (Ctrl+→)"
          class="flex h-7 w-7 items-center justify-center rounded-full text-sm text-neutral-600
            hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-300
            dark:hover:bg-neutral-800"
          disabled={activeIndex === -1 || activeIndex >= $editorStore.documents.length - 1}
          onclick={() => editorStore.nextDocument()}
        >
          ›
        </button>
      </div>

      <select
        aria-label="Select document"
        class="max-w-[9rem] rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700
          focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        value={$activeDocument?.id}
        onchange={onSelectDocument}
      >
        {#each $editorStore.documents as doc (doc.id)}
          <option value={doc.id}>{doc.placedSignature ? '✓ ' : ''}{doc.file.name}</option>
        {/each}
      </select>

      <span class="hidden whitespace-nowrap text-xs text-neutral-400 sm:inline">
        {signedCount} / {$editorStore.documents.length} signed
      </span>

      <button
        type="button"
        aria-label="Remove {$activeDocument?.file.name}"
        title="Remove this document"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400
          transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50"
        onclick={removeActiveDocument}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
      </button>

      <div class="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"></div>
    {/if}

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
