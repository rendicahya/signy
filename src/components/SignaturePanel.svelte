<script lang="ts">
  import { signatureStore } from '../stores/signature';
  import { editorStore, activeDocument } from '../stores/editor';
  import { lastPlacement } from '../stores/placement';
  import { clickToPlaceMode } from '../stores/clickToPlace';
  import {
    watermarkText,
    includeTimestamp,
    watermarkPosition,
    watermarkFontScale,
    WATERMARK_FONT_SCALE_MIN,
    WATERMARK_FONT_SCALE_MAX,
    WATERMARK_FONT_SCALE_STEP,
    watermarkColor,
    watermarkOpacity,
    WATERMARK_OPACITY_MIN,
    WATERMARK_OPACITY_MAX,
    WATERMARK_OPACITY_STEP,
    type WatermarkPosition,
  } from '../stores/watermark';
  import { fitWithinBox } from '../lib/signature/layout';
  import { getCachedPdf } from '../lib/pdf/docCache';
  import { placementFromRatioForDocument } from '../lib/pdf/placement';
  import { isFileAccepted, formatFileSize, MAX_SIGNATURE_SIZE_BYTES } from '../lib/utils/fileValidation';

  const sig = $derived($signatureStore);

  let replaceError: string | null = $state(null);

  async function onReplace(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!isFileAccepted(file, 'image/*')) {
      replaceError = 'Please choose an image file.';
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE_BYTES) {
      replaceError = `"${file.name}" is ${formatFileSize(file.size)} — the limit is ${formatFileSize(MAX_SIGNATURE_SIZE_BYTES)}.`;
      return;
    }

    replaceError = null;
    await signatureStore.upload(file);
  }

  const canUseLastPosition = $derived(!!$lastPlacement);

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
    const doc = $activeDocument;
    if (!doc) return;
    const { width, height } = fitWithinBox(sig.naturalWidth, sig.naturalHeight);
    // Cascade position so repeated clicks don't stack exactly on top of each other.
    const offset = (doc.placedSignatures.length % 6) * 24;
    editorStore.addSignature({ x: 40 + offset, y: 40 + offset, width, height, page: doc.pageNumber });
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
      const { id, ...rest } = placement;
      editorStore.addSignature(rest);
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
        const { id, ...rest } = placement;
        editorStore.setSignaturesForDocument(documents[i].id, [rest]);
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
    <label class="cursor-pointer text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
      {sig.signature ? 'Replace Signature' : 'Add Signature'}
      <input type="file" accept="image/*" class="hidden" onchange={onReplace} />
    </label>
  </div>

  {#if replaceError}
    <p class="mb-2 text-xs text-red-600 dark:text-red-400">{replaceError}</p>
  {/if}

  {#if sig.signature && sig.previewUrl}
    <div class="space-y-2">
      <button
        type="button"
        title="Drag onto the document. Resize using the handle after placing."
        class="mx-auto block border-0 bg-transparent p-0"
        onclick={placeAtDefault}
        aria-label="Place signature on the document"
      >
        <img
          src={sig.previewUrl}
          alt="Signature"
          draggable="true"
          class="mx-auto max-h-24 cursor-grab object-contain active:cursor-grabbing"
          ondragstart={onDragStart}
        />
      </button>

      <label class="flex items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={$clickToPlaceMode}
          class="rounded"
        />
        Click to place mode
      </label>
    </div>

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
            title="Only works if every added PDF is a single page."
            class="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium
              text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50
              dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
            disabled={applyingToAll || !allSinglePage}
            onclick={applyToAllDocuments}
          >
            {applyingToAll ? 'Applying…' : `Apply to All ${$editorStore.documents.length} Documents`}
          </button>
        {/if}
        {#if applyToAllError}
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">{applyToAllError}</p>
        {/if}
      </div>
    {/if}

    <div class="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h4 class="mb-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">Watermark</h4>

      <label for="watermark-text" class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Text
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

      <div class="mt-3 flex items-start justify-between gap-4">
        <div>
          <p class="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">Position</p>
          <div class="grid w-16 grid-cols-3 gap-1">
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
        </div>

        <div>
          <label for="watermark-color" class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Color
          </label>
          <input
            id="watermark-color"
            type="color"
            bind:value={$watermarkColor}
            class="h-6 w-8 cursor-pointer rounded border border-neutral-300 bg-transparent p-0
              dark:border-neutral-600"
          />
        </div>
      </div>

      <p class="mb-1 mt-3 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Size</p>
      <input
        type="range"
        min={WATERMARK_FONT_SCALE_MIN}
        max={WATERMARK_FONT_SCALE_MAX}
        step={WATERMARK_FONT_SCALE_STEP}
        bind:value={$watermarkFontScale}
        class="w-full accent-blue-600"
      />

      <p class="mb-1 mt-3 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Opacity</p>
      <input
        type="range"
        min={WATERMARK_OPACITY_MIN}
        max={WATERMARK_OPACITY_MAX}
        step={WATERMARK_OPACITY_STEP}
        bind:value={$watermarkOpacity}
        class="w-full accent-blue-600"
      />
    </div>
  {:else}
    <p class="text-xs text-neutral-400">
      No signature saved yet — add one above to sign, or use Redact below the document if that's all you need.
    </p>
  {/if}
</div>
