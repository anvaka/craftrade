import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const stubs = here('./src/client/local/shims/node-stubs.ts');
// The solo world runs the server's code in the browser. The server's Node-only
// imports point at stand-ins there; tests run on Node and keep the real ones.
const browser = !process.env.VITEST;

/** Writes dist/sw.js: the offline cache, with the name of every file in the build. Dev pages are left out. */
const offlineCache = () => ({
  name: 'scrip-offline-cache',
  apply: 'build' as const,
  generateBundle(_: unknown, bundle: Record<string, { fileName: string }>) {
    const skip = /^(gallery|play)\.html$|gallery|\.map$/;
    const files = ['./', 'manifest.webmanifest', 'icon-192.png', ...Object.values(bundle).map((f) => f.fileName).filter((f) => f !== 'index.html' && !skip.test(f))];
    const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
    const source = readFileSync(here('./src/client/sw.js'), 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
    (this as unknown as { emitFile(f: { type: 'asset'; fileName: string; source: string }): void }).emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

export default defineConfig({
  plugins: [offlineCache()],
  // Relative paths, so the built game can be hosted under any folder or opened from a wrapper app.
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  resolve: browser
    ? {
        alias: {
          'node:crypto': here('./src/client/local/shims/crypto.ts'),
          'node:fs': stubs,
          'node:path': stubs,
          'node:worker_threads': stubs,
          'better-sqlite3': stubs,
          '@hono/node-server/serve-static': stubs,
        },
      }
    : {},
  define: browser ? { 'process.env': '{}' } : {},
  build: { outDir: 'dist', target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
