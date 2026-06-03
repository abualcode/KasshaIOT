// KasshaIOT service worker — caches the app shell so the UI loads offline.
// Bump CACHE_VERSION whenever you change the HTML/icons to force an update.
const CACHE_VERSION = 'kasshaiot-v4';

// App-shell assets. CDN libs are cached opportunistically (cache-first with
// network fallback) — MQTT itself still needs the network to talk to the broker.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './abualcode/Abu%20alcode%20logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/mqtt@4/dist/mqtt.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET; never cache MQTT/websocket traffic.
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const isDoc = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');

  if (isDoc) {
    // NETWORK-FIRST for the page itself — so a fresh deploy always wins when
    // online; the cache is only an offline fallback. (Cache-first here was the
    // bug that pinned users to a stale old page.)
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST for static assets (icons, logo, CDN libs).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
