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
  import { pageSidebarOpen, togglePageSidebar } from './stores/layout';
  import { isFileAccepted, formatFileSize, MAX_PDF_SIZE_BYTES } from './lib/utils/fileValidation';
  import { clearCachedPdf } from './lib/pdf/docCache';

  const PDF_ACCEPT = 'application/pdf,.pdf';

  let addPdfsError: string | null = $state(null);
  let isPageDragging = $state(false);
  let pageDragDepth = 0;

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
    const typeOk = Array.from(input.files ?? []).filter((f) => isFileAccepted(f, PDF_ACCEPT));
    input.value = '';

    const tooLarge = typeOk.filter((f) => f.size > MAX_PDF_SIZE_BYTES);
    const sized = typeOk.filter((f) => f.size <= MAX_PDF_SIZE_BYTES);

    addPdfsError =
      tooLarge.length > 0
        ? `Skipped (over ${formatFileSize(MAX_PDF_SIZE_BYTES)}): ${tooLarge.map((f) => f.name).join(', ')}`
        : null;

    if (sized.length > 0) editorStore.addPdfs(sized);
  }

  function removeDocument(id: string) {
    clearCachedPdf(id);
    editorStore.removeDocument(id);
  }

  // Lets PDFs be dropped anywhere on the pre-editor screens, not just onto
  // the upload card — dragenter/dragleave bubble from every descendant, so a
  // depth counter is needed to know when the pointer has actually left the
  // page rather than just crossed into a child element.
  function isFileDrag(e: DragEvent): boolean {
    return !readyForEditor && !!e.dataTransfer?.types.includes('Files');
  }

  function onPageDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    pageDragDepth++;
    isPageDragging = true;
  }

  function onPageDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  }

  function onPageDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return;
    pageDragDepth = Math.max(0, pageDragDepth - 1);
    if (pageDragDepth === 0) isPageDragging = false;
  }

  function onPageDrop(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    pageDragDepth = 0;
    isPageDragging = false;

    const dropped = Array.from(e.dataTransfer?.files ?? []);
    const typeOk = dropped.filter((f) => isFileAccepted(f, PDF_ACCEPT));
    if (typeOk.length === 0) {
      addPdfsError = 'Please drop PDF files.';
      return;
    }

    const tooLarge = typeOk.filter((f) => f.size > MAX_PDF_SIZE_BYTES);
    const sized = typeOk.filter((f) => f.size <= MAX_PDF_SIZE_BYTES);

    addPdfsError =
      tooLarge.length > 0
        ? `Skipped (over ${formatFileSize(MAX_PDF_SIZE_BYTES)}): ${tooLarge.map((f) => f.name).join(', ')}`
        : null;

    if (sized.length === 0) return;
    if (editor.documents.length === 0) onPdfFiles(sized);
    else editorStore.addPdfs(sized);
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
  ondragenter={onPageDragEnter}
  ondragover={onPageDragOver}
  ondragleave={onPageDragLeave}
  ondrop={onPageDrop}
>
  {#if isPageDragging}
    <div class="pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-3xl border-4
      border-dashed border-blue-500 bg-blue-50/80 backdrop-blur-sm dark:bg-blue-950/80">
      <span class="text-xl font-medium text-blue-700 dark:text-blue-300">Drop your PDF anywhere</span>
    </div>
  {/if}
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
            maxSizeBytes={MAX_PDF_SIZE_BYTES}
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
            {#if addPdfsError}
              <p class="text-xs text-red-600 dark:text-red-400">{addPdfsError}</p>
            {/if}
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
    <div class="relative flex flex-1 overflow-hidden">
      <PageSidebar />
      <button
        type="button"
        aria-label={$pageSidebarOpen ? 'Hide page panel' : 'Show page panel'}
        title={$pageSidebarOpen ? 'Hide page panel' : 'Show page panel'}
        class="absolute top-1/2 z-20 flex h-10 w-4 -translate-y-1/2 items-center justify-center rounded-r-md
          border border-l-0 border-neutral-200 bg-white text-neutral-400 shadow-sm transition-[left]
          hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900
          dark:text-neutral-500 dark:hover:bg-neutral-800"
        style:left={$pageSidebarOpen ? '11rem' : '0'}
        onclick={togglePageSidebar}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="h-3.5 w-3.5 transition-transform"
          class:rotate-180={!$pageSidebarOpen}
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6" />
        </svg>
      </button>
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
