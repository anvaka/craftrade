// The offline cache. Built into dist/sw.js with the list of every file in the
// build (vite.config.ts), so the whole game is on the device after the first
// visit, including the parts that load later (the run, the solo world).
//
//   - The page itself: network first, so a new version shows as soon as there
//     is a connection; the cached page when there is none.
//   - Everything else in the build: cache first. Built files carry a hash in
//     their name and never change.
//   - /api/ is never touched: the shared town is live or it is out of reach.

const VERSION = '4ec5b8c5ff1a';
const FILES = ["./","manifest.webmanifest","icon-192.png","assets/index-DgTFf8FL.js","assets/game-C9eJbY_y.js","assets/items-u0zmQNMz.js","assets/replay-D7wdSebS.js","assets/stubrun-BiVA2asT.js","assets/world-CA5QPagJ.js","assets/game-BM5IBp62.css","assets/index-D8Xb8e9z.css","assets/sql-wasm-CXIAVl5-.wasm","assets/verify-worker-DZosBLXb.js","assets/zilla-slab-latin-400-italic-D7_mW9QC.woff2","assets/zilla-slab-latin-400-normal-Dw3p-plB.woff2","assets/zilla-slab-latin-700-normal-CEKI1vVu.woff2"];
// Several builds can live on one site, each in its own folder (a preview per branch). Each keeps its own cache
// and clears only its own old ones.
const SCOPE = `scrip-${new URL(self.registration.scope).pathname}-`;
const CACHE = `${SCOPE}${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(SCOPE) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put('./', res.clone()));
          return res.clone();
        })
        .catch(() => caches.match('./', { cacheName: CACHE }).then((hit) => hit || Response.error())),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
