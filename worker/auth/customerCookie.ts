// Plan 087: the customer's session cookie, separate from the sellers' `__Host-session`. Same rules:
// `__Host-` (Secure, Path=/, no Domain), HttpOnly, SameSite=Strict. A route that wants a seller
// session never reads this cookie, and the customer routes never read the seller's.
import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_DAYS,
  JOIN_SESSION_MINUTES,
} from '../../shared/customerContract';

/** The customer session token from the request's Cookie header; undefined without one. */
export function customerTokenOf(request: Request): string | undefined {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== CUSTOMER_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}

function cookie(value: string, maxAgeSeconds: number): string {
  return `${CUSTOMER_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${String(maxAgeSeconds)}`;
}

/** A full session lasts 90 days (renewed on use); a phone that joined by code, 30 minutes. */
export function customerCookie(token: string, setup: boolean): string {
  return cookie(token, setup ? JOIN_SESSION_MINUTES * 60 : CUSTOMER_SESSION_DAYS * 24 * 60 * 60);
}

/** Tells the browser to forget the session. */
export function clearedCustomerCookie(): string {
  return cookie('', 0);
}
