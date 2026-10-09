import { describe, expect, it } from 'vitest';
import { comingSaturday, defaultCutoffAt } from '../../shared/dates';
import { blankFixture, fixtureSellers } from './sampleData';

describe('sample kitchens', () => {
  it('cook the coming Saturday after a late `now`, cut-off still ahead', () => {
    const now = new Date('2026-11-20T10:00:00.000Z'); // Fri 20 Nov, Melbourne
    for (const fixture of fixtureSellers(now)) {
      expect(fixture.week.cookingDate).toBe('2026-11-21');
      expect(fixture.week.cutoffAt).toBe(defaultCutoffAt('2026-11-21'));
      expect(Date.parse(fixture.week.cutoffAt)).toBeGreaterThan(now.getTime());
    }
  });

  it('keep the original week for the fixed test clock (Wed 7 Oct 2026)', () => {
    const [onde] = fixtureSellers(new Date('2026-10-07T10:00:00.000Z'));
    expect(onde?.week.cookingDate).toBe('2026-10-10');
    expect(onde?.week.cutoffAt).toBe('2026-10-09T21:00:00+11:00');
  });

  it('give a new seller the same coming week', () => {
    const now = new Date('2026-11-20T10:00:00.000Z');
    const fixture = blankFixture({ id: 's', slug: 's', name: 'S' }, now.toISOString());
    expect(fixture.week.cookingDate).toBe(comingSaturday(now));
  });
});
