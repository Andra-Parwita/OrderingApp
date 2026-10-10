// @vitest-environment node
// Stage 8.2: the Origin check on state-changing calls to the signed-in areas, and the session cookie
// helpers. The check sits at the Worker's door (worker/api/index.ts), so these tests go through
// `handleWorkerRequest`, the function the Worker's fetch calls.
import { describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/apiError';
import { checkOrigin } from '../worker/auth/origin';
import {
  clearedSessionCookie,
  sessionCookie,
  sessionTokenOf,
  withCookie,
} from '../worker/auth/cookie';
import { handleWorkerRequest, type ApiEnv } from '../worker/api';

const SITE = 'https://delave.test';

/** Bindings that must not be touched: a request the door refuses, or a sign-out with no cookie, never reads them. */
const ENV: ApiEnv = {
  DB: {
    prepare: () => {
      throw new Error('the database must not be touched');
    },
    batch: () => Promise.reject(new Error('the database must not be touched')),
  },
  IMAGES: {} as ApiEnv['IMAGES'],
  SELLER_LIVE: {} as ApiEnv['SELLER_LIVE'],
};

function req(method: string, path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${SITE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: '{}' }),
  });
}

describe('Origin check (CSRF, second layer)', () => {
  const guarded = [
    ['POST', '/api/auth/sign-out'],
    ['POST', '/api/auth/passkey/options'],
    ['PATCH', '/api/auth/devices/x'],
    ['DELETE', '/api/auth/devices/x'],
    ['POST', '/api/admin/sellers'],
    ['POST', '/api/admin/setup'],
    ['PUT', '/api/seller/settings'],
    ['POST', '/api/seller/orders'],
    ['DELETE', '/api/seller/chefs/x'],
  ] as const;

  it.each(guarded)('refuses %s %s without an Origin', (method, path) => {
    const reply = checkOrigin(req(method, path));
    expect(reply?.status).toBe(403);
  });

  it.each(guarded)('refuses %s %s from another site', async (method, path) => {
    const reply = checkOrigin(req(method, path, { Origin: 'https://evil.test' }));
    expect(reply?.status).toBe(403);
    expect(parseApiError(await reply?.json())?.error).toBe('bad_origin');
  });

  it('refuses a look-alike: other scheme, other port, other subdomain, "null"', () => {
    for (const origin of [
      'http://delave.test',
      'https://delave.test:8443',
      'https://app.delave.test',
      'https://delave.test.evil.test',
      'null',
    ]) {
      expect(checkOrigin(req('POST', '/api/auth/sign-out', { Origin: origin }))?.status).toBe(403);
    }
  });

  it.each(guarded)('lets %s %s through from this very site', (method, path) => {
    expect(checkOrigin(req(method, path, { Origin: SITE }))).toBeNull();
  });

  it('uses the request own origin, port included', () => {
    const request = new Request('https://localhost:5173/api/auth/sign-out', {
      method: 'POST',
      headers: { Origin: 'https://localhost:5173' },
    });
    expect(checkOrigin(request)).toBeNull();
  });

  it('leaves reads and the customer endpoints alone', () => {
    expect(checkOrigin(req('GET', '/api/auth/me'))).toBeNull();
    expect(checkOrigin(req('GET', '/api/seller/orders'))).toBeNull();
    expect(checkOrigin(req('POST', '/api/orders'))).toBeNull();
    expect(checkOrigin(req('POST', '/api/s/onde-onde/orders'))).toBeNull();
    expect(checkOrigin(req('PATCH', '/api/orders/abc'))).toBeNull();
  });

  it('is applied by the Worker entry before any route runs', async () => {
    const blocked = await handleWorkerRequest(req('POST', '/api/auth/sign-out'), ENV);
    expect(blocked?.status).toBe(403);
    const allowed = await handleWorkerRequest(
      req('POST', '/api/auth/sign-out', { Origin: SITE }),
      ENV,
    );
    expect(allowed?.status).toBe(200);
    // A blocked request never reaches the route: no cookie is touched.
    expect(blocked?.headers.get('set-cookie')).toBeNull();
  });
});

describe('session cookie helpers', () => {
  it('writes the exact attributes of D-011', () => {
    expect(sessionCookie('abc', 'full')).toBe(
      '__Host-session=abc; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000',
    );
    expect(sessionCookie('abc', 'setup')).toBe(
      '__Host-session=abc; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600',
    );
    expect(clearedSessionCookie()).toBe(
      '__Host-session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0',
    );
  });

  it('reads only its own cookie', () => {
    const of = (cookie?: string) =>
      sessionTokenOf(new Request(SITE, cookie ? { headers: { Cookie: cookie } } : {}));
    expect(of('__Host-session=tok')).toBe('tok');
    expect(of('a=1; __Host-session=tok; b=2')).toBe('tok');
    expect(of('session=tok')).toBeUndefined();
    expect(of('x__Host-session=tok')).toBeUndefined();
    expect(of('__Host-session=')).toBeUndefined();
    expect(of()).toBeUndefined();
  });

  it('adds Set-Cookie without losing the body or status', async () => {
    const reply = withCookie(
      Response.json({ ok: true }, { status: 201 }),
      sessionCookie('t', 'full'),
    );
    expect(reply.status).toBe(201);
    expect(await reply.json()).toEqual({ ok: true });
    expect(reply.headers.get('set-cookie')).toContain('__Host-session=t');
  });
});
