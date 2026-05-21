/* =========================
 * sw.js — CloudTrips Service Worker
 * Strategy:
 *   - Static assets (JS, CSS, HTML pages): cache-first, update in background
 *   - API calls (/api/*): network-only, never cache
 *   - print.html / accept-invite.html: network-first (dynamic content)
 * ========================= */

const CACHE = 'cloudtrips-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/trip.html',
  '/timeline.html',
  '/costs.html',
  '/forgot.html',
  '/reset.html',
  '/output.css',
  '/state.js',
  '/helpers.js',
  '/ui.js',
  '/auth.js',
  '/api.js',
  '/trips.js',
  '/activities.js',
  '/share.js',
  '/members.js',
  '/export.js',
  '/init.js'
];

// Pages that must always be fresh — skip caching these
const NETWORK_FIRST = [
  '/print.html',
  '/accept-invite.html',
  '/verify-email.html',
  '/admin.html',
  '/stats.html',
  '/login.html',
  '/signup.html',
  '/forgot.html',
  '/reset.html'
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

  // API calls: network-only, never intercept
  if (url.pathname.startsWith('/api/')) return;

  // Network-first pages (print renderer, invite tokens)
  if (NETWORK_FIRST.some(p => url.pathname === p || url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else: cache-first, update cache in background
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          // Only cache clean successful responses — never cache redirects
          if (response.ok && !response.redirected && response.type !== 'opaqueredirect') {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached); // offline fallback

        return cached || networkFetch;
      })
    )
  );
});