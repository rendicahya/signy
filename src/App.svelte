<script lang="ts">
  import UploadCard from './components/UploadCard.svelte';
  import SignatureUploader from './components/SignatureUploader.svelte';
  import PDFViewer from './components/PDFViewer.svelte';
  import SignaturePanel from './components/SignaturePanel.svelte';
  import PageSidebar from './components/PageSidebar.svelte';
  import BottomToolbar from './components/BottomToolbar.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import ExportButton from './components/ExportButton.svelte';
  import StartOverButton from './components/StartOverButton.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { editorStore, activeDocument } from './stores/editor';
  import { signatureStore } from './stores/signature';
  import { theme } from './stores/theme';
  import { isFileAccepted } from './lib/utils/fileValidation';
  import { clearCachedPdf } from './lib/pdf/docCache';

  const PDF_ACCEPT = 'application/pdf,.pdf';

  const editor = $derived($editorStore);
  const active = $derived($activeDocument);
  const signature = $derived($signatureStore);

  // Requires an explicit "Continue" on step 2 even when a signature is
  // already saved, so returning users get a chance to change it before
  // it's applied to a new batch of PDFs — instead of being rushed straight
  // into the editor with whichever signature happened to be on file.
  let signatureConfirmed = $state(false);

  $effect(() => {
    if (editor.documents.length === 0) signatureConfirmed = false;
  });

  // Only enter the editor once a PDF is uploaded, the signature is ready, and
  // the user has confirmed it — uploading PDFs first should not skip ahead
  // and leave nothing to drag.
  const readyForEditor = $derived(editor.documents.length > 0 && !!signature.signature && signatureConfirmed);

  function onPdfFiles(files: File[]) {
    editorStore.loadPdfs(files);
  }

  function onAddMorePdfs(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((f) => isFileAccepted(f, PDF_ACCEPT));
    input.value = '';
    if (files.length > 0) editorStore.addPdfs(files);
  }

  function removeDocument(id: string) {
    clearCachedPdf(id);
    editorStore.removeDocument(id);
  }

  // Reflect the chosen theme on <html> so Tailwind's `dark:` variants apply.
  $effect(() => {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
  });
</script>

<main
  class="min-h-screen"
  class:flex={readyForEditor}
  class:h-screen={readyForEditor}
  class:flex-col={readyForEditor}
>
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
        <div class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50
          px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950
          dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          100% local — your files never leave this device, nothing is uploaded
        </div>
      </div>

      {#if editor.documents.length === 0}
        <!-- Step 1: upload PDFs. -->
        <div class="w-full max-w-md">
          <UploadCard
            title="Upload PDF"
            subtitle="Drag & drop or click to browse — you can select multiple"
            accept={PDF_ACCEPT}
            multiple
            errorMessage="Please upload PDF files."
            onFiles={onPdfFiles}
          />
        </div>
      {:else}
        <!-- Step 2: PDFs are in — confirm or change the signature (already
             loaded from IndexedDB for returning users), then continue. -->
        <div class="flex w-full max-w-md flex-col gap-6">
          <div class="flex h-40 w-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4
            dark:border-neutral-800 dark:bg-neutral-900">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">
                {editor.documents.length} PDF{editor.documents.length > 1 ? 's' : ''} uploaded
              </span>
              <label class="cursor-pointer text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                + Add more
                <input type="file" accept={PDF_ACCEPT} multiple class="hidden" onchange={onAddMorePdfs} />
              </label>
            </div>
            <ul class="flex-1 space-y-1 overflow-y-auto text-sm">
              {#each editor.documents as doc (doc.id)}
                <li class="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5
                  dark:bg-neutral-800">
                  <span class="truncate">{doc.file.name}</span>
                  <button
                    type="button"
                    aria-label="Remove {doc.file.name}"
                    class="shrink-0 text-neutral-400 hover:text-red-500"
                    onclick={() => removeDocument(doc.id)}
                  >
                    ×
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <SignatureUploader />

          {#if signature.signature}
            <button
              type="button"
              class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors
                hover:bg-blue-700"
              onclick={() => (signatureConfirmed = true)}
            >
              Continue to Editor
            </button>
          {/if}
        </div>

        {#if !signature.signature && !signature.loading}
          <p class="text-sm text-neutral-400">Upload your signature to continue.</p>
        {/if}
      {/if}
    </div>
  {:else if active}
    <Toolbar />
    <div class="flex flex-1 overflow-hidden">
      <PageSidebar />
      <div class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 py-8">
          {#key active.id}
            <PDFViewer />
          {/key}
        </div>
        <BottomToolbar />
      </div>
      <aside class="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-white p-4
        dark:border-neutral-800 dark:bg-neutral-950">
        <SignaturePanel />
        <div class="mt-6 flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <StartOverButton />
          <ExportButton />
        </div>
      </aside>
    </div>
  {/if}
</main>
