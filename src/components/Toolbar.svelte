<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';
  import DocumentTabs from './DocumentTabs.svelte';
</script>

<header class="sticky top-0 z-20 flex items-end gap-4 border-b border-neutral-200 bg-white/90
  px-4 pb-0 pt-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
  <span class="shrink-0 pb-2 text-lg font-bold tracking-tight">Signy</span>

  <DocumentTabs />

  <div class="flex shrink-0 items-center gap-3 pb-2">
    <ThemeToggle />
  </div>
</header>
