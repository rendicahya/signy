<script lang="ts">
  import { editorStore } from '../stores/editor';
  import { signatureStore } from '../stores/signature';
  import { watermarkText, includeTimestamp, watermarkPosition } from '../stores/watermark';
  import { exportSignedPdf, downloadSignedPdf } from '../lib/pdf/export';

  let exporting = $state(false);
  let error: string | null = $state(null);

  async function onExport() {
    const editor = $editorStore;
    const sig = $signatureStore;

    if (!editor.pdfFile || !editor.placedSignature || !sig.signature) {
      error = 'Place your signature on the document first.';
      return;
    }

    exporting = true;
    error = null;
    try {
      const bytes = await exportSignedPdf({
        pdfFile: editor.pdfFile,
        signatureBlob: sig.signature.blob,
        placement: editor.placedSignature,
        renderScale: editor.renderScale,
        watermark: { customText: $watermarkText, includeTimestamp: $includeTimestamp, position: $watermarkPosition },
      });
      downloadSignedPdf(bytes, editor.pdfFile.name);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      exporting = false;
    }
  }
</script>

<button
  type="button"
  class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors
    hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  disabled={exporting}
  onclick={onExport}
>
  {exporting ? 'Exporting…' : 'Export PDF'}
</button>

{#if error}
  <p class="mt-1 text-xs text-red-600">{error}</p>
{/if}
