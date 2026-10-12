import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckStep } from './CheckStep';
import { DetailsStep } from './DetailsStep';
import { DishesStep } from './DishesStep';
import type { MenuData } from './menuSlice';
import { menuWrapper, useMenuTestSetup } from './testKit';

// Plan 063 stages 1 and 3: Pickup / Delivery / Both on the Details step, and the Check wording.
// Plan 066 stage 3: 50 dishes render in the Dishes step and the Check table.

vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
afterEach(cleanup);

const PLACE = {
  id: 'p1',
  place: 'Glenelg',
  directions: { en: '', id: '' },
  window: { start: '10:00', end: '12:00' },
};
function dataWith(available: boolean, ticked: boolean, dishCount = 0): MenuData {
  const dishes = Array.from({ length: dishCount }, (_, i) => ({
    id: `d${i}`,
    dishId: `l${i}`,
    name: { en: `Dish ${i}`, id: `Hidangan ${i}` },
    description: { en: '', id: '' },
    size: { en: '', id: '' },
    priceCents: 1000,
  }));
  return {
    view: {
      menu: {
        id: 'm1',
        state: 'not_published',
        cookingDate: '2026-10-17',
        cutoffAt: '2026-10-15T20:00:00+10:00',
        delivery: { available, note: { en: 'Note', id: '' } },
        placeUses: ticked ? [{ placeId: 'p1' }] : [],
      },
      dishes,
      pickupPoints: ticked ? [PLACE] : [],
    },
    dishes: dishes.map((d) => ({ ...d, id: d.dishId })),
    sets: [],
    places: [PLACE],
    chefs: [],
    prefs: {},
    past: [],
  } as unknown as MenuData;
}

function mountDetails(data: MenuData) {
  const { sent, wrap } = menuWrapper(data);
  render(wrap(<DetailsStep data={data} lang="en" />));
  return sent;
}
function mountCheck(data: MenuData) {
  const { wrap } = menuWrapper(data);
  render(
    wrap(<CheckStep data={data} lang="en" onGo={() => undefined} renderPreview={() => null} />),
  );
}
const radio = (name: string) => screen.getByRole('radio', { name });

describe('Pickup, Delivery or Both', () => {
  useMenuTestSetup();

  it('Pickup shows the places and no delivery note', () => {
    mountDetails(dataWith(false, true));
    expect(radio('Pickup')).toBeChecked();
    expect(screen.getByText('Pickup locations')).toBeInTheDocument();
    expect(screen.queryByText('Note for customers')).toBeNull();
  });

  it('Delivery shows the note and no places', () => {
    mountDetails(dataWith(true, false));
    expect(radio('Delivery')).toBeChecked();
    expect(screen.getByText('Note for customers')).toBeInTheDocument();
    expect(screen.queryByText('Pickup locations')).toBeNull();
  });

  it('Both shows both', () => {
    mountDetails(dataWith(true, true));
    expect(radio('Both')).toBeChecked();
    expect(screen.getByText('Pickup locations')).toBeInTheDocument();
    expect(screen.getByText('Note for customers')).toBeInTheDocument();
  });

  it('saves the same fields: Pickup turns delivery off, Both turns it on', () => {
    const toPickup = mountDetails(dataWith(true, true));
    fireEvent.click(radio('Pickup'));
    expect(toPickup).toEqual([
      {
        kind: 'updateMenu',
        request: { delivery: { available: false, note: { en: 'Note', id: '' } } },
      },
    ]);
    cleanup();
    const toBoth = mountDetails(dataWith(false, true));
    fireEvent.click(radio('Both'));
    expect(toBoth).toEqual([
      {
        kind: 'updateMenu',
        request: { delivery: { available: true, note: { en: 'Note', id: '' } } },
      },
    ]);
  });

  it('Both with no place ticked yet keeps the places showing', () => {
    mountDetails(dataWith(false, false));
    fireEvent.click(radio('Both'));
    expect(screen.getByText('Pickup locations')).toBeInTheDocument();
  });

  it('Delivery with places ticked asks first; Keep changes nothing, Remove clears the places', () => {
    const sent = mountDetails(dataWith(true, true));
    fireEvent.click(radio('Delivery'));
    expect(screen.getByText('Remove the pickup places from this menu?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep the places' }));
    expect(sent).toEqual([]);
    fireEvent.click(radio('Delivery'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove them' }));
    expect(sent).toEqual([
      {
        kind: 'updateMenu',
        request: { places: [], delivery: { available: true, note: { en: 'Note', id: '' } } },
      },
    ]);
  });

  it('Delivery with no places ticked switches without asking', () => {
    const sent = mountDetails(dataWith(false, false));
    fireEvent.click(radio('Delivery'));
    expect(screen.queryByText('Remove the pickup places from this menu?')).toBeNull();
    expect(sent).toHaveLength(1);
  });
});

describe('Check step wording', () => {
  useMenuTestSetup();
  it.each([
    [false, true, 'Pickup only'],
    [true, false, 'Delivery only'],
    [true, true, 'Pickup or delivery'],
  ])('delivery %s, places %s reads "%s"', (available, ticked, text) => {
    mountCheck(dataWith(available, ticked));
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe('50 dishes (plan 066)', () => {
  useMenuTestSetup();
  it('the Dishes step lists all 50 on the menu', () => {
    const data = dataWith(false, true, 50);
    const { wrap } = menuWrapper(data);
    render(
      wrap(
        <DishesStep
          data={data}
          lang="en"
          live={false}
          onEdit={() => undefined}
          onNewDish={() => undefined}
        />,
      ),
    );
    expect(
      screen.getAllByRole('button', { name: /^Remove Dish \d+ from this menu$/ }),
    ).toHaveLength(50);
    expect(screen.getByText('A menu holds at most 50 dishes.')).toBeInTheDocument();
  });

  it('the Check table has a row for each of the 50', () => {
    mountCheck(dataWith(false, true, 50));
    expect(screen.getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText('50 of 50')).toBeInTheDocument();
  });
});
