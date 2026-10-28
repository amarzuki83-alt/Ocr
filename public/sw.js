// Service Worker for LOKET PPOB ATHAR DIGITAL / StrukKilat PWA
const CACHE_NAME = 'struk-kilat-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Helper to save shared media from phone gallery into IndexedDB
function saveSharedImageToIdb(file) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('AtharDigitalPwaDB', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sharedFiles')) {
          db.createObjectStore('sharedFiles');
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('sharedFiles', 'readwrite');
        const store = tx.objectStore('sharedFiles');
        store.put(file, 'latest-shared-image');
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      };
      req.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

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

  // 1. Intercept Web Share Target POST requests (Image shared from Mobile Gallery)
  if (event.request.method === 'POST' && url.pathname.includes('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const mediaFile = formData.get('image') || formData.get('file') || formData.get('media');

        if (mediaFile) {
          await saveSharedImageToIdb(mediaFile);
        }
      } catch (err) {
        console.error('[PWA SW] Gagal memproses gambar yang dibagikan:', err);
      }
      // Redirect with 303 (See Other) to launch app and load the shared image
      return Response.redirect('/?shared=image', 303);
    })());
    return;
  }

  // Handle fallback GET to /share-target
  if (event.request.method === 'GET' && url.pathname.includes('/share-target')) {
    event.respondWith(Response.redirect('/?shared=image', 302));
    return;
  }

  // Only handle standard GET requests for assets
  if (event.request.method !== 'GET') return;

  // Let browser handle chrome extensions or external cross-origin APIs if needed
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cache but update in background (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore fetch errors during background revalidation
          });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback for navigation requests when offline
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
