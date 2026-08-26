<script lang="ts">
  import { editorStore, activeDocument, DEFAULT_RENDER_SCALE } from '../stores/editor';
  import { redactMode } from '../stores/redact';
  import { textToolMode } from '../stores/textTool';
  import { clickToPlaceMode } from '../stores/clickToPlace';
  import { getCachedPdf } from '../lib/pdf/docCache';
  import { boxToRatio, placementFromRatioForDocument } from '../lib/pdf/placement';

  const zoomPercent = $derived(Math.round(($editorStore.renderScale / DEFAULT_RENDER_SCALE) * 100));
  const pageNumbers = $derived(
    $activeDocument ? Array.from({ length: $activeDocument.pageCount }, (_, i) => i + 1) : [],
  );

  // Redact and Add Text are mutually exclusive click-driven modes on the
  // canvas — enabling one turns the other off so a click has one unambiguous meaning.
  function toggleRedactMode() {
    redactMode.update((v) => !v);
    if ($redactMode) textToolMode.set(false);
  }

  function toggleTextToolMode() {
    textToolMode.update((v) => !v);
    if ($textToolMode) {
      redactMode.set(false);
      clickToPlaceMode.set(false);
    }
  }

  const canApplyRedactionToAll = $derived(
    $editorStore.documents.length > 1 && ($activeDocument?.redactions.length ?? 0) > 0,
  );

  let applyingRedactionToAll = $state(false);
  let applyRedactionError: string | null = $state(null);
  let applyRedactionSuccess: string | null = $state(null);
  let applyRedactionSuccessTimeout: ReturnType<typeof setTimeout> | undefined;

  // Makes every other open document's redactions match the active document's
  // exactly — not a merge: each target's whole redaction set is replaced with
  // a converted copy of the active document's boxes, so re-running this after
  // moving/resizing/adding/removing boxes on the active document always
  // leaves the others in sync rather than accumulating leftovers. A box whose
  // page doesn't exist on a given target is simply dropped for that target.
  async function applyRedactionsToAll() {
    const active = $activeDocument;
    const documents = $editorStore.documents;
    if (!active || active.redactions.length === 0) return;

    applyingRedactionToAll = true;
    applyRedactionError = null;
    applyRedactionSuccess = null;
    clearTimeout(applyRedactionSuccessTimeout);
    try {
      const activePdf = await getCachedPdf(active.id, active.file);
      const ratios = await Promise.all(
        active.redactions.map(async (box) => ({
          page: box.page,
          ratio: await boxToRatio(activePdf, box.page, $editorStore.renderScale, active.rotation, box),
        })),
      );

      const partiallySynced: string[] = [];

      for (const doc of documents) {
        if (doc.id === active.id) continue;

        const applicable = ratios.filter((r) => r.page <= doc.pageCount);
        if (applicable.length < ratios.length) partiallySynced.push(doc.file.name);

        const pdfjsDoc = await getCachedPdf(doc.id, doc.file);
        const newBoxes = await Promise.all(
          applicable.map((r) =>
            placementFromRatioForDocument(pdfjsDoc, r.page, $editorStore.renderScale, doc.rotation, r.ratio),
          ),
        );
        editorStore.setRedactionsForDocument(doc.id, newBoxes);
      }

      if (partiallySynced.length > 0) {
        applyRedactionError = `Not fully synced (fewer pages there): ${partiallySynced.join(', ')}`;
      } else {
        const count = documents.length - 1;
        applyRedactionSuccess = `Applied to ${count} other document${count > 1 ? 's' : ''}`;
        applyRedactionSuccessTimeout = setTimeout(() => (applyRedactionSuccess = null), 2500);
      }
    } catch (e) {
      applyRedactionError = e instanceof Error ? e.message : 'Failed to apply redaction to all documents';
    } finally {
      applyingRedactionToAll = false;
    }
  }
</script>

<div class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-1.5 px-4">
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

    <div class="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"></div>

    <button
      type="button"
      aria-pressed={$redactMode}
      title="Redact — draw a box to permanently remove content from the exported PDF"
      class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
      class:border-neutral-200={!$redactMode}
      class:text-neutral-600={!$redactMode}
      class:hover:bg-neutral-100={!$redactMode}
      class:dark:border-neutral-800={!$redactMode}
      class:dark:text-neutral-300={!$redactMode}
      class:dark:hover:bg-neutral-800={!$redactMode}
      class:border-red-600={$redactMode}
      class:bg-red-600={$redactMode}
      class:text-white={$redactMode}
      onclick={toggleRedactMode}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path stroke-linecap="round" d="M8 12h8" />
      </svg>
      Redact
    </button>

    <button
      type="button"
      aria-pressed={$textToolMode}
      title="Add Text — click on the document to place a text box"
      class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
      class:border-neutral-200={!$textToolMode}
      class:text-neutral-600={!$textToolMode}
      class:hover:bg-neutral-100={!$textToolMode}
      class:dark:border-neutral-800={!$textToolMode}
      class:dark:text-neutral-300={!$textToolMode}
      class:dark:hover:bg-neutral-800={!$textToolMode}
      class:border-blue-600={$textToolMode}
      class:bg-blue-600={$textToolMode}
      class:text-white={$textToolMode}
      onclick={toggleTextToolMode}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 6h14M12 6v12" />
      </svg>
      Add Text
    </button>

    {#if canApplyRedactionToAll}
      <button
        type="button"
        title="Make every other open document's redactions match this one exactly"
        class="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600
          transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50
          dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
        disabled={applyingRedactionToAll}
        onclick={applyRedactionsToAll}
      >
        {applyingRedactionToAll ? 'Applying…' : `Apply Redaction to All ${$editorStore.documents.length}`}
      </button>
    {/if}
  </div>

  {#if applyRedactionError}
    <p class="pointer-events-auto mt-1 max-w-full rounded-full bg-white/90 px-3 py-1 text-center text-xs
      text-red-600 shadow dark:bg-neutral-900/90 dark:text-red-400">
      {applyRedactionError}
    </p>
  {:else if applyRedactionSuccess}
    <p class="pointer-events-auto mt-1 flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-3 py-1
      text-center text-xs text-emerald-600 shadow dark:bg-neutral-900/90 dark:text-emerald-400">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-3 w-3 shrink-0">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {applyRedactionSuccess}
    </p>
  {/if}
</div>
