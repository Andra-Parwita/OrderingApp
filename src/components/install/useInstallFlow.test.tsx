import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../../api/http';
import type { Environment } from './detect';
import type { BrowserSubscription, PushDeps, PushRegistration } from './pushBrowser';
import { useInstallFlow } from './useInstallFlow';

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
});
