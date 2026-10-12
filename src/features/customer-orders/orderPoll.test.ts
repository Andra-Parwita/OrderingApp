import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNetSnapshot, recordOutcome, requestRetry, resetNetState } from '../../api/netState';
import { startOrderPoll } from './orderPoll';

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  resetNetState();
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function run(statuses: Array<number>) {
  let calls = 0;
  const stop = startOrderPoll(() => {
    recordOutcome('GET', statuses[Math.min(calls, statuses.length - 1)] ?? 200);
    calls += 1;
  }, 1000);
  return { stop, calls: () => calls };
}

describe('startOrderPoll', () => {
  it('polls every gap while things work', async () => {
    const { stop, calls } = run([200]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls()).toBe(3);
    stop();
  });

  it('does not poll while the tab is hidden, and refreshes once on return', async () => {
    const { stop, calls } = run([200]);
    hidden = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls()).toBe(0);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls()).toBe(2);
    stop();
  });

  it('doubles the gap once a failure is seen and resets after a success', async () => {
    // A refresh is judged at the next tick, so the first failure slows the poll from the third call.
    const { stop, calls } = run([503, 503, 200]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1999); // the gap is 2 s now
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(3);
    await vi.advanceTimersByTimeAsync(4000); // 503 seen twice: 4 s
    expect(calls()).toBe(4);
    stop();
  });

  it('stops after 5 refusals and polls again on Try again', async () => {
    const { stop, calls } = run([403]);
    await vi.advanceTimersByTimeAsync(10 * 60 * 60 * 1000);
    expect(calls()).toBe(5);
    expect(getNetSnapshot().stopped).toBe(true);
    requestRetry();
    expect(calls()).toBe(6);
    expect(getNetSnapshot().stopped).toBe(false);
    stop();
  });

  it('clears the stopped state when the screen is left', async () => {
    const { stop } = run([403]);
    await vi.advanceTimersByTimeAsync(10 * 60 * 60 * 1000);
    expect(getNetSnapshot().stopped).toBe(true);
    stop();
    expect(getNetSnapshot().stopped).toBe(false);
  });
});
