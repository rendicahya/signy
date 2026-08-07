import { writable } from 'svelte/store';

/** Whether the left page-thumbnail sidebar is visible in the editor. */
export const pageSidebarOpen = writable(true);

export function togglePageSidebar() {
  pageSidebarOpen.update((open) => !open);
}
