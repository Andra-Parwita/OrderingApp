// Service worker for the customer app (plan 004 stage 7). Hand-written, no dependency. Scope "/".
//
// It does three things:
//   1. push: shows the seller's message as a notification (payload: { title, body, icon, data: { url } }).
//   2. notificationclick: focuses an open window on data.url, or opens one.
//   3. offline: network-first with a cache fallback for the app shell and the last menu and order
//      answers, so a phone without signal still shows what it loaded last (spec section 8).
//      Never cached: /api/seller/*, /api/auth/*, /api/admin/*, /api/dev/*, /api/push/*, anything that
//      is not a GET, and the seller and admin pages.
//
// Registration (src/components/install/registerServiceWorker.ts) happens only in a production build,
// or in dev when VITE_SW=1 is set, so Vite's HMR is never touched. To try it locally:
//   pnpm build, then run wrangler dev (or `pnpm exec vite preview` on a free port) and open the site.
// Change CACHE_VERSION whenever this file's caching rules change: old caches are deleted on activate.

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, DATA_CACHE];

const NEVER_CACHE_API = /^\/api\/(seller|auth|admin|dev|push)(\/|$)/;
const NEVER_CACHE_PAGES = /^\/(seller|admin)(\/|$)/;
const CACHEABLE_API = /^\/api\/(s\/[^/]+\/menu|orders)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add('/'))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => !KNOWN_CACHES.includes(name)).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(fallbackKey ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey ?? request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (NEVER_CACHE_API.test(path) || NEVER_CACHE_PAGES.test(path)) return;

  // Pages: the SPA shell. Offline, any customer page gets the cached shell, which then shows the
  // last data it can find.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/'));
    return;
  }
  // Built files have a content hash in their name: safe to keep.
  if (path.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  // The last menu and order answers.
  if (CACHEABLE_API.test(path + url.search)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  if (!payload || typeof payload.title !== 'string') return;
  const url = payload.data && typeof payload.data.url === 'string' ? payload.data.url : '/';
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: typeof payload.body === 'string' ? payload.body : '',
      icon: typeof payload.icon === 'string' ? payload.icon : undefined,
      data: { url },
      // One notification per order: a newer message replaces the older one but still alerts.
      tag: url,
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  const target = new URL(
    data && typeof data.url === 'string' ? data.url : '/',
    self.location.origin,
  );
  // Only ever open this site's own pages.
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ('navigate' in open) {
          try {
            await open.navigate(target.href);
            return undefined;
          } catch {
            // fall through to a new window
          }
        } else {
          return undefined;
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
