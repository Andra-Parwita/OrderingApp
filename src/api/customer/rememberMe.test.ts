import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));
vi.mock('@simplewebauthn/browser', () => ({
  ...lib,
  browserSupportsWebAuthn: () => true,
}));

import { savedAddress, rememberAddress } from '../device/address';
import { storedCustomerCode } from '../device/customerCode';
import { readMyOrders } from '../device/myOrders';
import { toB64Url, keyFromPrf, sealAddress } from './crypto';
import { setKeyStoreForTests, type KeyStore } from './keyStore';
import { deleteMySavedData, restoreWithPasskey, signOutHere, turnOnRememberMe } from './rememberMe';
import { rememberMeLocal } from './state';
import { resetSyncForTests } from './sync';

const TOKEN = 'T'.repeat(22);
const OTHER = 'U'.repeat(22);
const CODE = 'ab'.repeat(12);
const PRF = new Uint8Array(32).fill(7);

let stored: CryptoKey | null = null;
const memory: KeyStore = {
  get: () => Promise.resolve(stored),
  set: (key) => {
    stored = key;
    return Promise.resolve();
  },
  clear: () => {
    stored = null;
    return Promise.resolve();
  },
};

type Call = { method: string; url: string; body: unknown };
let calls: Array<Call> = [];
let routes: Record<string, (call: Call) => { status?: number; json: unknown }> = {};

const me = (extra: Record<string, unknown> = {}) => ({
  me: {
    firstName: 'Putu',
    credentialId: 'cred-1',
    prf: true,
    setup: false,
    sealed: null,
    ...extra,
  },
});

