// Browser security headers on every response the Worker sends (page, API, images, kitchen files).
// The Content-Security-Policy lists exactly what the app loads: its own files, the Google Fonts
// stylesheet and font files (index.html), and the Google Maps embed (pickup map, Check on map) and
// Cloudflare Web Analytics (beacon script and its report endpoint).
// The live socket is same-origin wss. styled-components injects <style> tags, so styles allow inline.
// With DEV_TOOLS on (a local `.dev.vars` only) vite's dev server needs inline scripts and its HMR
// socket, so the script rules are loosened there and nowhere else.

const MAPS_EMBED = 'https://www.google.com/maps/embed/';
// Cloudflare Web Analytics: its beacon script and the endpoint it reports to (owner, 17 Oct).
const CF_ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const CF_ANALYTICS_CONNECT = 'https://cloudflareinsights.com';

/** A fresh random nonce (16 bytes, base64) for one HTML response. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function contentSecurityPolicy(origin: string, dev: boolean, nonce?: string): string {
  const socket = origin.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    dev
      ? `script-src 'self' 'unsafe-inline' ${CF_ANALYTICS_SCRIPT}`
      : `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''} ${CF_ANALYTICS_SCRIPT}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${socket} ${CF_ANALYTICS_CONNECT}`,
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
  // HTML gets a per-response nonce: Cloudflare reads it from this header and stamps it on the
  // inline bot-detection script it injects (JavaScript detections). Our own pages have no inline script.
  const isHtml = (secured.headers.get('Content-Type') ?? '').includes('text/html');
  secured.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(
      new URL(request.url).origin,
      dev,
      isHtml && !dev ? newNonce() : undefined,
    ),
  );
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  return secured;
}
