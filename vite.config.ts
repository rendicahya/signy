import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves project sites from /<repo-name>/, so the base path
// must match the repository name. Adjust REPO_NAME if the repo is renamed.
const REPO_NAME = 'signy';

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
