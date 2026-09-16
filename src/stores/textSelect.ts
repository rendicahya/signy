import { writable } from 'svelte/store';

/** Whether the editor is in "select the PDF's real text" mode. */
export const textSelectMode = writable(false);
