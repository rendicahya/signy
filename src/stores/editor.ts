import { writable, derived } from 'svelte/store';
import { getCachedPdf } from '../lib/pdf/docCache';

/** Signature instance placed on the page, in canvas pixel coordinates. */
export interface PlacedSignature {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 1-indexed page this placement belongs to. */
  page: number;
}

/** Per-document editing state — one entry per uploaded PDF. */
export interface PdfDocumentState {
  id: string;
  file: File;
  pageNumber: number;
  pageCount: number;
  placedSignature: PlacedSignature | null;
  /** Additional rotation (0/90/180/270) the user applied on top of the page's own rotation. */
  rotation: number;
}

export interface EditorState {
  documents: PdfDocumentState[];
  activeId: string | null;
  /** pdf.js render scale for the visible canvas; shared across documents so switching between them keeps the same zoom level. */
  renderScale: number;
  /** Whether at least one PDF has been downloaded this session — used to warn before a "Start Over" that would discard undownloaded work. */
  hasExported: boolean;
}

export const DEFAULT_RENDER_SCALE = 1.5;
const MIN_RENDER_SCALE = 0.5;
const MAX_RENDER_SCALE = 4;
const ZOOM_STEP = 1.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createDocumentState(file: File): PdfDocumentState {
  return {
    id: crypto.randomUUID(),
    file,
    pageNumber: 1,
    pageCount: 1,
    placedSignature: null,
    rotation: 0,
  };
}

export function getActiveDocument(state: EditorState): PdfDocumentState | null {
  return state.documents.find((d) => d.id === state.activeId) ?? null;
}

/** Applies `fn` to whichever document is currently active; a no-op if none is. */
function updateActiveDocument(
  state: EditorState,
  fn: (doc: PdfDocumentState) => PdfDocumentState,
): EditorState {
  if (!state.activeId) return state;
  return {
    ...state,
    documents: state.documents.map((doc) => (doc.id === state.activeId ? fn(doc) : doc)),
  };
}

function rescale(state: EditorState, nextScale: number): EditorState {
  const renderScale = clamp(nextScale, MIN_RENDER_SCALE, MAX_RENDER_SCALE);
  const factor = renderScale / state.renderScale;
  // Zoom is shared across every document, so a placement on any of them —
  // not just the active one — needs to be rescaled to stay over the same
  // spot the next time that document is viewed.
  const documents = state.documents.map((doc) => ({
    ...doc,
    placedSignature: doc.placedSignature
      ? {
          ...doc.placedSignature,
          x: doc.placedSignature.x * factor,
          y: doc.placedSignature.y * factor,
          width: doc.placedSignature.width * factor,
          height: doc.placedSignature.height * factor,
        }
      : null,
  }));
  return { ...state, renderScale, documents };
}

