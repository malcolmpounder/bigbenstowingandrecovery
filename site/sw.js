/* Big Ben's Towing — service worker.
   Goal: keep the call number and basic info reachable even when signal
   drops on the hard shoulder. Caches essential pages + assets, serves
   offline.html as a last-resort fallback for HTML navigations. */

const CACHE = 'bb-v4';                      /* bumped — adds new pages, fixes false-offline */
const ESSENTIAL = [
  '/',
  '/index.html',
  '/about.html',
  '/services.html',
  '/quote.html',
  '/scrap.html',
  '/areas.html',
  '/contact.html',
  '/faq.html',
  '/motorway-breakdown.html',
  '/trade.html',
  '/auction-collection.html',
  '/motorbike-recovery.html',
  '/classic-car-transport.html',
  '/ev-recovery.html',
  '/reviews.html',
  '/pay.html',
  '/terms.html',
  '/privacy.html',
  '/offline.html',
  '/css/style.css',
  '/css/fonts.css',
  '/js/main.js',
  '/data/areas.json',
  '/manifest.webmanifest',
  '/img/logo.jpg',
  '/img/hero-night.jpg',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/fonts/anton-400.woff2',
  '/fonts/inter-400.woff2',
  '/fonts/inter-600.woff2',
  '/fonts/inter-700.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ESSENTIAL).catch(() => {/* ignore individual misses */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // skip cross-origin (fonts, wa.me etc)
  if (url.pathname.startsWith('/api/')) return;          // never cache API responses

  const isHtml = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    // Stale-while-revalidate: serve cached copy immediately if we have one,
    // and fetch a fresh copy in the background to update the cache. Falls
    // back to /offline.html ONLY when both cache miss AND network fails —
    // not on transient blips.
    event.respondWith(
      caches.match(req).then(cached => {
        const networkPromise = fetch(req)
          .then(resp => {
            if (resp && resp.status === 200) {
              const copy = resp.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return resp;
          })
          .catch(() => null);

        // If we have a cached response, return it now and let the network
        // refresh happen in the background.
        if (cached) {
          networkPromise.catch(() => {/* swallow */});
          return cached;
        }
        // No cache — wait for network. If network fails, show offline page.
        return networkPromise.then(resp => resp || caches.match('/offline.html'));
      })
    );
    return;
  }

  // Cache-first for everything else (CSS / JS / images / JSON)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => undefined);
    })
  );
});
