import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZONE,
  convertWindow,
  deviceZone,
  isValidZone,
  offsetMinutes,
  splitInstant,
  toInstant,
  zoneCity,
  zoneOffset,
} from './zone';

const ADELAIDE = 'Australia/Adelaide';
const JAKARTA = 'Asia/Jakarta';

describe('the test device', () => {
  it('runs in Adelaide (vitest.config.ts sets TZ)', () => {
    expect(deviceZone()).toBe(ADELAIDE);
    // 2026-10-16T00:00Z is 10:30 in Adelaide (daylight time)
    expect(new Date('2026-10-16T00:00:00Z').getHours()).toBe(10);
    expect(new Date('2026-10-16T00:00:00Z').getMinutes()).toBe(30);
  });
});

describe('zone names', () => {
  it('knows valid IANA names', () => {
    expect(DEFAULT_ZONE).toBe(ADELAIDE);
    expect(isValidZone(ADELAIDE)).toBe(true);
    expect(isValidZone(JAKARTA)).toBe(true);
    expect(isValidZone('Mars/Olympus')).toBe(false);
    expect(isValidZone('')).toBe(false);
    expect(isValidZone(42)).toBe(false);
  });

  it('shows the city', () => {
    expect(zoneCity(ADELAIDE)).toBe('Adelaide');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});

describe('offsets', () => {
  it('Adelaide is +10:30 in daylight time and +09:30 in standard time', () => {
    expect(offsetMinutes(Date.parse('2026-10-16T00:00:00Z'), ADELAIDE)).toBe(630);
    expect(offsetMinutes(Date.parse('2026-04-10T00:00:00Z'), ADELAIDE)).toBe(570);
    expect(zoneOffset('2026-10-16', ADELAIDE)).toBe('+10:30');
    expect(zoneOffset('2026-04-10', ADELAIDE)).toBe('+09:30');
  });

  it('Jakarta is +07:00 all year', () => {
    expect(zoneOffset('2026-10-16', JAKARTA)).toBe('+07:00');
    expect(zoneOffset('2026-04-10', JAKARTA)).toBe('+07:00');
  });

  it('changes on the daylight saving days', () => {
    // Sun 4 Oct 2026: daylight time starts at 02:00 standard time
    expect(toInstant('2026-10-03', '23:59', ADELAIDE)).toBe('2026-10-03T23:59:00+09:30');
    expect(toInstant('2026-10-04', '12:00', ADELAIDE)).toBe('2026-10-04T12:00:00+10:30');
    // Sun 5 Apr 2026: daylight time ends at 03:00 local
    expect(toInstant('2026-04-04', '23:59', ADELAIDE)).toBe('2026-04-04T23:59:00+10:30');
    expect(toInstant('2026-04-05', '12:00', ADELAIDE)).toBe('2026-04-05T12:00:00+09:30');
  });
});

describe('wall clock and instants', () => {
  it('round-trips in both zones', () => {
    for (const zone of [ADELAIDE, JAKARTA]) {
      for (const [date, time] of [
        ['2026-10-16', '21:00'],
        ['2026-04-10', '09:05'],
        ['2026-10-04', '12:00'],
        ['2026-12-31', '23:30'],
      ] as const) {
        expect(splitInstant(toInstant(date, time, zone), zone)).toEqual({ date, time });
      }
    }
  });

  it('is the same moment, a different wall clock', () => {
    const iso = toInstant('2026-10-16', '21:00', ADELAIDE);
    expect(iso).toBe('2026-10-16T21:00:00+10:30');
    expect(Date.parse(iso)).toBe(Date.parse('2026-10-16T10:30:00Z'));
    expect(splitInstant(iso, JAKARTA)).toEqual({ date: '2026-10-16', time: '17:30' });
    // The day boundary: just after midnight in Adelaide is still the evening before in Jakarta
    expect(splitInstant('2026-10-16T00:15:00+10:30', JAKARTA)).toEqual({
      date: '2026-10-15',
      time: '20:45',
    });
  });
});

describe('pickup windows between kitchen and device', () => {
  it('stay as they are when the zones match', () => {
    expect(
      convertWindow({ start: '14:00', end: '17:00' }, '2026-10-10', ADELAIDE, ADELAIDE),
    ).toEqual({ start: '14:00', end: '17:00' });
  });

  it('shift by the offset difference on the cooking date, and back', () => {
    // Adelaide 14:00-17:00 on Sat 10 Oct (+10:30) is 10:30-13:30 in Jakarta (+07:00)
    expect(
      convertWindow({ start: '14:00', end: '17:00' }, '2026-10-10', ADELAIDE, JAKARTA),
    ).toEqual({ start: '10:30', end: '13:30' });
    expect(
      convertWindow({ start: '10:30', end: '13:30' }, '2026-10-10', JAKARTA, ADELAIDE),
    ).toEqual({ start: '14:00', end: '17:00' });
  });
});
