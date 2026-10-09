import { describe, expect, it } from 'vitest';
import type { MenuView } from '../../../shared/menusContract';
import { splitInstant, toInstant } from './instant';
import { matchPastDishes } from './pastMenus';
import { worries } from './worry';

const NOW = new Date('2026-10-12T00:00:00Z');

function view(over: Partial<MenuView['menu']> = {}, dishes: MenuView['dishes'] = []): MenuView {
  return {
    menu: {
      id: 'm1',
      state: 'not_published',
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T21:00:00+11:00',
      delivery: { available: false, note: { en: '', id: '' } },
      wizardStep: 2,
      takingOrders: true,
      placeUses: [],
      ...over,
    },
    dishes,
    pickupPoints: [
      {
        id: 'p1',
        place: 'Clayton',
        directions: { en: '', id: '' },
        window: { start: '10:00', end: '12:00' },
      },
    ],
  };
}

const dish = (id: string, extra: Partial<MenuView['dishes'][number]> = {}) => ({
  id,
  name: { en: id, id: '' },
  description: { en: '', id: '' },
  size: { en: '', id: '' },
  priceCents: 1000,
  remaining: null,
  soldOut: false,
  ...extra,
});

describe('worth a look (D-062)', () => {
  it('lists problems and never has a blocking kind', () => {
    const found = worries(view({}, []), NOW).map((worry) => worry.id);
    expect(found).toEqual(['noDishes', 'noPicture']);
  });

  it('flags free dishes, unassigned dishes, a past cut-off and a delivery without a note', () => {
    const found = worries(
      view(
        {
          pictureRef: '/images/x.jpg',
          cutoffAt: '2026-10-11T21:00:00+11:00',
          delivery: { available: true, note: { en: '', id: '' } },
        },
        [dish('a', { priceCents: 0 }), dish('b', { chefId: 'c1' })],
      ),
      NOW,
    );
    expect(found.map((worry) => worry.id)).toEqual([
      'freeDish',
      'noChef',
      'deliveryNote',
      'cutoffPast',
    ]);
    expect(found.find((worry) => worry.id === 'noChef')?.count).toBe(1);
  });

  it('is quiet for a complete menu', () => {
    expect(
      worries(view({ pictureRef: '/images/x.jpg' }, [dish('a', { chefId: 'c1' })]), NOW),
    ).toEqual([]);
  });
});

describe('instants', () => {
  it('round-trips a Melbourne wall-clock time, with daylight saving', () => {
    expect(toInstant('2026-10-16', '21:00')).toBe('2026-10-16T21:00:00+11:00');
    expect(toInstant('2026-04-10', '21:00')).toBe('2026-04-10T21:00:00+10:00');
    expect(splitInstant('2026-10-16T21:00:00+11:00')).toEqual({
      date: '2026-10-16',
      time: '21:00',
    });
  });
});

describe('use the dishes of a past menu', () => {
  it('matches by name and counts the ones that are no longer in Your dishes', () => {
    const library = [
      {
        id: 'd1',
        name: { en: 'Rendang', id: '' },
        description: { en: '', id: '' },
        size: { en: '', id: '' },
        priceCents: 1800,
      },
    ];
    const items = [{ name: { en: 'rendang ', id: '' } }, { name: { en: 'Soto', id: 'Soto ayam' } }];
    expect(matchPastDishes(items, library)).toEqual({ ids: ['d1'], missing: 1 });
  });
});
