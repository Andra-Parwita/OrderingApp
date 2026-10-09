import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../mocks/browserPasskeys';
import { clearCookies, installCookieJar, sessionCookie } from '../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../mocks/handlers';
import {
  adminSetup,
  createChefInvite,
  createDeviceCode,
  createInviteKey,
  createSeller,
  fetchMe,
  fetchMyDevices,
  fetchSellerDevices,
  fetchSellers,
  registerDevice,
  signInWithCode,
  signInWithKey,
  signInWithPasskey,
  signInWithPassword,
  signOut,
} from './auth';
import { fetchSellerOrders, sendArrivingSoon, sendUpdates } from './client';
import { getCredentialId } from './device/session';
import type { ApiResult } from './http';

// The browser's passkey prompt is a software authenticator; the server's checks are the real ones.
vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
beforeAll(() => {
  restoreFetch = installCookieJar();
});
afterAll(() => {
  restoreFetch();
});

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

beforeEach(async () => {
  await mockStores.reset();
  localStorage.clear();
  clearCookies();
  browserPasskeys.reset();
});

describe('sign-in client', () => {
  it('runs the whole flow: admin, seller, devices, and keeps the session in a cookie only', async () => {
    expect(await adminSetup('wrong')).toMatchObject({
      ok: false,
      error: 'invalid_credentials',
      triesLeft: 4,
    });
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    expect(data(await fetchMe()).me.stage).toBe('setup');
    expect(sessionCookie()).toBeTruthy();
    expect(JSON.stringify(localStorage)).not.toContain(sessionCookie() ?? 'no-cookie');
    expect(localStorage.getItem('signedIn')).toBe('1'); // a plain hint, nothing secret
    data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' }));
    expect(getCredentialId()).toBeTruthy();
    expect(data(await fetchMe()).me.role).toBe('admin');

    const created = data(await createSeller('Warung Baru', 'warung-baru')).seller;
    expect(data(await fetchSellers()).sellers.map((seller) => seller.slug)).toContain(
      'warung-baru',
    );
    expect(await createSeller('Again', 'warung-baru')).toMatchObject({
      ok: false,
      error: 'slug_taken',
    });
    const invite = data(await createInviteKey(created.id));

    // Same browser: sign out, then take the seller's invite and set a password.
    await signOut();
    expect(sessionCookie()).toBeNull();
    data(await signInWithKey(invite.key));
    data(
      await registerDevice({
        kind: 'password',
        password: 'long enough password',
        deviceName: 'Phone',
      }),
    );
    expect(data(await fetchMe()).me).toMatchObject({ role: 'seller', slug: 'warung-baru' });
    expect(data(await fetchSellerOrders()).orders).toEqual([]);
    expect(await createSeller('Nope', 'nope-nope')).toMatchObject({
      ok: false,
      error: 'forbidden',
    });

    const code = data(await createDeviceCode()).code;
    expect(code).toMatch(/^\d{6}$/);
    data(await signInWithCode(code));
    data(await registerDevice({ kind: 'passkey', deviceName: 'Tablet' }));
    expect(
      data(await fetchMyDevices())
        .devices.map((device) => device.name)
        .sort(),
    ).toEqual(['Phone', 'Tablet']);

    // The passkey kept on this device signs the tablet in again after a sign-out.
    await signOut();
    expect(data(await signInWithPasskey()).me.role).toBe('seller');
    await signOut();
    const again = data(
      await signInWithPassword({
        slug: 'warung-baru',
        password: 'long enough password',
        deviceName: 'Phone 2',
      }),
    );
    expect(again.me.deviceName).toBe('Phone 2');
  });

  it('shows the admin a seller devices list and chef invites need a chef', async () => {
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' }));
    const sellerId = (data(await fetchSellers()).sellers[0] ?? { id: '' }).id;
    expect(data(await fetchSellerDevices(sellerId)).devices).toEqual([]);
    expect(await createChefInvite('wati')).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('forgets the old localStorage token, and sends the cookie instead of any header', async () => {
    localStorage.setItem('session', 'old-bearer-token');
    const spy = vi.spyOn(globalThis, 'fetch');
    expect((await fetchSellerOrders()).ok).toBe(true);
    const init = spy.mock.calls[0]?.[1];
    expect(localStorage.getItem('session')).toBeNull();
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    spy.mockRestore();
  });

  it('clears a session cookie the server no longer knows, so the next call works again', async () => {
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' }));
    await mockStores.forgetSessions(); // the server forgets every session
    expect(await fetchSellerOrders()).toMatchObject({
      ok: false,
      error: 'unauthorized',
      status: 401,
    });
    expect(await fetchMe()).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(sessionCookie()).toBeNull();
    expect(localStorage.getItem('signedIn')).toBeNull(); // the hint went with the 401
    expect((await fetchSellerOrders()).ok).toBe(true); // the dev X-Seller default works again
  });

  it('keeps the credential id (public data) but never the session in localStorage', async () => {
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' }));
    expect(getCredentialId()).toBe(browserPasskeys.authenticator.lastId);
    expect(localStorage.getItem('session')).toBeNull();
  });

  it('tells a closed prompt from a failed one, and the server stays clean', async () => {
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    browserPasskeys.failNext('cancel');
    expect(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' })).toMatchObject({
      ok: false,
      error: 'passkey_cancelled',
    });
    browserPasskeys.failNext('fail');
    expect(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' })).toMatchObject({
      ok: false,
      error: 'passkey_failed',
    });
    // Still a setup session: it can finish after the failures.
    expect(data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' })).me.stage).toBe(
      'full',
    );
  });

  it('rejects a replayed sign-in answer from the real server', async () => {
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    data(await registerDevice({ kind: 'passkey', deviceName: 'Laptop' }));
    await signOut();
    // Capture the browser's answer, send it, then send the very same answer again.
    const answers: Array<unknown> = [];
    const spy = vi.spyOn(globalThis, 'fetch');
    data(await signInWithPasskey());
    for (const [url, init] of spy.mock.calls) {
      if (typeof url === 'string' && url.endsWith('/api/auth/passkey')) answers.push(init?.body);
    }
    spy.mockRestore();
    const replay = await fetch('/api/auth/passkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: answers[0] as string,
    });
    expect(replay.status).toBe(401);
  });

  it('sends Saturday calls', async () => {
    const placed = await fetch('/api/s/onde-onde/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Rina',
        language: 'en',
        fulfilment: 'pickup',
        lines: [{ itemId: 'pesmol', qty: 1 }],
      }),
    });
    const code = ((await placed.json()) as { order: { code: string } }).order.code;
    const result = data(await sendUpdates({ template: 'readyIn', minutes: 15, codes: [code] }));
    expect(result.sent).toBe(1);
    expect(await sendArrivingSoon(code)).toMatchObject({ ok: false, error: 'invalid_status' });
  });
});
