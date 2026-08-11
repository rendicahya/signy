<script lang="ts">
  import { editorStore, activeDocument } from '../stores/editor';
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
  import { exportSignedPdf, downloadSignedPdf, exportAllAsZip, downloadZip, resolvePlacement } from '../lib/pdf/export';

  let exportingOne = $state(false);
  let exportingAll = $state(false);
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

  async function onExportOne() {
    const doc = $activeDocument;
    const sig = $signatureStore;

    if (!doc || !sig.signature) {
      error = 'Place your signature on the document first.';
      return;
    }

    exportingOne = true;
    error = null;
    try {
      const placement = await resolvePlacement(doc, $editorStore.renderScale, $lastPlacement);
      if (!placement) {
        error = 'Place your signature on the document first.';
        return;
      }

      const bytes = await exportSignedPdf({
        pdfFile: doc.file,
        signatureBlob: sig.signature.blob,
        placement,
        renderScale: $editorStore.renderScale,
        rotation: doc.rotation,
        watermark: currentWatermark(),
        stripScripts: $stripEmbeddedScripts,
      });
      downloadSignedPdf(bytes, doc.file.name);
      editorStore.markExported();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exportingOne = false;
    }
  }

  async function onExportAll() {
    const documents = $editorStore.documents;
    const sig = $signatureStore;

    if (documents.length === 0 || !sig.signature) {
      error = 'Upload a PDF and a signature first.';
      return;
    }

    exportingAll = true;
    error = null;
    try {
      const result = await exportAllAsZip(
        documents,
        sig.signature.blob,
        $editorStore.renderScale,
        $lastPlacement,
        currentWatermark(),
        $stripEmbeddedScripts,
      );

      if (result.exportedCount === 0) {
        error = 'Place your signature on at least one document first.';
        return;
      }

      downloadZip(result.zipBlob);
      editorStore.markExported();
      error =
        result.skipped.length > 0
          ? `Skipped (no placement yet): ${result.skipped.join(', ')}`
          : null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exportingAll = false;
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
    <span>
      Strip embedded JavaScript from the PDF
      <span class="block text-neutral-400 dark:text-neutral-500">
        Some upload systems reject PDFs containing scripts carried over from the source file.
      </span>
    </span>
  </label>

  <button
    type="button"
    class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors
      hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={exportingOne}
    onclick={onExportOne}
  >
    {exportingOne ? 'Downloading…' : 'Download This PDF'}
  </button>

  {#if $editorStore.documents.length > 1}
    <button
      type="button"
      class="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700
        transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50
        dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      disabled={exportingAll}
      onclick={onExportAll}
    >
      {exportingAll ? 'Zipping…' : 'Download All (ZIP)'}
    </button>
  {/if}
</div>

{#if error}
  <p class="mt-1 text-xs text-red-600">{error}</p>
{/if}
