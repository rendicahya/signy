import { writable } from 'svelte/store';

/** Whether the editor is in "draw a redaction box" mode. */
export const redactMode = writable(false);
