// Service worker for the customer app (plan 004 stage 7). Hand-written, no dependency. Scope "/".
//
// It does three things:
//   1. push: shows the seller's message as a notification (payload: { title, body, icon, data: { url } })
//      and tells open windows ({ type: 'order-push', url }) so an open page refreshes that order at once.
//   2. notificationclick: focuses an open window on data.url, or opens one.
//   3. offline: network-first with a cache fallback for the app shell and the last menu and order
//      answers, so a phone without signal still shows what it loaded last (spec section 8). On a slow link
//      the copy is shown after SLOW_LINK_MS (plan 114).
//      Pages (plan 115 stage 2): a saved copy is shown at once and refreshed from the network in the
//      background (the next open shows the new one). One copy per kitchen: /<slug> and /o/<token> each
//      keep their own, '/' is the install-time copy and the offline fallback. Only 200 HTML is saved.
//      Never cached: /version.json, /api/seller/*, /api/auth/*, /api/admin/*, /api/dev/*, /api/push/*, anything that
//      is not a GET, and the seller and admin pages.
//
// Registration (src/components/install/registerServiceWorker.ts) happens only in a production build,
// or in dev when VITE_SW=1 is set, so Vite's HMR is never touched. To try it locally:
//   pnpm build, then run wrangler dev (or `pnpm exec vite preview` on a free port) and open the site.
// Change CACHE_VERSION whenever this file's caching rules change: old caches are deleted on activate.

const CACHE_VERSION = 'v3';
// Plan 114: on a slow (not dead) link, the cached copy is shown after this long while the network
// answer keeps loading and refreshes the cache for next time.
const SLOW_LINK_MS = 4500;
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, DATA_CACHE];

const NEVER_CACHE_API = /^\/api\/(seller|auth|admin|dev|push)(\/|$)/;
const NEVER_CACHE_PAGES = /^\/(seller|admin)(\/|$)/;
// The deployed version (plan 059) must always come from the network.
const NEVER_CACHE_FILES = /^\/version\.json$/;
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

async function networkFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const key = request;
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(key, response.clone());
    return response;
  });
  const cached = await cache.match(key);
  if (!cached) return network;
  // A copy exists: the network wins if it answers in time, else the copy is shown and the network
  // answer still finishes in the background (event.waitUntil) to refresh the cache.
  const slow = new Promise((resolve) => setTimeout(() => resolve(cached), SLOW_LINK_MS));
  event.waitUntil(network.catch(() => undefined));
  return Promise.race([network.catch(() => cached), slow]);
}

// The key a customer page is saved under: its kitchen (/<slug>), or its order link (/o/<token>).
function pageKey(path) {
  const [first, second] = path.split('/').filter(Boolean);
  if (first === undefined) return '/';
  return first === 'o' && second !== undefined ? `/o/${second}` : `/${first}`;
}

// Saved copy at once, refreshed in the background. No copy: the network, and offline the '/' copy.
async function pageFirst(event, request, key) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(key);
  const network = fetch(request).then(async (response) => {
    const type = response.headers.get('content-type') || '';
    if (response.status === 200 && type.includes('text/html')) {
      await cache.put(key, response.clone());
    }
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network.catch(async (error) => {
    const shell = await cache.match('/');
    if (shell) return shell;
    throw error;
  });
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
  if (NEVER_CACHE_FILES.test(path)) return;

  // Pages: the SPA shell, one saved copy per kitchen. Offline with no copy, the '/' shell is shown,
  // which then shows the last data it can find.
  if (request.mode === 'navigate') {
    event.respondWith(pageFirst(event, request, pageKey(path)));
    return;
  }
  // Built files have a content hash in their name: safe to keep.
  if (path.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  // The last menu and order answers.
  if (CACHEABLE_API.test(path + url.search)) {
    event.respondWith(networkFirst(event, request, DATA_CACHE));
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
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: typeof payload.body === 'string' ? payload.body : '',
        icon: typeof payload.icon === 'string' ? payload.icon : undefined,
        data: { url },
        // One notification per order: a newer message replaces the older one but still alerts.
        tag: url,
        renotify: true,
      }),
      // Plan 074: tell open pages which order changed, so they refresh it at once.
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => {
          for (const client of windows) client.postMessage({ type: 'order-push', url });
        })
        .catch(() => undefined),
    ]),
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
