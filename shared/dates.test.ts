import { describe, expect, it } from 'vitest';
import {
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
