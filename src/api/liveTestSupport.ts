// Test-only: a hand-driven live channel for the saga tests (no socket, no timers).
import { buffers, eventChannel, type EventChannel } from 'redux-saga';
import type { LiveMessage, LiveStatus } from './live';

export type FakeLive = {
  /** Pass to the saga as its `channel` option. */
  channel: () => EventChannel<LiveMessage>;
  status: (status: LiveStatus) => void;
  event: (type: 'order.created' | 'order.changed' | 'menu.changed', code?: string) => void;
  /** How many times a saga opened the channel, and how many of those are still open. */
  opened: () => number;
  open: () => number;
};

export function createFakeLive(): FakeLive {
  const emitters = new Set<(message: LiveMessage) => void>();
  let opened = 0;
  const send = (message: LiveMessage) => {
    for (const emit of [...emitters]) emit(message);
  };
  return {
    channel: () => {
      opened += 1;
      return eventChannel<LiveMessage>((emit) => {
        emitters.add(emit);
        return () => emitters.delete(emit);
      }, buffers.expanding(16));
    },
    status: (status) => send({ kind: 'status', status }),
    event: (type, code) =>
      send({
        kind: 'event',
        event: { type, ...(code ? { code } : {}), at: '2026-10-10T08:00:00.000Z' },
      }),
    opened: () => opened,
    open: () => emitters.size,
  };
}
