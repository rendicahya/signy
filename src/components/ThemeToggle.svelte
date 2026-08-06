<script lang="ts">
  import { theme, toggleTheme } from '../stores/theme';
</script>

<button
  type="button"
  aria-label="Toggle dark mode"
  title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors
    hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800
    dark:hover:text-neutral-100"
  onclick={toggleTheme}
>
  {#if $theme === 'dark'}
    <!-- Sun icon: shown when dark is active, click to go light -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4.5 w-4.5">
      <circle cx="12" cy="12" r="4" />
      <path
        stroke-linecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
      />
    </svg>
  {:else}
    <!-- Moon icon: shown when light is active, click to go dark -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4.5 w-4.5">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      />
    </svg>
  {/if}
</button>
