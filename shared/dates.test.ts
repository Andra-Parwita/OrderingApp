import { describe, expect, it } from 'vitest';
import {
  comingSaturday,
  defaultCutoffAt,
  formatCookingDate,
  formatCutoff,
  formatDay,
  formatDayTime,
  formatTime,
  formatWindow,
} from './dates';

describe('date helpers (Australia/Melbourne)', () => {
  it('formats in English', () => {
    expect(formatCookingDate('2026-10-10', 'en')).toBe('Sat 10 Oct');
    expect(formatCutoff('2026-10-09T21:00:00+11:00', 'en')).toBe('Fri 9 Oct, 9 pm');
    expect(formatWindow('14:00', '17:00', 'en')).toBe('2–5 pm');
    expect(formatWindow('11:30', '14:00', 'en')).toBe('11:30 am–2 pm');
  });

  it('formats in Indonesian', () => {
    expect(formatCookingDate('2026-10-10', 'id')).toBe('Sabtu, 10 Okt');
    expect(formatCutoff('2026-10-09T21:00:00+11:00', 'id')).toBe('Jumat, 9 Okt, 21.00');
    expect(formatWindow('14:00', '17:00', 'id')).toBe('14.00–17.00');
  });

  it('uses Melbourne time for an instant given in UTC', () => {
    expect(formatCutoff('2026-10-09T10:00:00Z', 'en')).toBe('Fri 9 Oct, 9 pm');
  });

  it('formats the compact seller day and time', () => {
    expect(formatDay('2026-10-10', 'en')).toBe('Sat 10 Oct');
    // 2026-10-08T08:12Z is 19:12 on 8 Oct in Melbourne (UTC+11).
    expect(formatDay('2026-10-08T08:12:00Z', 'en')).toBe('Thu 8 Oct');
    expect(formatTime('2026-10-08T08:12:00Z', 'en')).toBe('7:12 pm');
    expect(formatTime('2026-10-08T08:12:00Z', 'id')).toBe('19.12');
    expect(formatDayTime('2026-10-08T08:12:00Z', 'en')).toBe('Thu 8 Oct 7:12 pm');
  });
});

describe('default week for a new seller', () => {
  it('picks the coming Saturday, in Melbourne time', () => {
    // Wed 7 Oct 2026, 21:00 in Melbourne (daylight time, UTC+11)
    expect(comingSaturday(new Date('2026-10-07T10:00:00Z'))).toBe('2026-10-10');
    // Sun 11 Oct 2026 00:30 in Melbourne is still Sat 10 Oct in UTC: the next one is 17 Oct
    expect(comingSaturday(new Date('2026-10-10T13:30:00Z'))).toBe('2026-10-17');
    // Fri 9 Oct
    expect(comingSaturday(new Date('2026-10-09T01:00:00Z'))).toBe('2026-10-10');
    // On the Saturday itself the next Saturday
    expect(comingSaturday(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-17');
    // Sun 11 Oct, Melbourne
    expect(comingSaturday(new Date('2026-10-11T01:00:00Z'))).toBe('2026-10-17');
  });

  it('cuts off the Friday before at 21:00, with the zone offset of that day', () => {
    expect(defaultCutoffAt('2026-10-10')).toBe('2026-10-09T21:00:00+11:00');
    // Daylight saving ends on Sun 5 Apr 2026: the Friday before Sat 11 Apr is on standard time
    expect(defaultCutoffAt('2026-04-11')).toBe('2026-04-10T21:00:00+10:00');
    expect(formatCutoff(defaultCutoffAt('2026-10-10'), 'en')).toBe('Fri 9 Oct, 9 pm');
  });
});
