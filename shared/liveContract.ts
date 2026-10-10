// Live updates (stage 8.3, D-046): what the seller's Durable Object pushes over the WebSocket.
// Events are only a nudge ("something changed"): they carry no customer data, so a client always
// refetches through the normal, authorised API.
import { isIsoDate, isOneOf, isRecord } from './parse';

/** The seller-side socket. The Worker upgrades it and hands it to that seller's Durable Object. */
export const LIVE_PATH = '/api/seller/live';

/** The client sends this text now and then; the Durable Object answers `pong` without waking. */
export const LIVE_PING = 'ping';
export const LIVE_PONG = 'pong';

export const LIVE_EVENT_TYPES = ['order.created', 'order.changed', 'menu.changed'] as const;
export type LiveEventType = (typeof LIVE_EVENT_TYPES)[number];

/** What a route says happened; the Durable Object adds `at`. `code` is the seller-facing order code. */
export type LiveSignal = { type: LiveEventType; code?: string };

export type LiveEvent = LiveSignal & { at: string };

/** An order code is short; anything longer is not one. */
const CODE_MAX = 12;

export function parseLiveSignal(input: unknown): LiveSignal | null {
  if (!isRecord(input) || !isOneOf(LIVE_EVENT_TYPES, input['type'])) return null;
  const { code } = input;
  if (code === undefined) return { type: input['type'] };
  if (typeof code !== 'string' || code === '' || code.length > CODE_MAX) return null;
  return { type: input['type'], code };
}

/** Parses an event as the client receives it (text frame, JSON). */
export function parseLiveEvent(text: string): LiveEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const signal = parseLiveSignal(json);
  const at = isRecord(json) ? json['at'] : undefined;
  if (!signal || !isIsoDate(at)) return null;
  return { ...signal, at };
}

/**
 * The frame the Durable Object sends. Built field by field from the signal, so nothing else a
 * caller passes in can ever reach a socket.
 */
export function liveEventOf(signal: LiveSignal, at: Date): LiveEvent {
  return {
    type: signal.type,
    ...(signal.code !== undefined ? { code: signal.code } : {}),
    at: at.toISOString(),
  };
}
