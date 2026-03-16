// OptionI Service Worker v4 (Cloudflare PWA Optimized)
// Caches statically generated Next.js assets and provides an offline fallback for navigation

const CACHE_NAME = 'optioni-v4';

const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\.(?:woff2?|png|ico|json|txt|css|js)$/,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  
  // Ignore external API endpoints and Firebase auth endpoints
  if (url.origin !== self.location.origin) return;

  // Cache-first for static assets
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (e) {
          // Fallback if offline
          return new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Network-first for HTML pages (SPA routing + offline fallback for instant load on PWA)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).then(async (response) => {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(request);
      })
    );
    return;
  }
});