function createEditorStore() {
  const { subscribe, update, set } = writable<EditorState>({
    documents: [],
    activeId: null,
    renderScale: DEFAULT_RENDER_SCALE,
    hasExported: false,
  });

  // A document's real page count isn't known until pdf.js has actually
  // parsed it — resolve it eagerly for every uploaded document (not just
  // whichever one is active) so features like "Apply to All Documents" can
  // reliably tell which documents are single-page without waiting for the
  // user to have opened each one first.
  function resolvePageCount(doc: PdfDocumentState) {
    getCachedPdf(doc.id, doc.file)
      .then((pdfjsDoc) => setPageCountForDocument(doc.id, pdfjsDoc.numPages))
      .catch(() => {
        // Leave pageCount at its default; PDFViewer surfaces the real load error when the document is opened.
      });
  }

  /** Replaces the whole document list, e.g. the initial upload. */
  function loadPdfs(files: File[]) {
    const documents = files.map(createDocumentState);
    set({
      documents,
      activeId: documents[0]?.id ?? null,
      renderScale: DEFAULT_RENDER_SCALE,
      hasExported: false,
    });
    documents.forEach(resolvePageCount);
  }

  /** Appends more PDFs to an already-started session. */
  function addPdfs(files: File[]) {
    const added = files.map(createDocumentState);
    update((state) => ({
      ...state,
      documents: [...state.documents, ...added],
      activeId: state.activeId ?? added[0]?.id ?? null,
    }));
    added.forEach(resolvePageCount);
  }

  function removeDocument(id: string) {
    update((state) => {
      const removedIndex = state.documents.findIndex((d) => d.id === id);
      if (removedIndex === -1) return state;

      const documents = state.documents.filter((d) => d.id !== id);
      const activeId =
        state.activeId === id
          ? (documents[Math.min(removedIndex, documents.length - 1)]?.id ?? null)
          : state.activeId;

      return { ...state, documents, activeId };
    });
  }

  function setActiveDocument(id: string) {
    update((state) => (state.documents.some((d) => d.id === id) ? { ...state, activeId: id } : state));
  }

  function prevDocument() {
    update((state) => {
      const index = state.documents.findIndex((d) => d.id === state.activeId);
      if (index <= 0) return state;
      return { ...state, activeId: state.documents[index - 1].id };
    });
  }

  function nextDocument() {
    update((state) => {
      const index = state.documents.findIndex((d) => d.id === state.activeId);
      if (index === -1 || index >= state.documents.length - 1) return state;
      return { ...state, activeId: state.documents[index + 1].id };
    });
  }

  function setPageCount(count: number) {
    update((state) => updateActiveDocument(state, (doc) => ({ ...doc, pageCount: Math.max(1, count) })));
  }

  /** Sets the page count on an arbitrary document, not just the active one. */
  function setPageCountForDocument(id: string, count: number) {
    update((state) => ({
      ...state,
      documents: state.documents.map((doc) => (doc.id === id ? { ...doc, pageCount: Math.max(1, count) } : doc)),
    }));
  }

  function goToPage(page: number) {
    update((state) =>
      updateActiveDocument(state, (doc) => ({ ...doc, pageNumber: clamp(page, 1, doc.pageCount) })),
    );
  }

  function nextPage() {
    update((state) =>
      updateActiveDocument(state, (doc) => ({
        ...doc,
        pageNumber: clamp(doc.pageNumber + 1, 1, doc.pageCount),
      })),
    );
  }

  function prevPage() {
    update((state) =>
      updateActiveDocument(state, (doc) => ({
        ...doc,
        pageNumber: clamp(doc.pageNumber - 1, 1, doc.pageCount),
      })),
    );
  }

  function placeSignature(placement: PlacedSignature) {
    update((state) => updateActiveDocument(state, (doc) => ({ ...doc, placedSignature: placement })));
  }

  function updatePlacement(partial: Partial<PlacedSignature>) {
    update((state) =>
      updateActiveDocument(state, (doc) => ({
        ...doc,
        placedSignature: doc.placedSignature ? { ...doc.placedSignature, ...partial } : null,
      })),
    );
  }

  /** Sets a placement on an arbitrary document, not just the active one — used to apply one signature to every uploaded document at once. */
  function setPlacementForDocument(id: string, placement: PlacedSignature | null) {
    update((state) => ({
      ...state,
      documents: state.documents.map((doc) => (doc.id === id ? { ...doc, placedSignature: placement } : doc)),
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

  function rotateBy(delta: number) {
    update((state) =>
      updateActiveDocument(state, (doc) => ({
        ...doc,
        rotation: (((doc.rotation + delta) % 360) + 360) % 360,
        // Rotation applies uniformly to every page of this document, so any
        // existing placement would misalign the next time its page is
        // rendered. Clear it; "Use last position" makes re-placing fast.
        placedSignature: null,
      })),
    );
  }

  function rotateLeft() {
    rotateBy(-90);
  }

  function rotateRight() {
    rotateBy(90);
  }

  function markExported() {
    update((state) => ({ ...state, hasExported: true }));
  }

  function reset() {
    set({ documents: [], activeId: null, renderScale: DEFAULT_RENDER_SCALE, hasExported: false });
  }

  return {
    subscribe,
    loadPdfs,
    addPdfs,
    removeDocument,
    setActiveDocument,
    prevDocument,
    nextDocument,
    setPageCount,
    setPageCountForDocument,
    goToPage,
    nextPage,
    prevPage,
    placeSignature,
    updatePlacement,
    setPlacementForDocument,
    setRenderScale,
    zoomIn,
    zoomOut,
    resetZoom,
    rotateLeft,
    rotateRight,
    markExported,
    reset,
  };
}

export const editorStore = createEditorStore();

/** The document currently shown in the editor, if any. */
export const activeDocument = derived(editorStore, getActiveDocument);
