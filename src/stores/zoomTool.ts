import { writable } from 'svelte/store';

/** Whether the editor is in "click the document to zoom in at that point" mode. */
export const zoomToolMode = writable<boolean>(false);
