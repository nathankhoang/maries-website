/* Service worker — makes the site installable and the phrasebook usable
 * offline (clinic wifi is unreliable). Bump CACHE when shipping changes so
 * clients pick up new assets.
 *
 * Strategy:
 *  - /api/*  → network only, never cached (translations must be fresh; POST).
 *  - same-origin GET → stale-while-revalidate (instant offline, self-healing).
 *  - navigation offline & uncached → fall back to the offline phrasebook.
 */
const CACHE = 'audviet-v3';
const ASSETS = [
  '/index.html',
  '/about.html',
  '/contact.html',
  '/translations.html',
  '/translator.html',
  '/styles.css',
  '/main.js',
  '/translator.js',
  '/phrasebook.js',
  '/lib/text-utils.js',
  '/manifest.webmanifest',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/apple-touch-icon.png',
  '/images/favicon-32.png',
  '/images/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Non-GET / cross-origin → don't intercept.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // /api/phrases is the phrasebook content → network-first with cache
  // fallback so the phrasebook still loads offline (clinic wifi is spotty).
  if (url.pathname === '/api/phrases') {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const resp = await fetch(request);
          if (resp && resp.status === 200) cache.put(request, resp.clone());
          return resp;
        } catch {
          return (await cache.match(request)) ||
            new Response('{"groups":[]}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
        }
      })
    );
    return;
  }

  // Other /api/* (translate, admin) → always live, never cached.
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            cache.put(request, resp.clone());
          }
          return resp;
        })
        .catch(() => null);

      if (cached) {
        e.waitUntil(network); // refresh in background
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;

      // Offline and never cached → give navigations the offline phrasebook.
      if (request.mode === 'navigate') {
        return (
          (await cache.match('/translations.html')) ||
          (await cache.match('/index.html'))
        );
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});
