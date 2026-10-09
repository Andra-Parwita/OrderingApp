import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../../api/http';
import {
  currentSubscription,
  disablePush,
  enablePush,
  urlBase64ToBytes,
  type BrowserSubscription,
  type PushDeps,
  type PushRegistration,
} from './pushBrowser';

const ENDPOINT = 'https://push.example.test/send/abc';
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (error: 'not_found' | 'network'): ApiResult<never> => ({
  ok: false,
  error,
  status: error === 'network' ? 0 : 404,
  message: error,
});

function fakeSubscription(): BrowserSubscription & { unsubscribe: ReturnType<typeof vi.fn> } {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'P256', auth: 'AUTH' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
}

function fakeDeps(existing: BrowserSubscription | null = null, overrides: Partial<PushDeps> = {}) {
  const created = fakeSubscription();
  const subscribe = vi.fn(() => Promise.resolve(created));
  const registration: PushRegistration = {
    pushManager: { getSubscription: () => Promise.resolve(existing), subscribe },
  };
  const deps = {
    fetchPublicKey: vi.fn(() => Promise.resolve(ok('BPublicKey_-'))),
    subscribeOrder: vi.fn(() => Promise.resolve(ok<true>(true))),
    unsubscribeOrder: vi.fn(() => Promise.resolve(ok<true>(true))),
    getRegistration: vi.fn(() => Promise.resolve(registration)),
    peekRegistration: vi.fn(() => Promise.resolve(registration)),
    ...overrides,
  } satisfies PushDeps;
  return { deps, subscribe, created };
}

describe('urlBase64ToBytes', () => {
  it('decodes the URL-safe base64 the VAPID key comes in', () => {
    // "Man" -> TWFu; "-_" are the URL-safe forms of "+/".
    expect(Array.from(urlBase64ToBytes('TWFu'))).toEqual([77, 97, 110]);
    expect(Array.from(urlBase64ToBytes('-_8'))).toEqual([251, 255]);
  });
});

describe('enablePush', () => {
  it('subscribes with the server key and sends the subscription for each order', async () => {
    const { deps, subscribe, created } = fakeDeps();
    const result = await enablePush(['tok-1', 'tok-2'], deps);
    expect(result).toEqual({ ok: true });
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array) as unknown,
      }),
    );
    expect(deps.subscribeOrder).toHaveBeenCalledTimes(2);
    expect(deps.subscribeOrder).toHaveBeenCalledWith('tok-1', {
      endpoint: created.endpoint,
      keys: { p256dh: 'P256', auth: 'AUTH' },
    });
  });

  it('reuses a subscription the browser already has', async () => {
    const existing = fakeSubscription();
    const { deps, subscribe } = fakeDeps(existing);
    await enablePush(['tok'], deps);
    expect(subscribe).not.toHaveBeenCalled();
    expect(deps.subscribeOrder).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ endpoint: ENDPOINT }),
    );
  });

  it('says not-set-up when the server has no push keys (404)', async () => {
    const { deps, subscribe } = fakeDeps(null, {
      fetchPublicKey: vi.fn(() => Promise.resolve(fail('not_found'))),
    });
    expect(await enablePush(['tok'], deps)).toEqual({ ok: false, reason: 'not-set-up' });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('says failed on a network error, a refused subscription or when every order refuses', async () => {
    const offline = fakeDeps(null, {
      fetchPublicKey: vi.fn(() => Promise.resolve(fail('network'))),
    });
    expect(await enablePush(['tok'], offline.deps)).toEqual({ ok: false, reason: 'failed' });
    const refused = fakeDeps(null, {
      getRegistration: vi.fn(() => Promise.reject(new Error('no service worker'))),
    });
    expect(await enablePush(['tok'], refused.deps)).toEqual({ ok: false, reason: 'failed' });
    const noOrder = fakeDeps(null, {
      subscribeOrder: vi.fn(() => Promise.resolve(fail('not_found'))),
    });
    expect(await enablePush(['tok'], noOrder.deps)).toEqual({ ok: false, reason: 'failed' });
  });

  it('is fine with one order refusing (a closed week) while another takes it', async () => {
    const subscribeOrder = vi
      .fn()
      .mockResolvedValueOnce(fail('not_found'))
      .mockResolvedValueOnce(ok(true));
    const { deps } = fakeDeps(null, { subscribeOrder });
    expect(await enablePush(['old', 'new'], deps)).toEqual({ ok: true });
  });

  it('with no orders yet it still subscribes the browser', async () => {
    const { deps, subscribe } = fakeDeps();
    expect(await enablePush([], deps)).toEqual({ ok: true });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});

describe('disablePush', () => {
  it('tells the server for each order, then drops the browser subscription', async () => {
    const existing = fakeSubscription();
    const { deps } = fakeDeps(existing);
    expect(await disablePush(['a', 'b'], deps)).toBe(true);
    expect(deps.unsubscribeOrder).toHaveBeenCalledWith('a', ENDPOINT);
    expect(deps.unsubscribeOrder).toHaveBeenCalledWith('b', ENDPOINT);
    expect(existing.unsubscribe).toHaveBeenCalled();
  });

  it('is already done when the browser has no subscription', async () => {
    const { deps } = fakeDeps(null);
    expect(await disablePush(['a'], deps)).toBe(true);
    expect(deps.unsubscribeOrder).not.toHaveBeenCalled();
  });
});

describe('currentSubscription', () => {
  it('looks without registering anything, and returns null with no registration', async () => {
    const { deps } = fakeDeps(fakeSubscription());
    expect(await currentSubscription(deps)).toEqual({
      endpoint: ENDPOINT,
      keys: { p256dh: 'P256', auth: 'AUTH' },
    });
    expect(deps.getRegistration).not.toHaveBeenCalled();
    const none = fakeDeps(null, { peekRegistration: vi.fn(() => Promise.resolve(null)) });
    expect(await currentSubscription(none.deps)).toBeNull();
  });
});
