<script lang="ts">
  import UploadCard from './UploadCard.svelte';
  import { signatureStore } from '../stores/signature';
  import { isFileAccepted, formatFileSize, MAX_SIGNATURE_SIZE_BYTES } from '../lib/utils/fileValidation';

  const state = $derived($signatureStore);
  let replaceError: string | null = $state(null);

  async function onFile(file: File) {
    await signatureStore.upload(file);
  }

  async function onFiles(files: File[]) {
    const file = files[0];
    if (file) await onFile(file);
  }

  async function onDelete() {
    await signatureStore.remove();
  }

  async function onReplace(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!isFileAccepted(file, 'image/*')) {
      replaceError = 'Please upload an image file.';
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE_BYTES) {
      replaceError = `"${file.name}" is ${formatFileSize(file.size)} — the limit is ${formatFileSize(MAX_SIGNATURE_SIZE_BYTES)}.`;
      return;
    }

    replaceError = null;
    await onFile(file);
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
        <input type="file" accept="image/*" class="hidden" onchange={onReplace} />
      </label>
      <button type="button" class="font-medium text-red-600 hover:underline dark:text-red-400" onclick={onDelete}>
        Delete Signature
      </button>
    </div>
    {#if replaceError}
      <p class="text-sm text-red-600 dark:text-red-400">{replaceError}</p>
    {/if}
  </div>
{:else}
  <UploadCard
    title="Upload Signature"
    accept="image/*"
    errorMessage="Please upload an image file."
    maxSizeBytes={MAX_SIGNATURE_SIZE_BYTES}
    onFiles={onFiles}
  />
{/if}
