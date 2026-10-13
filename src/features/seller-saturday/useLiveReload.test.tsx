import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEventType } from '../../../shared/liveContract';
import { sellerDeviceId } from '../../api/deviceId';
import { setBackupMinutes } from '../../api/backupMinutes';
import type { LiveListener, LiveStatus } from '../../api/live';
import { BURST_MS, useLiveReload, type Wanted } from './useLiveReload';

// Plan 074: a seller screen has no timer of its own. Connected, it asks for nothing; an event
// reloads what it names; while the connection is down and the page is visible it checks every
// "seller backup minutes"; a hidden page asks for nothing and reloads when shown again.

const MIN = 60_000;
let listener: LiveListener | null = null;
const subscribe = (next: LiveListener) => {
  listener = next;
  return () => {
    listener = null;
  };
};
const status = (value: LiveStatus) => listener?.onStatus(value);
const event = (type: LiveEventType, from?: string) =>
  listener?.onEvent({ type, ...(from ? { from } : {}), at: '2026-10-14T08:00:00.000Z' });
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function mount() {
  const load = vi.fn<(wanted: Wanted) => Promise<void>>(() => Promise.resolve());
  const view = renderHook(() => useLiveReload(load, subscribe));
  return { load, ...view };
}

beforeEach(() => {
  vi.useFakeTimers();
  setBackupMinutes({ customer: 5, seller: 5 });
  setHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLiveReload', () => {
  it('connected for 10 minutes: the first load and nothing else', async () => {
    const { load } = mount();
    status('connecting');
    status('live');
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith(null);
  });

  it('an event reloads the types it names; a burst is one reload', async () => {
    const { load } = mount();
    status('live');
    await vi.advanceTimersByTimeAsync(0);
    event('stock.changed');
    event('order.changed');
    event('stock.changed');
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1]?.[0]).toEqual(new Set(['stock.changed', 'order.changed']));
  });

  it('while the connection is down it checks every backup-minutes (the admin setting), not faster', async () => {
    setBackupMinutes({ customer: 5, seller: 2 });
    const { load } = mount();
    status('connecting');
    status('reconnecting');
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * MIN - 10);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(null);
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('a hidden page asks for nothing; showing it again reloads at once', async () => {
    const { load } = mount();
    status('reconnecting');
    await vi.advanceTimersByTimeAsync(0);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
    setHidden(false);
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
    // ...and the backup check starts again.
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('an event while hidden waits for the page to be shown', async () => {
    const { load } = mount();
    status('live');
    await vi.advanceTimersByTimeAsync(0);
    setHidden(true);
    event('order.created');
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(1);
    setHidden(false);
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads everything when the connection comes back, and stops the backup check', async () => {
    const { load } = mount();
    status('reconnecting');
    await vi.advanceTimersByTimeAsync(0);
    status('live');
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(null);
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('ignores events from this device (always), reloads for another device or no origin', async () => {
    const { load } = mount();
    status('live');
    await vi.advanceTimersByTimeAsync(0);
    event('stock.changed', sellerDeviceId()); // this device's own echo
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000); // no time window: still this device's
    event('stock.changed', sellerDeviceId());
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(1);
    event('stock.changed', '0000000000000000'); // another device, right after
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
    event('stock.changed'); // an old client: no origin
    await vi.advanceTimersByTimeAsync(BURST_MS + 1);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
