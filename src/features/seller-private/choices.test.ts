import { describe, expect, it } from 'vitest';
import type { Dish } from '../../../shared/menusContract';
import { pickableDishes } from './model';

// Plan 111: a private order picks a choice as "Dish · Choice" and never the dish that has them.

const text = (en: string, id = en) => ({ en, id });
const dish = (id: string, extra: Partial<Dish> = {}): Dish => ({
  id,
  name: text(id),
  description: text(''),
  size: text('pack'),
  priceCents: 600,
  ...extra,
});

describe('pickableDishes', () => {
  it('replaces a dish with choices by its choices at the same price', () => {
    const snacks = dish('Snacks', {
      name: text('Snacks', 'Aneka'),
      choices: [
        { id: 'c1', name: text('Cheese', 'Keju'), limit: null },
        { id: 'c2', name: text('Sweet', ''), limit: 5 },
      ],
    });
    const picks = pickableDishes([dish('Soto'), snacks]);
    expect(picks.map((p) => p.id)).toEqual(['Soto', 'c1', 'c2']);
    expect(picks[1]).toMatchObject({ name: { en: 'Snacks · Cheese', id: 'Aneka · Keju' } });
    expect(picks[2]?.name).toEqual({ en: 'Snacks · Sweet', id: 'Aneka · Sweet' });
    expect(picks[1]?.priceCents).toBe(600);
    expect(picks[1]).not.toHaveProperty('choices');
  });
});
