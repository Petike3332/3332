/* TradeMate Stage 3 — offline support.
   Registered by trademate-stage3.html with scope './trademate-stage3.html', so it only ever
   controls that one page. Other pages in the same repository (e.g. Index.html) are not affected.

   - The app page: network first (so a newly uploaded version is picked up whenever you're online),
     falling back to the last saved copy when there's no signal.
   - The map library (Leaflet 1.9.4, a fixed version that never changes): saved once, then served
     from the saved copy.
   - Everything else (map tiles, address search) goes straight to the network as before.
   Your jobs, logs and photos are NOT stored here; they stay in localStorage / IndexedDB as before. */

const CACHE = 'tm3-offline-v1';
const LEAFLET_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = self.registration.scope;   // the app page itself
    await Promise.all([page, ...LEAFLET_FILES].map(url =>
      cache.add(new Request(url, { mode: url.startsWith(self.location.origin) ? 'same-origin' : 'cors' })).catch(() => { /* retried later */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('tm3-offline-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const cache = await caches.open(CACHE); await cache.put(self.registration.scope, res.clone()); }
        return res;
      } catch (err) {
        const saved = await caches.match(self.registration.scope);
        if (saved) return saved;
        throw err;
      }
    })());
    return;
  }

  const isLeaflet = (url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net') && url.pathname.includes('leaflet@1.9.4/dist/');
  if (isLeaflet) {
    event.respondWith((async () => {
      const saved = await caches.match(req, { ignoreVary: true });
      if (saved) return saved;
      const res = await fetch(req);
      if (res.ok) { const cache = await caches.open(CACHE); await cache.put(req, res.clone()); }
      return res;
    })());
  }
  // anything else: not handled here, so the browser fetches it normally
});
