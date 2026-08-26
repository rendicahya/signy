<script lang="ts">
  import { onDestroy } from 'svelte';

  let isFullscreen = $state(!!document.fullscreenElement);

  function onFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  onDestroy(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
</script>

<button
  type="button"
  aria-label="Toggle fullscreen"
  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
  class="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition-colors
    hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800
    dark:hover:text-neutral-100"
  onclick={toggleFullscreen}
>
  {#if isFullscreen}
    <!-- Collapse icon: shown while fullscreen, click to exit -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 4v3a2 2 0 0 1-2 2H4M15 4v3a2 2 0 0 0 2 2h3M9 20v-3a2 2 0 0 0-2-2H4M15 20v-3a2 2 0 0 1 2-2h3"
      />
    </svg>
  {:else}
    <!-- Expand icon: shown while windowed, click to go fullscreen -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 9V6a2 2 0 0 1 2-2h3M20 9V6a2 2 0 0 0-2-2h-3M4 15v3a2 2 0 0 0 2 2h3M20 15v3a2 2 0 0 1-2 2h-3"
      />
    </svg>
  {/if}
</button>
