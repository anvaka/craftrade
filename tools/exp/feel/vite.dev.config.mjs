// Dev server for the feel experiments. The worktree's node_modules is a symlink
// to another checkout, and Vite refuses to serve the typeface from outside its
// root unless that place is allowed.
//   npx vite --config tools/exp/feel/vite.dev.config.mjs --port 8841 --strictPort
//   FEEL_ROOT=/path/to/another/checkout serves that tree instead (for "before" shots).
import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root = process.env.FEEL_ROOT || resolve(import.meta.dirname, '../../..');
const modules = dirname(realpathSync(resolve(root, 'node_modules')));
export default defineConfig({
  root,
  server: { fs: { allow: [root, modules] } },
});
