import { writable } from 'svelte/store';
import { saveSignature, loadSignature, deleteSignature, type StoredSignature } from '../lib/signature/db';

export interface SignatureState {
  loading: boolean;
  signature: StoredSignature | null;
  /** Object URL for <img> preview; revoked automatically on change. */
  previewUrl: string | null;
  /** Natural pixel dimensions of the signature image, used to keep its aspect ratio. */
  naturalWidth: number;
  naturalHeight: number;
}

async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

function createSignatureStore() {
  const { subscribe, update, set } = writable<SignatureState>({
    loading: true,
    signature: null,
    previewUrl: null,
    naturalWidth: 0,
    naturalHeight: 0,
  });

  function setPreview(state: SignatureState, signature: StoredSignature | null): SignatureState {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    return {
      loading: false,
      signature,
      previewUrl: signature ? URL.createObjectURL(signature.blob) : null,
      naturalWidth: 0,
      naturalHeight: 0,
    };
  }

  async function applyDimensions(signature: StoredSignature) {
    const { width, height } = await readDimensions(signature.blob);
    update((state) =>
      // Only apply if this is still the current signature (avoid races on rapid replace).
      state.signature === signature ? { ...state, naturalWidth: width, naturalHeight: height } : state,
    );
  }

  async function init() {
    const signature = (await loadSignature()) ?? null;
    update((state) => setPreview(state, signature));
    if (signature) await applyDimensions(signature);
  }

  async function upload(file: File) {
    const signature = await saveSignature(file);
    update((state) => setPreview(state, signature));
    await applyDimensions(signature);
  }

  async function remove() {
    await deleteSignature();
    update((state) => setPreview(state, null));
  }

  // Kick off the initial load; consumers can show a spinner via `loading`.
  init();

  return { subscribe, upload, remove, set };
}

export const signatureStore = createSignatureStore();
