// Production build of the run harness (play.html), which the normal build leaves out.
//   npx vite build --config tools/exp/mobile/vite.harness.config.mjs
//   (cd $HARNESS_OUT && python3 -m http.server 8802)
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
export default defineConfig({
  root,
  build: {
    outDir: process.env.HARNESS_OUT || '/tmp/scrip-harness',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: { play: resolve(root, 'play.html') } },
  },
});
