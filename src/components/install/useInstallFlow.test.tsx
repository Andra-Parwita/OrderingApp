import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../../api/http';
import type { Environment } from './detect';
import type { BrowserSubscription, PushDeps, PushRegistration } from './pushBrowser';
import { setSavedInstallPrompt } from './installPrompt';
import { useInstallFlow, useOrderInstall } from './useInstallFlow';
import { MY_ORDERS_KEY } from '../../api/device/myOrders';

const ENDPOINT = 'https://push.example.test/send/abc';
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

const android: Environment = {
  platform: 'android',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};
const iphoneInstalled: Environment = { ...android, platform: 'ios', safari: true, installed: true };

function fakeDeps(keyResult: ApiResult<string> = ok('BKey')) {
  const subscription: BrowserSubscription & { unsubscribe: ReturnType<typeof vi.fn> } = {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  let held: BrowserSubscription | null = null;
  const registration: PushRegistration = {
    pushManager: {
      getSubscription: () => Promise.resolve(held),
      subscribe: () => {
        held = subscription;
        return Promise.resolve(subscription);
      },
    },
  };
  const deps = {
    fetchPublicKey: vi.fn(() => Promise.resolve(keyResult)),
    subscribeOrder: vi.fn(() => Promise.resolve(ok<true>(true))),
    unsubscribeOrder: vi.fn(() => Promise.resolve(ok<true>(true))),
    getRegistration: vi.fn(() => Promise.resolve(registration)),
    peekRegistration: vi.fn(() => Promise.resolve(registration)),
  } satisfies PushDeps;
  return { deps, subscription };
}

function stubNotification(answer: NotificationPermission) {
  const fake = {
    permission: 'default' as NotificationPermission,
    requestPermission: vi.fn(() => {
      fake.permission = answer;
      return Promise.resolve(answer);
    }),
  };
  vi.stubGlobal('Notification', fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setSavedInstallPrompt(null);
});

describe('useInstallFlow', () => {
  it('never asks for permission until the tap, then asks once and subscribes', async () => {
    const notification = stubNotification('granted');
    const { deps } = fakeDeps();
    const { result } = renderHook(() =>
      useInstallFlow({ tokens: () => ['tok'], env: android, deps }),
    );
    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');

    act(() => result.current.start());
    // Asked for in the same tap (Android: no sheet of its own to wait on).
    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.flow.screen).toBe('android-allow');

    await waitFor(() => expect(result.current.status).toBe('on'));
    expect(deps.subscribeOrder).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ endpoint: ENDPOINT }),
    );
    expect(result.current.flow.screen).toBeNull();
  });

  it('an installed iPhone shows its Last step screen first and asks only from that button', async () => {
    const notification = stubNotification('granted');
    const { deps } = fakeDeps();
    const { result } = renderHook(() =>
      useInstallFlow({ tokens: () => ['tok'], env: iphoneInstalled, deps }),
    );
    act(() => result.current.start());
    expect(result.current.flow.screen).toBe('notify-off');
    expect(notification.requestPermission).not.toHaveBeenCalled();
    act(() => result.current.enable());
    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe('on'));
  });

  it('a refusal shows the blocked screen, and "I turned them on" checks again', async () => {
    stubNotification('denied');
    const { deps } = fakeDeps();
    const { result } = renderHook(() =>
      useInstallFlow({ tokens: () => ['tok'], env: iphoneInstalled, deps }),
    );
    act(() => result.current.enable());
    await waitFor(() => expect(result.current.flow.screen).toBe('notify-blocked'));
    expect(result.current.status).toBe('blocked');
    expect(deps.fetchPublicKey).not.toHaveBeenCalled();

    // Still denied: stays, with a hint.
    act(() => result.current.recheck());
    expect(result.current.flow.hint).toBe('still-blocked');

    // The customer allows them in Settings and comes back.
    (Notification as unknown as { permission: string }).permission = 'granted';
    act(() => result.current.recheck());
    await waitFor(() => expect(result.current.status).toBe('on'));
    expect(result.current.flow.screen).toBeNull();
  });

  it('says so when the server has no push keys', async () => {
    stubNotification('granted');
    const { deps } = fakeDeps({
      ok: false,
      error: 'not_found',
      status: 404,
      message: 'Notifications are not set up',
    });
    const { result } = renderHook(() =>
      useInstallFlow({ tokens: () => ['tok'], env: iphoneInstalled, deps }),
    );
    act(() => result.current.enable());
    await waitFor(() => expect(result.current.flow.screen).toBe('not-set-up'));
    expect(result.current.status).toBe('off');
  });

  it('a dismissed prompt leaves everything as it was', async () => {
    stubNotification('default');
    const { deps } = fakeDeps();
    const { result } = renderHook(() =>
      useInstallFlow({ tokens: () => ['tok'], env: iphoneInstalled, deps }),
    );
    act(() => result.current.start());
    act(() => result.current.enable());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.flow.screen).toBe('notify-off');
    expect(deps.subscribeOrder).not.toHaveBeenCalled();
  });

  it('turning off unsubscribes every order and the browser', async () => {
    stubNotification('granted');
    const { deps, subscription } = fakeDeps();
    const { result } = renderHook(() =>
      useInstallFlow({
        tokens: () => ['a', 'b'],
        env: { ...android, permission: 'granted' },
        subscribed: true,
        deps,
      }),
    );
    expect(result.current.status).toBe('on');
    // The browser holds the subscription the fixed state stands for.
    await act(async () => {
      await deps.getRegistration().then((r) =>
        r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: new Uint8Array(),
        }),
      );
    });
    act(() => result.current.disable());
    await waitFor(() => expect(result.current.status).toBe('off'));
    expect(deps.unsubscribeOrder).toHaveBeenCalledWith('a', ENDPOINT);
    expect(deps.unsubscribeOrder).toHaveBeenCalledWith('b', ENDPOINT);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('install on Android without a prompt opens the by-hand screen and never asks for notifications', () => {
    const notification = stubNotification('granted');
    const { result } = renderHook(() => useInstallFlow({ tokens: () => ['tok'], env: android }));
    act(() => result.current.install());
    expect(result.current.flow.screen).toBe('android-install');
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });

  it('install inside WhatsApp shows the Open in Chrome screen; with a prompt it uses the browser dialog', () => {
    const notification = stubNotification('granted');
    const inApp = renderHook(() =>
      useInstallFlow({ tokens: () => [], env: { ...android, inApp: true, inAppName: 'WhatsApp' } }),
    );
    act(() => inApp.result.current.install());
    expect(inApp.result.current.flow.screen).toBe('android-inside-whatsapp');

    const prompt = vi.fn().mockResolvedValue(undefined);
    setSavedInstallPrompt({
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    } as never);
    const plain = renderHook(() => useInstallFlow({ tokens: () => [], env: android }));
    act(() => plain.result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(plain.result.current.flow.screen).toBeNull();
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });

  it('copies the order link for the in-app screens', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { result } = renderHook(() =>
      useInstallFlow({
        tokens: () => [],
        env: { ...iphoneInstalled, installed: false, inApp: true, safari: false },
        linkUrl: () => 'https://delave.test/o/tok',
      }),
    );
    act(() => result.current.copyLink());
    await waitFor(() => expect(result.current.flow.hint).toBe('copied'));
    expect(writeText).toHaveBeenCalledWith('https://delave.test/o/tok');
  });

  it('copies the order link under its kitchen (plan 102): from the page, else from My orders', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const env = { ...iphoneInstalled, installed: false, inApp: true, safari: false };
    window.history.replaceState(null, '', '/onde-onde/o/tok-page/placed');
    const onPage = renderHook(() => useOrderInstall('tok-page', { env }));
    act(() => onPage.result.current.copyLink());
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/onde-onde/o/tok-page`),
    );

    // an old address: the kitchen My orders saved
    localStorage.setItem(
      MY_ORDERS_KEY,
      JSON.stringify([
        {
          code: 'ABC234',
          token: 'tok-saved',
          placedAt: new Date().toISOString(),
          sellerSlug: 'dapur-demo',
          lastStatus: 'ordered',
        },
      ]),
    );
    window.history.replaceState(null, '', '/o/tok-saved');
    const old = renderHook(() => useOrderInstall('tok-saved', { env }));
    act(() => old.result.current.copyLink());
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/dapur-demo/o/tok-saved`),
    );
    window.history.replaceState(null, '', '/');
    localStorage.clear();
  });
});
