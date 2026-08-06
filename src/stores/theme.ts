import { persistedWritable } from '../lib/utils/persist';

export type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** User's explicit choice, falling back to their OS preference the first time they visit. */
export const theme = persistedWritable<Theme>('theme', getSystemTheme());

export function toggleTheme(): void {
  theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}
