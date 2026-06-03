// KasshaIOT service worker — caches the app shell so the UI loads offline.
// Bump CACHE_VERSION whenever you change the HTML/icons to force an update.
const CACHE_VERSION = 'kasshaiot-v2';

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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // Cache successful same-style responses for next time.
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);  // offline and not cached → undefined (graceful)
    })
  );
});
