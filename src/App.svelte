<script lang="ts">
  import UploadCard from './components/UploadCard.svelte';
  import SignatureUploader from './components/SignatureUploader.svelte';
  import PDFViewer from './components/PDFViewer.svelte';
  import SignaturePanel from './components/SignaturePanel.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { editorStore } from './stores/editor';
  import { signatureStore } from './stores/signature';
  import { theme } from './stores/theme';

  const editor = $derived($editorStore);
  const signature = $derived($signatureStore);

  // Only enter the editor once both the PDF and the signature are ready —
  // uploading the PDF first should not skip ahead and leave nothing to drag.
  const readyForEditor = $derived(!!editor.pdfFile && !!signature.signature);

  function onPdfFile(file: File) {
    editorStore.loadPdf(file);
  }

  // Reflect the chosen theme on <html> so Tailwind's `dark:` variants apply.
  $effect(() => {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
  });
</script>

<main class="min-h-screen">
  {#if !readyForEditor}
    <div class="fixed right-4 top-4 z-10">
      <ThemeToggle />
    </div>
    <div class="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6">
      <div class="text-center">
        <h1 class="text-3xl font-semibold">Signy</h1>
        <p class="mt-2 text-neutral-500 dark:text-neutral-400">
          Sign PDFs with a protected handwritten signature. Entirely in your browser.
        </p>
      </div>

      <div class="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        {#if editor.pdfFile}
          <div class="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-200
            bg-neutral-50 p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <span class="text-lg font-medium">PDF Uploaded</span>
            <span class="max-w-full truncate text-sm text-neutral-500 dark:text-neutral-400">{editor.pdfFile.name}</span>
            <button
              type="button"
              class="mt-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              onclick={() => editorStore.reset()}
            >
              Replace
            </button>
          </div>
        {:else}
          <UploadCard title="Upload PDF" subtitle="Drag & drop or click to browse" accept="application/pdf" onFile={onPdfFile} />
        {/if}
        <SignatureUploader />
      </div>

      {#if editor.pdfFile && !signature.signature && !signature.loading}
        <p class="text-sm text-neutral-400">Upload your signature to continue.</p>
      {/if}
    </div>
  {:else}
    <Toolbar />
    <div class="relative px-6 py-8">
      <PDFViewer file={editor.pdfFile} />
      <SignaturePanel />
    </div>
  {/if}
</main>
