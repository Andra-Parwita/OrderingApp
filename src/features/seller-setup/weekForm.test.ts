import { describe, expect, it } from 'vitest';
import type { Week } from '../../../shared/domain';
import { splitInstant, toDraft, toInstant, toRequest, validate } from './weekForm';

const WEEK: Week = {
  cookingDate: '2026-10-10',
  cutoffAt: '2026-10-09T21:00:00+11:00',
  status: 'draft',
  pickupPoints: [
    {
      id: 'p1',
      place: 'Glen Waverley',
      directions: { en: 'Side gate', id: 'Pintu samping' },
      window: { start: '14:00', end: '17:00' },
    },
  ],
  delivery: { available: true, note: { en: 'Nearby', id: 'Dekat' } },
};

describe('Melbourne cut-off', () => {
  it('splits an instant into Melbourne date and time', () => {
    expect(splitInstant('2026-10-09T21:00:00+11:00')).toEqual({
      date: '2026-10-09',
      time: '21:00',
    });
    expect(splitInstant('2026-10-09T10:00:00Z')).toEqual({ date: '2026-10-09', time: '21:00' });
  });

  it('joins date and time with the offset of that day (summer and winter)', () => {
    expect(toInstant('2026-10-09', '21:00')).toBe('2026-10-09T21:00:00+11:00');
    expect(toInstant('2026-07-10', '20:30')).toBe('2026-07-10T20:30:00+10:00');
  });

  it('round-trips', () => {
    const { date, time } = splitInstant(toInstant('2026-10-02', '08:15'));
    expect([date, time]).toEqual(['2026-10-02', '08:15']);
  });
});

describe('week form', () => {
  it('builds a request that keeps the pickup id', () => {
    const request = toRequest(toDraft(WEEK), 'p1');
    expect(request).toEqual({
      cookingDate: '2026-10-10',
      cutoffAt: '2026-10-09T21:00:00+11:00',
      pickupPoints: [
        {
          id: 'p1',
          place: 'Glen Waverley',
          directions: { en: 'Side gate', id: 'Pintu samping' },
          window: { start: '14:00', end: '17:00' },
        },
      ],
      delivery: { available: true, note: { en: 'Nearby', id: 'Dekat' } },
    });
  });

  it('accepts the current week and finds each problem', () => {
    const draft = toDraft(WEEK);
    expect(validate(draft)).toEqual({});
    expect(validate({ ...draft, place: '  ' })).toEqual({ place: 'required' });
    expect(validate({ ...draft, end: '13:00' })).toEqual({ window: 'window' });
    expect(validate({ ...draft, cutoffDate: '2026-10-11' })).toEqual({ cutoffDate: 'cutoffLate' });
    expect(validate({ ...draft, cutoffTime: '' })).toEqual({ cutoffTime: 'required' });
    expect(validate({ ...draft, noteEn: 'x'.repeat(201) })).toEqual({ noteEn: 'tooLong' });
  });
});
