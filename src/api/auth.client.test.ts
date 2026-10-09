import { beforeEach, describe, expect, it } from 'vitest';
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
import { getCredentialId, getSessionToken, setSessionToken } from './device/session';
import type { ApiResult } from './http';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

beforeEach(() => {
  mockStores.reset();
  localStorage.clear();
});

describe('sign-in client', () => {
  it('runs the whole flow: admin, seller, devices, and keeps the token', async () => {
    expect(await adminSetup('wrong')).toMatchObject({
      ok: false,
      error: 'invalid_credentials',
      triesLeft: 4,
    });
    data(await adminSetup(DEV_ADMIN_SETUP_KEY));
    expect(data(await fetchMe()).me.stage).toBe('setup');
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
    expect(getSessionToken()).toBeNull();
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

  it('drops a stale token after a 401, so the next call works again', async () => {
    setSessionToken('stale-token');
    expect(await fetchSellerOrders()).toMatchObject({
      ok: false,
      error: 'unauthorized',
      status: 401,
    });
    expect(getSessionToken()).toBeNull();
    expect((await fetchSellerOrders()).ok).toBe(true); // the dev X-Seller default works again
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
