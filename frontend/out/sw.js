// OptionI Service Worker v2
// Strategy: Cache-first for static assets, network-first for API calls

const CACHE_NAME = 'optioni-v2';
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\.(?:js|css|woff2?|png|svg|ico)$/,
];
const API_PATTERNS = [
  /\/api\//,
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
];

// On install: cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/manifest.json'])
    )
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

// On activate: delete old caches & claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Claim all open tabs immediately (critical for iOS tab resume)
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls
  if (request.method !== 'GET') return;
  if (API_PATTERNS.some((p) => p.test(url.href))) return;

  if (STATIC_PATTERNS.some((p) => p.test(url.pathname) || p.test(url.href))) {
    // Cache-first: serve from cache, update in background
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Network-first for HTML navigation (ensures fresh page on hard refresh)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
