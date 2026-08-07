<script lang="ts">
  import { signatureStore } from '../stores/signature';
  import { editorStore, activeDocument } from '../stores/editor';
  import { lastPlacement } from '../stores/placement';
  import {
    watermarkText,
    includeTimestamp,
    watermarkPosition,
    watermarkFontScale,
    WATERMARK_FONT_SCALE_MIN,
    WATERMARK_FONT_SCALE_MAX,
    WATERMARK_FONT_SCALE_STEP,
    watermarkColor,
    type WatermarkPosition,
  } from '../stores/watermark';
  import { fitWithinBox } from '../lib/signature/layout';
  import { getCachedPdf } from '../lib/pdf/docCache';
  import { placementFromRatioForDocument } from '../lib/pdf/placement';
  import { isFileAccepted } from '../lib/utils/fileValidation';

  const sig = $derived($signatureStore);

  let replaceError: string | null = $state(null);

  async function onReplace(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!isFileAccepted(file, 'image/*')) {
      replaceError = 'Please upload an image file.';
      return;
    }

    replaceError = null;
    await signatureStore.upload(file);
  }

  // Only offer to reuse the last placement when the active document's
  // current page doesn't already have one of its own.
  const placementOnCurrentPage = $derived.by(() => {
    const doc = $activeDocument;
    if (!doc?.placedSignature) return null;
    return doc.placedSignature.page === doc.pageNumber ? doc.placedSignature : null;
  });

  const canUseLastPosition = $derived(!placementOnCurrentPage && !!$lastPlacement);

  let applyingLastPosition = $state(false);

  let applyingToAll = $state(false);
  let applyToAllError: string | null = $state(null);

  // Page counts are resolved eagerly for every uploaded document (not just
  // the active one) as soon as they're added — see stores/editor.ts — so
  // this reliably reflects every document's real length, not just whichever
  // one has been opened so far.
  const allSinglePage = $derived($editorStore.documents.every((d) => d.pageCount === 1));

  const POSITIONS: WatermarkPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', 'signature');
  }

  function placeAtDefault() {
    // Simple click-to-place fallback for non-drag interactions (e.g. touch).
    const { width, height } = fitWithinBox(sig.naturalWidth, sig.naturalHeight);
    editorStore.placeSignature({ x: 40, y: 40, width, height, page: $activeDocument?.pageNumber ?? 1 });
  }

  async function useLastPosition() {
    const doc = $activeDocument;
    const ratio = $lastPlacement;
    if (!doc || !ratio) return;

    applyingLastPosition = true;
    try {
      const pdfjsDoc = await getCachedPdf(doc.id, doc.file);
      const placement = await placementFromRatioForDocument(
        pdfjsDoc,
        doc.pageNumber,
        $editorStore.renderScale,
        doc.rotation,
        ratio,
      );
      editorStore.placeSignature(placement);
    } finally {
      applyingLastPosition = false;
    }
  }

  // Applies the current placement's ratio to page 1 of every uploaded
  // document, so one signature placement can be affixed across a whole
  // batch of single-page PDFs at once. A document's real page count isn't
  // known until it's actually been opened (pageCount defaults to 1 until
  // then), so every document is loaded and checked here rather than trusting
  // the store's possibly-stale pageCount.
  async function applyToAllDocuments() {
    const ratio = $lastPlacement;
    const documents = $editorStore.documents;
    if (!ratio) return;

    applyingToAll = true;
    applyToAllError = null;
    try {
      const pdfDocs = await Promise.all(documents.map((doc) => getCachedPdf(doc.id, doc.file)));
      const multiPage = documents.filter((_, i) => pdfDocs[i].numPages > 1).map((doc) => doc.file.name);

      if (multiPage.length > 0) {
        applyToAllError = `Skipped — not single-page: ${multiPage.join(', ')}`;
        return;
      }

      for (let i = 0; i < documents.length; i++) {
        const placement = await placementFromRatioForDocument(
          pdfDocs[i],
          1,
          $editorStore.renderScale,
          documents[i].rotation,
          ratio,
        );
        editorStore.setPlacementForDocument(documents[i].id, placement);
      }
    } catch (e) {
      applyToAllError = e instanceof Error ? e.message : 'Failed to apply to all documents';
    } finally {
      applyingToAll = false;
    }
  }
