<script lang="ts">
  import { signatureStore } from '../stores/signature';
  import { editorStore } from '../stores/editor';
  import { watermarkText, includeTimestamp, watermarkPosition, type WatermarkPosition } from '../stores/watermark';
  import { fitWithinBox } from '../lib/signature/layout';

  const state = $derived($signatureStore);

  const POSITIONS: WatermarkPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', 'signature');
  }

  function placeAtDefault() {
    // Simple click-to-place fallback for non-drag interactions (e.g. touch).
    const { width, height } = fitWithinBox(state.naturalWidth, state.naturalHeight);
    editorStore.placeSignature({ x: 40, y: 40, width, height, page: $editorStore.pageNumber });
  }
</script>

<div class="fixed right-6 top-24 z-10 w-56 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl
  dark:border-neutral-800 dark:bg-neutral-900">
  <h3 class="mb-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300">Your Signature</h3>

  {#if state.signature && state.previewUrl}
    <img
      src={state.previewUrl}
      alt="Signature"
      draggable="true"
      class="mx-auto max-h-24 cursor-grab object-contain active:cursor-grabbing"
      ondragstart={onDragStart}
      onclick={placeAtDefault}
    />
    <p class="mt-3 text-center text-xs text-neutral-400">Drag onto the document</p>
    <p class="text-center text-xs text-neutral-400">Resize using the handle after placing</p>

    <div class="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <label for="watermark-text" class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Watermark text
      </label>
      <textarea
        id="watermark-text"
        rows="3"
        placeholder="e.g. Jane Doe&#10;Contract #123"
        class="w-full resize-none rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm
          focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        bind:value={$watermarkText}
      ></textarea>

      <label class="mt-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <input type="checkbox" bind:checked={$includeTimestamp} class="rounded" />
        Stamp current date &amp; time
      </label>

      <p class="mb-1 mt-3 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Watermark position</p>
      <div class="grid w-16 grid-cols-3 gap-1">
        {#each POSITIONS as pos}
          <button
            type="button"
            aria-label={pos}
            class="h-5 w-5 rounded border transition-colors"
            class:border-blue-500={$watermarkPosition === pos}
            class:bg-blue-500={$watermarkPosition === pos}
            class:border-neutral-300={$watermarkPosition !== pos}
            class:dark:border-neutral-600={$watermarkPosition !== pos}
            onclick={() => watermarkPosition.set(pos)}
          ></button>
        {/each}
      </div>

      <p class="mt-2 text-xs text-neutral-400">Stamped onto the signature when you export.</p>
    </div>
  {:else}
    <p class="text-xs text-neutral-400">No signature saved yet.</p>
  {/if}
</div>
