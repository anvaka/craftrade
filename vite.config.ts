import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths: the same build is served at the site root and under a branch preview folder (see .github/workflows/pages.yml).
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
});
