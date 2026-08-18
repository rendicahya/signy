<script lang="ts">
  import { editorStore, activeDocument } from '../stores/editor';
  import { clearCachedPdf } from '../lib/pdf/docCache';

  function selectDocument(id: string) {
    editorStore.setActiveDocument(id);
  }

  function onTabKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectDocument(id);
    }
  }

  function removeDocument(id: string) {
    clearCachedPdf(id);
    editorStore.removeDocument(id);
  }

  // Closing a tab whose signature/redactions were never saved/printed would
  // silently throw away that work, so confirm first — mirrors StartOverButton's
  // "you haven't saved anything yet" guard, just scoped to a single document.
  let pendingCloseId: string | null = $state(null);
  const pendingCloseDoc = $derived($editorStore.documents.find((d) => d.id === pendingCloseId) ?? null);

  function closeDocument(e: MouseEvent, id: string) {
    e.stopPropagation();
    const doc = $editorStore.documents.find((d) => d.id === id);
    const hasUnsavedWork = doc && (doc.placedSignatures.length > 0 || doc.redactions.length > 0) && !doc.exported;
    if (hasUnsavedWork) {
      pendingCloseId = id;
    } else {
      removeDocument(id);
    }
  }

  function confirmClose() {
    if (pendingCloseId) removeDocument(pendingCloseId);
    pendingCloseId = null;
  }

  function cancelClose() {
    pendingCloseId = null;
  }

  const ACTIVE_TAB_CLASS =
    'border-neutral-200 bg-neutral-100 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';
  const INACTIVE_TAB_CLASS =
    'border-neutral-200 text-neutral-500 hover:bg-neutral-100/60 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60';
</script>

<div
  role="tablist"
  aria-label="Open documents"
  class="flex min-w-0 flex-1 items-end gap-0.5 self-stretch overflow-x-auto"
>
  {#each $editorStore.documents as doc (doc.id)}
    {@const isActive = doc.id === $activeDocument?.id}
    <div
      role="tab"
      tabindex="0"
      aria-selected={isActive}
      title={doc.file.name}
      class="group flex min-w-0 max-w-[10rem] shrink-0 cursor-pointer items-center gap-1.5
        rounded-t-lg border border-b-0 px-3 py-1.5 text-xs transition-colors
        {isActive ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS}"
      onclick={() => selectDocument(doc.id)}
      onkeydown={(e) => onTabKeydown(e, doc.id)}
    >
      {#if doc.placedSignatures.length > 0 || doc.redactions.length > 0}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-label="Signed and/or redacted"
          class="h-3 w-3 shrink-0 text-emerald-500"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      {/if}
      <span class="min-w-0 flex-1 truncate">{doc.file.name}</span>
      <button
        type="button"
        aria-label="Close {doc.file.name}"
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-sm leading-none
          text-neutral-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600
          group-hover:opacity-100 dark:hover:bg-red-950/50"
        onclick={(e) => closeDocument(e, doc.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

{#if pendingCloseDoc}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      class="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl
        dark:border-neutral-800 dark:bg-neutral-900"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="close-tab-title"
    >
      <h2 id="close-tab-title" class="text-base font-semibold text-neutral-800 dark:text-neutral-100">
        This document hasn't been saved
      </h2>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        "{pendingCloseDoc.file.name}" has a signature and/or redaction in place but hasn't been downloaded or
        printed yet. Closing this tab will discard it. Are you sure you want to continue?
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100
            dark:text-neutral-300 dark:hover:bg-neutral-800"
          onclick={cancelClose}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          onclick={confirmClose}
        >
          Close Tab
        </button>
      </div>
    </div>
  </div>
{/if}
