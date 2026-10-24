import { describe, expect, it } from 'vitest';
import {
  comingSaturday,
  defaultCutoffAt,
  menuFinishesAt,
  formatCookingDate,
  formatCutoff,
  formatDate,
  formatDay,
  formatDayTime,
  formatTime,
  formatWindow,
} from './dates';

describe('date helpers (device zone: Australia/Adelaide)', () => {
  it('formats in English', () => {
    expect(formatCookingDate('2026-10-10', 'en')).toBe('Sat 10 Oct');
    expect(formatCutoff('2026-10-09T21:00:00+10:30', 'en')).toBe('Fri 9 Oct, 9 pm');
    expect(formatWindow('14:00', '17:00', 'en')).toBe('2–5 pm');
    expect(formatWindow('11:30', '14:00', 'en')).toBe('11:30 am–2 pm');
  });

  it('formats in Indonesian', () => {
    expect(formatCookingDate('2026-10-10', 'id')).toBe('Sabtu, 10 Okt');
    expect(formatCutoff('2026-10-09T21:00:00+10:30', 'id')).toBe('Jumat, 9 Okt, 21.00');
    expect(formatWindow('14:00', '17:00', 'id')).toBe('14.00–17.00');
  });

  it('uses the device time for an instant given in UTC, or the zone it is given', () => {
    expect(formatCutoff('2026-10-09T10:30:00Z', 'en')).toBe('Fri 9 Oct, 9 pm');
    expect(formatCutoff('2026-10-09T10:30:00Z', 'en', 'Asia/Jakarta')).toBe('Fri 9 Oct, 5:30 pm');
    expect(formatTime('2026-10-09T10:30:00Z', 'id', 'Asia/Jakarta')).toBe('17.30');
  });

  it('formats a full date with the year in both languages', () => {
    expect(formatDate('2026-10-24T02:00:00Z', 'en')).toBe('24 Oct 2026');
    expect(formatDate('2026-10-24T02:00:00Z', 'id')).toBe('24 Okt 2026');
    expect(formatDate('2026-05-03T02:00:00Z', 'id')).toBe('3 Mei 2026');
    // 2026-10-23T16:00Z is 24 Oct 02:30 in Adelaide (UTC+10:30) but 23 Oct 23:00 in Jakarta.
    expect(formatDate('2026-10-23T16:00:00Z', 'en')).toBe('24 Oct 2026');
    expect(formatDate('2026-10-23T16:00:00Z', 'en', 'Asia/Jakarta')).toBe('23 Oct 2026');
  });

  it('formats the compact seller day and time', () => {
    expect(formatDay('2026-10-10', 'en')).toBe('Sat 10 Oct');
    // 2026-10-08T08:12Z is 18:42 on 8 Oct in Adelaide (UTC+10:30).
    expect(formatDay('2026-10-08T08:12:00Z', 'en')).toBe('Thu 8 Oct');
    expect(formatTime('2026-10-08T08:12:00Z', 'en')).toBe('6:42 pm');
    expect(formatTime('2026-10-08T08:12:00Z', 'id')).toBe('18.42');
    expect(formatDayTime('2026-10-08T08:12:00Z', 'en')).toBe('Thu 8 Oct 6:42 pm');
  });
});

describe('default week for a new seller', () => {
  const adelaide = 'Australia/Adelaide';

  it('picks the coming Saturday, in the kitchen zone', () => {
    // Wed 7 Oct 2026, 20:30 in Adelaide (daylight time, UTC+10:30)
    expect(comingSaturday(new Date('2026-10-07T10:00:00Z'), adelaide)).toBe('2026-10-10');
    // Sun 11 Oct 2026 00:00 in Adelaide is still Sat 10 Oct in UTC: the next one is 17 Oct
    expect(comingSaturday(new Date('2026-10-10T13:30:00Z'), adelaide)).toBe('2026-10-17');
    // Fri 9 Oct
    expect(comingSaturday(new Date('2026-10-09T01:00:00Z'), adelaide)).toBe('2026-10-10');
    // On the Saturday itself the next Saturday
    expect(comingSaturday(new Date('2026-10-10T01:00:00Z'), adelaide)).toBe('2026-10-17');
    // Sun 11 Oct, Adelaide
    expect(comingSaturday(new Date('2026-10-11T01:00:00Z'), adelaide)).toBe('2026-10-17');
    // The same instant is a different day in another zone
    expect(comingSaturday(new Date('2026-10-09T16:00:00Z'), adelaide)).toBe('2026-10-17');
    expect(comingSaturday(new Date('2026-10-09T16:00:00Z'), 'Asia/Jakarta')).toBe('2026-10-10');
  });

  it('cuts off the Friday before at 21:00, with the zone offset of that day', () => {
    expect(defaultCutoffAt('2026-10-10', adelaide)).toBe('2026-10-09T21:00:00+10:30');
    // Daylight saving ends on Sun 5 Apr 2026: the Friday before Sat 11 Apr is on standard time
    expect(defaultCutoffAt('2026-04-11', adelaide)).toBe('2026-04-10T21:00:00+09:30');
    expect(defaultCutoffAt('2026-10-10', 'Asia/Jakarta')).toBe('2026-10-09T21:00:00+07:00');
    expect(formatCutoff(defaultCutoffAt('2026-10-10', adelaide), 'en')).toBe('Fri 9 Oct, 9 pm');
  });

  it('finishes a menu at midnight after its cooking day, in the kitchen zone', () => {
    expect(menuFinishesAt('2026-10-10', adelaide)).toBe('2026-10-11T00:00:00+10:30');
    expect(menuFinishesAt('2026-10-10', 'Asia/Jakarta')).toBe('2026-10-11T00:00:00+07:00');
    // Daylight saving starts on Sun 4 Oct 2026 at 02:00: the midnight after Sat 3 Oct is still +09:30
    expect(menuFinishesAt('2026-10-03', adelaide)).toBe('2026-10-04T00:00:00+09:30');
  });
});

describe('pickup windows', () => {
  it('are the same on screen when the device is in the kitchen zone', () => {
    expect(formatWindow('14:00', '17:00', 'en', '2026-10-10')).toBe('2–5 pm');
  });
});