</script>

<div>
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Your Signature</h3>
    {#if sig.signature}
      <label class="cursor-pointer text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
        Replace Signature
        <input type="file" accept="image/*" class="hidden" onchange={onReplace} />
      </label>
    {/if}
  </div>

  {#if replaceError}
    <p class="mb-2 text-xs text-red-600 dark:text-red-400">{replaceError}</p>
  {/if}

  {#if sig.signature && sig.previewUrl}
    <img
      src={sig.previewUrl}
      alt="Signature"
      draggable="true"
      class="mx-auto max-h-24 cursor-grab object-contain active:cursor-grabbing"
      ondragstart={onDragStart}
      onclick={placeAtDefault}
    />
    <p class="mt-3 text-center text-xs text-neutral-400">Drag onto the document</p>
    <p class="text-center text-xs text-neutral-400">Resize using the handle after placing</p>

    {#if canUseLastPosition}
      <button
        type="button"
        class="mt-3 w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium
          text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50
          dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
        disabled={applyingLastPosition}
        onclick={useLastPosition}
      >
        {applyingLastPosition ? 'Placing…' : 'Use last position'}
      </button>
    {/if}

    {#if $editorStore.documents.length > 1}
      <div class="mt-3">
        {#if $lastPlacement}
          <button
            type="button"
            class="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium
              text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50
              dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
            disabled={applyingToAll || !allSinglePage}
            onclick={applyToAllDocuments}
          >
            {applyingToAll ? 'Applying…' : `Apply to All ${$editorStore.documents.length} Documents`}
          </button>
        {/if}
        <p class="mt-1 text-xs text-neutral-400">Only works if every uploaded PDF is a single page.</p>
        {#if applyToAllError}
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">{applyToAllError}</p>
        {/if}
      </div>
    {/if}

    <div class="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <label for="watermark-text" class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Watermark text
      </label>
      <textarea
        id="watermark-text"
        rows="3"
        placeholder="e.g. Jane Doe&#10;Contract #123"
        class="w-full resize-none rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm
          focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        bind:value={$watermarkText}
      ></textarea>

      <label class="mt-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <input type="checkbox" bind:checked={$includeTimestamp} class="rounded" />
        Stamp current date &amp; time
      </label>

      <p class="mb-1 mt-3 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Watermark position</p>
      <div class="mx-auto grid w-16 grid-cols-3 gap-1">
        {#each POSITIONS as pos}
          <button
            type="button"
            aria-label={pos}
            class="h-5 w-5 rounded border transition-colors"
            class:border-blue-500={$watermarkPosition === pos}
            class:bg-blue-500={$watermarkPosition === pos}
            class:border-neutral-300={$watermarkPosition !== pos}
            class:dark:border-neutral-600={$watermarkPosition !== pos}
            onclick={() => watermarkPosition.set(pos)}
          ></button>
        {/each}
      </div>

      <p class="mb-1 mt-3 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Watermark size</p>
      <input
        type="range"
        min={WATERMARK_FONT_SCALE_MIN}
        max={WATERMARK_FONT_SCALE_MAX}
        step={WATERMARK_FONT_SCALE_STEP}
        bind:value={$watermarkFontScale}
        class="w-full accent-blue-600"
      />

      <div class="mb-1 mt-3 flex items-center justify-between">
        <label for="watermark-color" class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Watermark color
        </label>
        <input
          id="watermark-color"
          type="color"
          bind:value={$watermarkColor}
          class="h-6 w-8 cursor-pointer rounded border border-neutral-300 bg-transparent p-0
            dark:border-neutral-600"
        />
      </div>

      <p class="mt-2 text-xs text-neutral-400">Stamped onto the signature when you export.</p>
    </div>
  {:else}
    <p class="text-xs text-neutral-400">No signature saved yet.</p>
  {/if}
</div>
