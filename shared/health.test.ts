import { describe, expect, it } from 'vitest';
import { parseHealth } from './health';

describe('parseHealth', () => {
  it('accepts a valid response', () => {
    const body = { status: 'ok', time: '2026-10-07T10:00:00.000Z' };
    expect(parseHealth(body)).toEqual(body);
  });

  it.each([
    ['null', null],
    ['a string', 'ok'],
    ['an empty object', {}],
    ['a wrong status', { status: 'down', time: '2026-10-07T10:00:00.000Z' }],
    ['a missing time', { status: 'ok' }],
    ['a non-string time', { status: 'ok', time: 5 }],
    ['an unparseable time', { status: 'ok', time: 'yesterday' }],
  ])('rejects %s', (_label, body) => {
    expect(parseHealth(body)).toBeNull();
  });
});
