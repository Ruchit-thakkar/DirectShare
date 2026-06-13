const CACHE_NAME = 'directshare-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/ds.png',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-72x72.png',
  '/icons/maskable-96x96.png',
  '/icons/maskable-128x128.png',
  '/icons/maskable-144x144.png',
  '/icons/maskable-152x152.png',
  '/icons/maskable-192x192.png',
  '/icons/maskable-384x384.png',
  '/icons/maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude signaling server WebSocket connection, dynamic API routes, or Webpack HMR
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('socket.io') ||
    url.pathname.includes('localhost') && url.pathname.includes('/ws')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background network update failures
          });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse.status === 200 &&
            (url.origin === self.location.origin ||
             url.pathname.includes('.woff') ||
             url.pathname.includes('.png') ||
             url.pathname.includes('.js') ||
             url.pathname.includes('.css'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback for navigation requests when offline
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});
