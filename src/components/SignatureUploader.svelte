<script lang="ts">
  import UploadCard from './UploadCard.svelte';
  import { signatureStore } from '../stores/signature';

  const state = $derived($signatureStore);

  async function onFile(file: File) {
    await signatureStore.upload(file);
  }

  async function onDelete() {
    await signatureStore.remove();
  }
</script>

{#if state.loading}
  <div class="flex h-64 items-center justify-center text-sm text-neutral-400">Loading signature…</div>
{:else if state.signature && state.previewUrl}
  <div class="flex h-64 w-full flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-200
    bg-neutral-50 p-8 dark:border-neutral-800 dark:bg-neutral-900">
    <img src={state.previewUrl} alt="Saved signature" class="max-h-28 max-w-full object-contain" />
    <div class="flex gap-3 text-sm">
      <label class="cursor-pointer font-medium text-blue-600 hover:underline dark:text-blue-400">
        Replace Signature
        <input
          type="file"
          accept="image/*"
          class="hidden"
          onchange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      <button type="button" class="font-medium text-red-600 hover:underline dark:text-red-400" onclick={onDelete}>
        Delete Signature
      </button>
    </div>
  </div>
{:else}
  <UploadCard title="Upload Signature" accept="image/*" onFile={onFile} />
{/if}
