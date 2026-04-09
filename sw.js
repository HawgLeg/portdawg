// Port Dawg Service Worker
// Caches the app shell for full offline use

const CACHE_NAME = 'portdawg-v1';

// Everything the app needs to work offline
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Google Fonts — cache on first load
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
];

// ── INSTALL: cache all assets ──────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing Port Dawg v1...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets — fonts may fail offline, that's OK
      return cache.addAll(['/index.html', '/manifest.json']).then(() => {
        // Try to cache fonts separately — don't fail install if unavailable
        return cache.addAll([
          'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
        ]).catch(() => {
          console.log('[SW] Font cache skipped — will load from cache when available');
        });
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ─────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache immediately
        // Also fetch fresh copy in background to update cache
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {}); // Ignore network errors when cached version exists

        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Network failed and not cached — return offline fallback
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
