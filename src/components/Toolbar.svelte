<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';
</script>

<header class="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/90
  px-6 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
  <span class="text-2xl font-bold tracking-tight">Signy</span>

  <div class="flex items-center gap-3">
    <ThemeToggle />
  </div>
</header>
