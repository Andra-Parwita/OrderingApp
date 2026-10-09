import { describe, expect, it } from 'vitest';
import { liveEventOf, parseLiveEvent, parseLiveSignal } from './liveContract';

const NOW = new Date('2026-10-10T08:00:00.000Z');

describe('live events', () => {
  it('has exactly type, code and at, whatever else the caller passes', () => {
    const sneaky = {
      type: 'order.changed',
      code: 'K7F2QX',
      firstName: 'Rina',
      token: 'secret-token',
      phone: '+62 812',
    };
    const signal = parseLiveSignal(sneaky);
    expect(signal).toEqual({ type: 'order.changed', code: 'K7F2QX' });
    const event = liveEventOf(signal as NonNullable<typeof signal>, NOW);
    expect(Object.keys(event).sort()).toEqual(['at', 'code', 'type']);
    expect(JSON.stringify(event)).not.toMatch(/Rina|secret|812/);
  });

  it('omits the code when there is none', () => {
    expect(liveEventOf({ type: 'menu.changed' }, NOW)).toEqual({
      type: 'menu.changed',
      at: NOW.toISOString(),
    });
  });

  it('refuses unknown types and odd codes', () => {
    expect(parseLiveSignal({ type: 'order.deleted' })).toBeNull();
    expect(parseLiveSignal({ type: 'order.changed', code: '' })).toBeNull();
    expect(parseLiveSignal({ type: 'order.changed', code: 'x'.repeat(40) })).toBeNull();
    expect(parseLiveSignal({ type: 'order.changed', code: 5 })).toBeNull();
    expect(parseLiveSignal(null)).toBeNull();
  });

  it('round-trips through the text frame, and refuses junk frames', () => {
    const frame = JSON.stringify(liveEventOf({ type: 'order.created', code: 'K7F2QX' }, NOW));
    expect(parseLiveEvent(frame)).toEqual({
      type: 'order.created',
      code: 'K7F2QX',
      at: NOW.toISOString(),
    });
    expect(parseLiveEvent('pong')).toBeNull();
    expect(parseLiveEvent('{"type":"order.created"}')).toBeNull();
  });
});
