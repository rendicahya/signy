<script lang="ts">
  import { editorStore, activeDocument } from '../stores/editor';
  import { pageSidebarOpen, togglePageSidebar } from '../stores/layout';
  import ThemeToggle from './ThemeToggle.svelte';
</script>

<header class="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/90
  px-6 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
  <div class="flex items-center gap-3">
    <button
      type="button"
      aria-label={$pageSidebarOpen ? 'Hide page panel' : 'Show page panel'}
      title={$pageSidebarOpen ? 'Hide page panel' : 'Show page panel'}
      class="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      onclick={togglePageSidebar}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </svg>
    </button>
    <span class="text-2xl font-bold tracking-tight">Signy</span>
  </div>

  {#if ($activeDocument?.pageCount ?? 1) > 1}
    <div class="flex items-center gap-1 rounded-lg border border-neutral-200 px-1 py-1 dark:border-neutral-800">
      <button
        type="button"
        aria-label="Previous page"
        title="Previous page"
        class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed
          disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
        disabled={($activeDocument?.pageNumber ?? 1) <= 1}
        onclick={() => editorStore.prevPage()}
      >
        ‹
      </button>
      <span class="min-w-[4.5rem] px-1 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
        Page {$activeDocument?.pageNumber} / {$activeDocument?.pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        title="Next page"
        class="rounded px-2 py-0.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed
          disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
        disabled={($activeDocument?.pageNumber ?? 1) >= ($activeDocument?.pageCount ?? 1)}
        onclick={() => editorStore.nextPage()}
      >
        ›
      </button>
    </div>
  {/if}

  <div class="flex items-center gap-3">
    <ThemeToggle />
  </div>
</header>
