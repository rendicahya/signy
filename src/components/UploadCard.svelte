<script lang="ts">
  import { isFileAccepted } from '../lib/utils/fileValidation';

  interface Props {
    title: string;
    subtitle?: string;
    accept?: string;
    /** Shown when a rejected file is dropped or picked. */
    errorMessage?: string;
    onFile: (file: File) => void;
  }

  let {
    title,
    subtitle = 'Drag & drop or click to browse',
    accept = '',
    errorMessage = 'That file type is not supported.',
    onFile,
  }: Props = $props();

  let isDragging = $state(false);
  let error: string | null = $state(null);
  let inputEl: HTMLInputElement;

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!isFileAccepted(file, accept)) {
      error = errorMessage;
      return;
    }

    error = null;
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }
</script>

<button
  type="button"
  class="group flex h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
    border-neutral-300 bg-neutral-50 p-8 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-100
    dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
  class:border-blue-500={isDragging}
  class:bg-blue-50={isDragging}
  class:border-red-400={!!error}
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => (isDragging = false)}
  ondrop={onDrop}
  onclick={() => inputEl.click()}
>
  <span class="text-lg font-medium">{title}</span>
  <span class="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</span>
  {#if error}
    <span class="text-sm text-red-600 dark:text-red-400">{error}</span>
  {/if}
</button>

<input
  bind:this={inputEl}
  type="file"
  {accept}
  class="hidden"
  onchange={(e) => {
    handleFiles((e.target as HTMLInputElement).files);
    (e.target as HTMLInputElement).value = '';
  }}
/>
