/* =========================
 * sw.js — CloudTrips Service Worker
 * Strategy:
 *   - JS / CSS static assets: cache-first, update in background
 *   - HTML pages: network-only (never cache — they involve auth redirects)
 *   - API calls (/api/*): network-only
 * ========================= */

const CACHE = 'cloudtrips-v7';

// Only precache CSS — JS files are cache-busted with ?v= timestamps by build.cjs
// so bare paths like /state.js would never match the actual requests (/state.js?v=123)
const STATIC_ASSETS = [
  '/output.css'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept HTML pages or API calls — let browser handle natively
  if (url.pathname.startsWith('/api/') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') return;

  // Cache-first for JS and CSS assets only
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          if (response.ok && !response.redirected) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    )
  );
});
