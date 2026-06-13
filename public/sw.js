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

// Helper functions to read chunks from IndexedDB
function getChunkFromDB(fileId, chunkIndex) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('directshare_db');
    request.onsuccess = () => {
      const db = request.result;
      try {
        const transaction = db.transaction('chunks', 'readonly');
        const store = transaction.objectStore('chunks');
        const getReq = store.get(`${fileId}_${chunkIndex}`);
        getReq.onsuccess = () => {
          resolve(getReq.result);
        };
        getReq.onerror = () => reject(getReq.error);
      } catch (err) {
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function clearChunksFromDB(fileId, totalChunks) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('directshare_db');
    request.onsuccess = () => {
      const db = request.result;
      try {
        const transaction = db.transaction('chunks', 'readwrite');
        const store = transaction.objectStore('chunks');
        for (let i = 0; i < totalChunks; i++) {
          store.delete(`${fileId}_${i}`);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (err) {
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function handleStreamDownload(url) {
  const fileId = url.searchParams.get('fileId');
  const fileName = decodeURIComponent(url.searchParams.get('name') || 'file');
  const fileType = decodeURIComponent(url.searchParams.get('type') || 'application/octet-stream');
  const fileSize = parseInt(url.searchParams.get('size') || '0', 10);
  const totalChunks = parseInt(url.searchParams.get('totalChunks') || '0', 10);

  const headers = new Headers({
    'Content-Type': fileType,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'X-Content-Type-Options': 'nosniff',
  });
  if (fileSize > 0) {
    headers.set('Content-Length', fileSize);
  }

  let currentChunkIndex = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      if (currentChunkIndex >= totalChunks) {
        controller.close();
        // Clean up database chunks once download completes
        await clearChunksFromDB(fileId, totalChunks);
        return;
      }

      try {
        const chunk = await getChunkFromDB(fileId, currentChunkIndex);
        if (!chunk) {
          throw new Error(`Chunk ${currentChunkIndex} not found in DB`);
        }
        controller.enqueue(new Uint8Array(chunk));
        currentChunkIndex++;
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel(reason) {
      console.warn('Download stream cancelled:', reason);
      await clearChunksFromDB(fileId, totalChunks);
    }
  });

  return new Response(stream, { headers });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept stream download requests
  if (url.pathname === '/api/download-stream') {
    event.respondWith(handleStreamDownload(url));
    return;
  }

  // 2. Bypass Service Worker caching on localhost (dev environment)
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.respondWith(fetch(event.request));
    return;
  }

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
