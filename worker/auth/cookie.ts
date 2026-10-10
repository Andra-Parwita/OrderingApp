// The session cookie (stage 8.2, D-011). The token lives only in this cookie: `__Host-` makes the
// browser insist on Secure + Path=/ + no Domain, HttpOnly keeps scripts away from it, and
// SameSite=Strict keeps it off cross-site requests (the Origin check in origin.ts is the second
// layer). Nothing here is used by the browser code; it only sends the cookie back by itself.
import { SESSION_DAYS, SETUP_SESSION_MINUTES } from '../../shared/authContract';

export const SESSION_COOKIE = '__Host-session';

/** The session token from the request's Cookie header; undefined without one. */
export function sessionTokenOf(request: Request): string | undefined {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

function cookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${String(maxAgeSeconds)}`;
}

/** A full session lasts 30 days (renewed on use); the setup session between a key and a device, 60 minutes. */
export function sessionCookie(token: string, stage: 'setup' | 'full'): string {
  return cookie(
    token,
    stage === 'setup' ? SETUP_SESSION_MINUTES * 60 : SESSION_DAYS * 24 * 60 * 60,
  );
}

/** Tells the browser to forget the session. */
export function clearedSessionCookie(): string {
  return cookie('', 0);
}

/** A copy of the response with one more `Set-Cookie` header. */
export function withCookie(response: Response, setCookie: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.append('Set-Cookie', setCookie);
  return copy;
}
