<script lang="ts">
  import { editorStore, activeDocument, DEFAULT_RENDER_SCALE } from '../stores/editor';
  import { clearCachedPdf } from '../lib/pdf/docCache';

  const zoomPercent = $derived(Math.round(($editorStore.renderScale / DEFAULT_RENDER_SCALE) * 100));
  const signedCount = $derived($editorStore.documents.filter((d) => d.placedSignature).length);

  function onSelectChange(e: Event) {
    editorStore.setActiveDocument((e.target as HTMLSelectElement).value);
  }

  function removeActive() {
    const doc = $activeDocument;
    if (!doc) return;
    clearCachedPdf(doc.id);
    editorStore.removeDocument(doc.id);
  }
</script>

<div class="sticky bottom-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-neutral-200
  bg-white/90 px-6 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
  <div class="flex min-w-0 items-center gap-2">
    {#if $editorStore.documents.length > 1}
      <select
        aria-label="Select document"
        class="max-w-[10rem] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700
          focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        value={$activeDocument?.id}
        onchange={onSelectChange}
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
        class="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500
          dark:hover:bg-red-950"
        onclick={removeActive}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="flex items-center gap-3 justify-self-center">
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

  <div></div>
</div>
