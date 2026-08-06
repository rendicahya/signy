<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    accept?: string;
    onFile: (file: File) => void;
  }

  let { title, subtitle = 'Drag & drop or click to browse', accept = '', onFile }: Props = $props();

  let isDragging = $state(false);
  let inputEl: HTMLInputElement;

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
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
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => (isDragging = false)}
  ondrop={onDrop}
  onclick={() => inputEl.click()}
>
  <span class="text-lg font-medium">{title}</span>
  <span class="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</span>
</button>

<input
  bind:this={inputEl}
  type="file"
  {accept}
  class="hidden"
  onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
/>
