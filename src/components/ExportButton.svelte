<script lang="ts">
  import { editorStore, activeDocument, type PdfDocumentState } from '../stores/editor';
  import { signatureStore } from '../stores/signature';
  import {
    watermarkText,
    includeTimestamp,
    watermarkPosition,
    watermarkFontScale,
    watermarkColor,
    watermarkOpacity,
  } from '../stores/watermark';
  import { lastPlacement } from '../stores/placement';
  import { stripEmbeddedScripts } from '../stores/exportOptions';
  import {
    exportSignedPdf,
    downloadSignedPdf,
    downloadPageOnlyPdf,
    exportAllAsZip,
    downloadZip,
    exportMergedPdf,
    downloadMergedPdf,
    resolvePlacements,
    printPdfBytes,
  } from '../lib/pdf/export';
  import MergeOrderDialog from './MergeOrderDialog.svelte';

  let exportingOne = $state(false);
  let exportingPageOnly = $state(false);
  let exportingAll = $state(false);
  let printing = $state(false);
  let showMergeDialog = $state(false);
  let merging = $state(false);
  let error: string | null = $state(null);

  function currentWatermark() {
    return {
      customText: $watermarkText,
      includeTimestamp: $includeTimestamp,
      position: $watermarkPosition,
      fontScale: $watermarkFontScale,
      color: $watermarkColor,
      opacity: $watermarkOpacity,
    };
  }

  // Signing and redacting are independent — resolves whichever of the two
  // this document actually has, and only errors if it has neither.
  async function resolveExportInputs(doc: PdfDocumentState) {
    const sig = $signatureStore;
    const placements = sig.signature ? await resolvePlacements(doc, $editorStore.renderScale, $lastPlacement) : [];

    if (placements.length === 0 && doc.redactions.length === 0 && doc.texts.length === 0) {
      throw new Error('Nothing to export yet — place a signature, draw a redaction, or add text first.');
    }

    return {
      placements: placements.length > 0 ? placements : undefined,
      signatureBlob: placements.length > 0 ? sig.signature?.blob : undefined,
    };
  }

  async function onExportOne() {
    const doc = $activeDocument;
    if (!doc) return;

    exportingOne = true;
    error = null;
    try {
      const { placements, signatureBlob } = await resolveExportInputs(doc);

      const bytes = await exportSignedPdf({
        pdfFile: doc.file,
        documentId: doc.id,
        signatureBlob,
        placements,
        renderScale: $editorStore.renderScale,
        rotation: doc.rotation,
        watermark: currentWatermark(),
        stripScripts: $stripEmbeddedScripts,
        redactions: doc.redactions,
        texts: doc.texts,
      });
      downloadSignedPdf(bytes, doc.file.name);
      editorStore.markDocumentExported(doc.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exportingOne = false;
    }
  }

  async function onExportPageOnly() {
    const doc = $activeDocument;
    if (!doc) return;

    exportingPageOnly = true;
    error = null;
    try {
      const { placements, signatureBlob } = await resolveExportInputs(doc);

      const bytes = await exportSignedPdf({
        pdfFile: doc.file,
        documentId: doc.id,
        signatureBlob,
        placements,
        renderScale: $editorStore.renderScale,
        rotation: doc.rotation,
        watermark: currentWatermark(),
        stripScripts: $stripEmbeddedScripts,
        redactions: doc.redactions,
        texts: doc.texts,
        onlyPage: doc.pageNumber,
      });
      downloadPageOnlyPdf(bytes, doc.file.name, doc.pageNumber);
      editorStore.markDocumentExported(doc.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exportingPageOnly = false;
    }
  }

  async function onPrint() {
    const doc = $activeDocument;
    if (!doc) return;

    printing = true;
    error = null;
    try {
      const { placements, signatureBlob } = await resolveExportInputs(doc);

      const bytes = await exportSignedPdf({
        pdfFile: doc.file,
        documentId: doc.id,
        signatureBlob,
        placements,
        renderScale: $editorStore.renderScale,
        rotation: doc.rotation,
        watermark: currentWatermark(),
        stripScripts: $stripEmbeddedScripts,
        redactions: doc.redactions,
        texts: doc.texts,
      });
      printPdfBytes(bytes);
      editorStore.markDocumentExported(doc.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Print failed';
    } finally {
      printing = false;
    }
  }

  async function onExportAll() {
    const documents = $editorStore.documents;
    const sig = $signatureStore;

    if (documents.length === 0) {
      error = 'Add a PDF first.';
      return;
    }

    exportingAll = true;
    error = null;
    try {
      const result = await exportAllAsZip(
        documents,
        sig.signature?.blob ?? null,
        $editorStore.renderScale,
        $lastPlacement,
        currentWatermark(),
        $stripEmbeddedScripts,
      );

      if (result.exportedCount === 0) {
        error = 'Place a signature or draw a redaction on at least one document first.';
        return;
      }

      downloadZip(result.zipBlob);
      documents
        .filter((doc) => !result.skipped.includes(doc.file.name))
        .forEach((doc) => editorStore.markDocumentExported(doc.id));
      error =
        result.skipped.length > 0
          ? `Skipped (nothing to export): ${result.skipped.join(', ')}`
          : null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exportingAll = false;
    }
  }

  function onOpenMergeDialog() {
    error = null;
    showMergeDialog = true;
  }

  function onCancelMerge() {
    showMergeDialog = false;
  }

  async function onConfirmMerge(orderedIds: string[]) {
    const documents = $editorStore.documents;
    const sig = $signatureStore;

    merging = true;
    error = null;
    try {
      const bytes = await exportMergedPdf(
        documents,
        orderedIds,
        sig.signature?.blob ?? null,
        $editorStore.renderScale,
        $lastPlacement,
        currentWatermark(),
        $stripEmbeddedScripts,
      );
      downloadMergedPdf(bytes);
      documents.forEach((doc) => editorStore.markDocumentExported(doc.id));
      showMergeDialog = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Merge failed';
    } finally {
      merging = false;
    }
  }
</script>

<div class="flex flex-col gap-2">
  <label class="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
    <input
      type="checkbox"
      class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-neutral-300 text-blue-600
        focus:ring-blue-500 dark:border-neutral-600"
      bind:checked={$stripEmbeddedScripts}
    />
    <span>Strip embedded JavaScript from the PDF</span>
  </label>

  <div class="flex gap-2">
    <button
      type="button"
      class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors
        hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={exportingOne}
      onclick={onExportOne}
    >
      {exportingOne ? 'Saving…' : 'Save This PDF'}
    </button>

    <button
      type="button"
      aria-label="Print this PDF"
      title="Print this PDF"
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300
        text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed
        disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      disabled={printing}
      onclick={onPrint}
    >
      {#if printing}
        <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 animate-spin text-neutral-400">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25" />
          <path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M21 12a9 9 0 0 0-9-9" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 9V3h12v6" />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"
          />
          <rect x="6" y="14" width="12" height="7" rx="1" />
        </svg>
      {/if}
    </button>
  </div>

  {#if ($activeDocument?.pageCount ?? 1) > 1}
    <button
      type="button"
      class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700
        transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50
        dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      disabled={exportingPageOnly}
      onclick={onExportPageOnly}
    >
      {exportingPageOnly ? 'Saving…' : `Download This Page Only (${$activeDocument?.pageNumber ?? 1})`}
    </button>
  {/if}

  {#if $editorStore.documents.length > 1}
    <button
      type="button"
      class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700
        transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50
        dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      disabled={exportingAll}
      onclick={onExportAll}
    >
      {exportingAll ? 'Zipping…' : 'Save All (ZIP)'}
    </button>

    <button
      type="button"
      class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700
        transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50
        dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      disabled={merging}
      onclick={onOpenMergeDialog}
    >
      Download All as One PDF
    </button>
  {/if}
</div>

{#if error}
  <p class="mt-1 text-xs text-red-600">{error}</p>
{/if}

{#if showMergeDialog}
  <MergeOrderDialog
    documents={$editorStore.documents.map((doc) => ({ id: doc.id, name: doc.file.name }))}
    {merging}
    onConfirm={onConfirmMerge}
    onCancel={onCancelMerge}
  />
{/if}
