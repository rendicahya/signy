import { writable } from 'svelte/store';

/** Signature instance placed on the page, in canvas pixel coordinates. */
export interface PlacedSignature {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorState {
  pdfFile: File | null;
  pageNumber: number;
  placedSignature: PlacedSignature | null;
  /** pdf.js render scale for the visible canvas; also used to map placement back to PDF points on export. */
  renderScale: number;
}

export const DEFAULT_RENDER_SCALE = 1.5;
const MIN_RENDER_SCALE = 0.5;
const MAX_RENDER_SCALE = 4;
const ZOOM_STEP = 1.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rescale(state: EditorState, nextScale: number): EditorState {
  const renderScale = clamp(nextScale, MIN_RENDER_SCALE, MAX_RENDER_SCALE);
  const factor = renderScale / state.renderScale;
  // Rescale the placed signature so it stays over the same spot on the page as we zoom.
  const placedSignature = state.placedSignature
    ? {
        x: state.placedSignature.x * factor,
        y: state.placedSignature.y * factor,
        width: state.placedSignature.width * factor,
        height: state.placedSignature.height * factor,
      }
    : null;
  return { ...state, renderScale, placedSignature };
}

function createEditorStore() {
  const { subscribe, update, set } = writable<EditorState>({
    pdfFile: null,
    pageNumber: 1,
    placedSignature: null,
    renderScale: DEFAULT_RENDER_SCALE,
  });

  function loadPdf(file: File) {
    set({ pdfFile: file, pageNumber: 1, placedSignature: null, renderScale: DEFAULT_RENDER_SCALE });
  }

  function placeSignature(placement: PlacedSignature) {
    update((state) => ({ ...state, placedSignature: placement }));
  }

  function updatePlacement(partial: Partial<PlacedSignature>) {
    update((state) => ({
      ...state,
      placedSignature: state.placedSignature ? { ...state.placedSignature, ...partial } : null,
    }));
  }

  function setRenderScale(nextScale: number) {
    update((state) => rescale(state, nextScale));
  }

  function zoomIn() {
    update((state) => rescale(state, state.renderScale * ZOOM_STEP));
  }

  function zoomOut() {
    update((state) => rescale(state, state.renderScale / ZOOM_STEP));
  }

  function resetZoom() {
    update((state) => rescale(state, DEFAULT_RENDER_SCALE));
  }

  function reset() {
    set({ pdfFile: null, pageNumber: 1, placedSignature: null, renderScale: DEFAULT_RENDER_SCALE });
  }

  return {
    subscribe,
    loadPdf,
    placeSignature,
    updatePlacement,
    setRenderScale,
    zoomIn,
    zoomOut,
    resetZoom,
    reset,
  };
}

export const editorStore = createEditorStore();
