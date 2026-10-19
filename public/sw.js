/**
 * HushArc Ephemeral Service Worker
 *
 * PRIVACY GUARANTEE:
 * Only caches static application shell assets (JS, CSS, fonts, SVG icons).
 * STRICTLY NEVER caches API responses, room data, WebSockets, or messages.
 */

const CACHE_NAME = 'husharc-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/husharc-mark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API, WebSocket, or health endpoints
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/r/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-first for dynamic navigation, stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/assets/') || STATIC_ASSETS.includes(url.pathname))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for shell
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
