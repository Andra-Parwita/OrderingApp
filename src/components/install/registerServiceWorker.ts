// Registers /sw.js (public/sw.js) at scope "/" (plan 004 stage 7). It runs in a production build
// only, so Vite's dev server and hot reload never meet a service worker. To try it in dev anyway,
// start the dev server with VITE_SW=1 (the install flow also registers it on demand, when a
// customer turns notifications on). `force` skips the production check for that case.

export function serviceWorkerWanted(): boolean {
  return import.meta.env.PROD || import.meta.env['VITE_SW'] === '1';
}

export async function registerServiceWorker(
  options: Readonly<{ force?: boolean }> = {},
): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  if (options.force !== true && !serviceWorkerWanted()) return undefined;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // No service worker (a private window, an insecure page): the app works without it.
    return undefined;
  }
}
