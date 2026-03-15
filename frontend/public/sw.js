// OptionI Service Worker v3
// Cache-first for static assets ONLY. Let Firebase Hosting serve all HTML navigation.

const CACHE_NAME = 'optioni-v3';

const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\.(?:woff2?|png|ico)$/,
];

// On install: pre-cache nothing (avoid race with Firebase rewrite)
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activate: delete old caches, claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: only cache static assets; pass everything else straight through
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests for same-origin static files
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Only cache Next.js static assets and fonts/images
  if (!STATIC_PATTERNS.some((p) => p.test(url.pathname))) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
