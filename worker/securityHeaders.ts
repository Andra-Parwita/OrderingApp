// Browser security headers on every response the Worker sends (page, API, images, kitchen files).
// The Content-Security-Policy lists exactly what the app loads: its own files, the Google Fonts
// stylesheet and font files (index.html), and the Google Maps embed (pickup map, Check on map).
// The live socket is same-origin wss. styled-components injects <style> tags, so styles allow inline.
// With DEV_TOOLS on (a local `.dev.vars` only) vite's dev server needs inline scripts and its HMR
// socket, so the script rules are loosened there and nowhere else.

const MAPS_EMBED = 'https://www.google.com/maps/embed/';

export function contentSecurityPolicy(origin: string, dev: boolean): string {
  const socket = origin.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${socket}`,
    `frame-src ${MAPS_EMBED}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const PERMISSIONS_POLICY =
  'camera=(self), geolocation=(self), publickey-credentials-get=(self), publickey-credentials-create=(self), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()';

/** The response with the security headers set (a copy: asset responses have immutable headers). */
export function withSecurityHeaders(request: Request, response: Response, dev: boolean): Response {
  // A WebSocket upgrade has no document to protect, and copying it would lose the socket.
  if (response.status === 101) return response;
  const secured = new Response(response.body, response);
  secured.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(new URL(request.url).origin, dev),
  );
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  return secured;
}
