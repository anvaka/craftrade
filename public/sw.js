// The game that used to live at this address installed an offline cache (a service worker at ./sw.js) in its
// visitors' browsers. Craft World uses none. A browser that still runs the old worker fetches this file when it
// checks for an update; this version clears the caches, removes itself and reloads open pages once.
// Safe to delete after a while (by mid-2027 every such browser will have checked in).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
