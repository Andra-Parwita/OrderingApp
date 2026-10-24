import { afterEach, describe, expect, it, vi } from 'vitest';
import { readOrderStats } from './orderStats';
import type { PushDeps } from './pushBrowser';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

function deps(subscribed: boolean): PushDeps {
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(subscribed ? ({} as never) : null),
      subscribe: () => Promise.reject(new Error('not used')),
    },
  };
  return {
    fetchPublicKey: vi.fn(),
    subscribeOrder: vi.fn(),
    unsubscribeOrder: vi.fn(),
    getRegistration: () => Promise.resolve(registration),
    peekRegistration: () => Promise.resolve(registration),
  };
}

function phone(userAgent: string, opts: { standalone?: boolean; permission?: string } = {}) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  window.matchMedia = ((query: string) => ({
    matches: opts.standalone === true && query.includes('standalone'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: opts.permission ?? 'default' });
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('readOrderStats (plan 121 B)', () => {
  it('an iPhone in Safari: browser, ios, notifications off', async () => {
    phone(IPHONE_SAFARI);
    expect(await readOrderStats(deps(false))).toEqual({
      place: 'browser',
      os: 'ios',
      push: false,
      remember: false,
    });
  });

  it('the installed app on Android with notifications on', async () => {
    phone(ANDROID_CHROME, { standalone: true, permission: 'granted' });
    expect(await readOrderStats(deps(true))).toMatchObject({
      place: 'app',
      os: 'android',
      push: true,
    });
  });

  it('WhatsApp is in-app; permission without a subscription is off', async () => {
    phone(`${IPHONE_SAFARI} WhatsApp/2.24`.replace('Safari/604.1', ''), { permission: 'granted' });
    expect(await readOrderStats(deps(false))).toMatchObject({ place: 'inapp', push: false });
  });

  it('a fact that cannot be read is left out, and nothing throws', async () => {
    phone(ANDROID_CHROME, { permission: 'granted' });
    const broken = deps(true);
    (broken as { peekRegistration: PushDeps['peekRegistration'] }).peekRegistration = () =>
      Promise.reject(new Error('no service worker'));
    const stats = await readOrderStats(broken);
    expect(stats.push).toBeUndefined();
    expect(stats).toMatchObject({ place: 'browser', os: 'android' });
  });

  it('only ever holds the four allowed keys', async () => {
    phone(IPHONE_SAFARI);
    expect(Object.keys(await readOrderStats(deps(false))).sort()).toEqual([
      'os',
      'place',
      'push',
      'remember',
    ]);
  });
});