beforeEach(() => {
  localStorage.clear();
  stored = null;
  calls = [];
  routes = {};
  resetSyncForTests();
  setKeyStoreForTests(memory);
  lib.startRegistration.mockReset();
  lib.startAuthentication.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body ? JSON.parse(init.body as string) : undefined;
      const call = { method, url, body };
      calls.push(call);
      const route = routes[`${method} ${url.split('?')[0] ?? url}`];
      const reply = route?.(call) ?? { status: 404, json: { error: 'not_found', message: 'x' } };
      return Promise.resolve(
        new Response(JSON.stringify(reply.json), {
          status: reply.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const options = { options: { challenge: 'abc', rp: { id: 'x', name: 'x' } } };
function standardRoutes(prfCapable: boolean) {
  routes['POST /api/customer/register/options'] = () => ({ json: options });
  routes['POST /api/customer/passkey/options'] = () => ({ json: options });
  routes['POST /api/customer/register'] = () => ({ status: 201, json: me({ prf: prfCapable }) });
  routes['POST /api/customer/passkey'] = () => ({ json: me({ prf: prfCapable }) });
  routes['GET /api/customer/orders'] = () => ({
    json: { orders: [{ token: OTHER, slug: 'della' }] },
  });
  routes['POST /api/customer/orders'] = () => ({ json: { orders: [] } });
  routes['GET /api/customer/me'] = () => ({ json: me({ customerCode: CODE, code: 'C-7K3M' }) });
  routes['GET /api/customer/address'] = () => ({ json: { sealed: null } });
  routes['PUT /api/customer/address'] = () => ({ json: { sealed: null } });
}

const answer = (extra: Record<string, unknown>) => ({
  id: 'cred-1',
  rawId: 'cred-1',
  type: 'public-key',
  response: {},
  clientExtensionResults: extra,
});

describe('turn on', () => {
  it('strips the PRF result from what it sends, and keeps the sealing key on the phone', async () => {
    standardRoutes(true);
    localStorage.setItem('firstName', 'Putu');
    lib.startRegistration.mockResolvedValue(
      answer({ prf: { enabled: true, results: { first: PRF.buffer } } }),
    );
    const outcome = await turnOnRememberMe();
    expect(outcome).toMatchObject({ ok: true, sealing: true });
    const register = calls.find((c) => c.url === '/api/customer/register');
    const sent = register?.body as { prf: boolean; response: { clientExtensionResults: object } };
    expect(sent.prf).toBe(true);
    expect(sent.response.clientExtensionResults).not.toHaveProperty('prf');
    expect(JSON.stringify(calls.map((c) => c.body))).not.toContain(toB64Url(PRF));
    expect(stored).not.toBeNull();
    expect(rememberMeLocal()).toMatchObject({ credentialId: 'cred-1', sealing: true });
    // the salt was asked for in the options
    const asked = lib.startRegistration.mock.calls[0]?.[0] as {
      optionsJSON: { extensions: { prf: { eval: { first: Uint8Array } } } };
    };
    expect(asked.optionsJSON.extensions.prf.eval.first).toHaveLength(32);
  });

  it('does one extra get() when create says enabled but gives no result', async () => {
    standardRoutes(true);
    lib.startRegistration.mockResolvedValue(answer({ prf: { enabled: true } }));
    lib.startAuthentication.mockResolvedValue(answer({ prf: { results: { first: PRF.buffer } } }));
    const outcome = await turnOnRememberMe();
    expect(lib.startAuthentication).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ ok: true, sealing: true });
    // the second answer is never sent anywhere
    expect(calls.some((c) => JSON.stringify(c.body ?? '').includes('"first"'))).toBe(false);
  });

  it('without PRF the address stays on the phone and nothing is sealed or sent', async () => {
    standardRoutes(false);
    rememberAddress({ street: '1 Rundle Mall', suburb: 'Adelaide', postcode: '5000' });
    lib.startRegistration.mockResolvedValue(answer({}));
    const outcome = await turnOnRememberMe();
    expect(outcome).toMatchObject({ ok: true, sealing: false });
    expect(lib.startAuthentication).not.toHaveBeenCalled();
    expect(stored).toBeNull();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(savedAddress()?.street).toBe('1 Rundle Mall');
  });

  it('maps a cancelled prompt and a seller passkey to friendly errors', async () => {
    standardRoutes(true);
    const cancelled = new Error('x');
    cancelled.name = 'NotAllowedError';
    lib.startRegistration.mockRejectedValue(cancelled);
    expect(await turnOnRememberMe()).toEqual({ ok: false, error: 'cancelled' });
    routes['POST /api/customer/passkey/options'] = () => ({
      status: 400,
      json: { error: 'passkey_other_kind', message: 'seller' },
    });
    expect(await restoreWithPasskey()).toEqual({ ok: false, error: 'other_kind' });
  });
});

describe('restore on a new phone', () => {
  it('merges the orders, writes the kitchen code, opens the sealed address', async () => {
    standardRoutes(true);
    const key = await keyFromPrf(PRF);
    const sealed = await sealAddress(
      key,
      { street: '9 Norwood Pde', suburb: 'Norwood', postcode: '5067' },
      'cred-1',
    );
    routes['GET /api/customer/address'] = () => ({ json: { sealed } });
    localStorage.setItem(
      'myOrders',
      JSON.stringify([
        { code: 'A-1', token: TOKEN, placedAt: '2026-10-10T00:00:00Z', sellerSlug: 'onde' },
      ]),
    );
    lib.startAuthentication.mockResolvedValue(answer({ prf: { results: { first: PRF.buffer } } }));
    const outcome = await restoreWithPasskey();
    expect(outcome).toMatchObject({ ok: true, sealing: true, restored: 1 });
    const orders = readMyOrders();
    expect(orders.map((o) => o.token).sort()).toEqual([OTHER, TOKEN].sort());
    expect(orders.find((o) => o.token === TOKEN)?.code).toBe('A-1');
    expect(storedCustomerCode('onde')).toBe(CODE);
    expect(savedAddress()).toMatchObject({ street: '9 Norwood Pde' });
    const signIn = calls.find((c) => c.url === '/api/customer/passkey');
    expect(JSON.stringify(signIn?.body)).not.toContain('"prf"');
  });
});

describe('sign out and delete', () => {
  it('sign out forgets the key and the flag but keeps My orders', async () => {
    standardRoutes(true);
    routes['POST /api/customer/sign-out'] = () => ({ json: { ok: true } });
    lib.startRegistration.mockResolvedValue(
      answer({ prf: { enabled: true, results: { first: PRF.buffer } } }),
    );
    await turnOnRememberMe();
    expect(rememberMeLocal()).not.toBeNull();
    await signOutHere();
    expect(rememberMeLocal()).toBeNull();
    expect(stored).toBeNull();
    expect(readMyOrders().length).toBeGreaterThan(0);
  });

  it('delete removes everything on our side, then the key; local orders stay', async () => {
    standardRoutes(true);
    routes['DELETE /api/customer/me'] = () => ({ json: { ok: true } });
    lib.startRegistration.mockResolvedValue(
      answer({ prf: { enabled: true, results: { first: PRF.buffer } } }),
    );
    await turnOnRememberMe();
    const result = await deleteMySavedData();
    expect(result).toEqual({ ok: true, signalled: false });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(rememberMeLocal()).toBeNull();
    expect(stored).toBeNull();
    expect(readMyOrders().length).toBeGreaterThan(0);
  });
});
