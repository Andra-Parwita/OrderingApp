import { describe, expect, it } from 'vitest';
import type { MenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import {
  customerReducer,
  menuFailed,
  menuLoaded,
  menuRequested,
  placeFailed,
  placeRequested,
  placeSucceeded,
  quantitySet,
  type CustomerRootState,
} from './customerSlice';
import {
  selectBasketCount,
  selectBasketLines,
  selectBasketTotalCents,
  selectRemainingById,
} from './selectors';

const none = { en: '', id: '' };

function item(id: string, priceCents: number, remaining: number | null): MenuItemView {
  return {
    id,
    name: { en: id, id },
    description: none,
    size: none,
    priceCents,
    ...(remaining !== null ? { limit: 10 } : {}),
    remaining,
    soldOut: remaining === 0,
  };
}

const menu: MenuResponse = {
  seller: { id: 's1', slug: 'onde-onde', name: 'Kitchen' },
  kitchen: { sellerId: 's1', name: 'Kitchen', tagline: none },
  week: {
    cookingDate: '2026-10-10',
    cutoffAt: '2026-10-09T21:00:00+11:00',
    status: 'published',
    pickupPoints: [],
    delivery: { available: true, note: none },
  },
  items: [item('lemper', 1000, 3), item('tempe', 1000, null), item('empek', 1000, 0)],
  ordering: { open: true },
};

function rootOf(customer: ReturnType<typeof customerReducer>): CustomerRootState {
  return { customer };
}

function loaded() {
  return customerReducer(undefined, menuLoaded(menu));
}

describe('customerReducer', () => {
  it('goes loading, ready, and error for the menu', () => {
    const loading = customerReducer(undefined, menuRequested('onde-onde'));
    expect(loading.menu).toEqual({ status: 'loading' });
    expect(customerReducer(loading, menuLoaded(menu)).menu).toEqual({
      status: 'ready',
      data: menu,
    });
    expect(customerReducer(loading, menuFailed('network')).menu).toEqual({
      status: 'error',
      code: 'network',
    });
  });

  it('keeps showing a loaded menu while it refreshes', () => {
    let state = customerReducer(undefined, menuRequested('onde-onde'));
    state = customerReducer(state, menuLoaded(menu));
    expect(customerReducer(state, menuRequested('onde-onde')).menu.status).toBe('ready');
  });

  it("drops the menu and basket of another seller when a different seller's menu is requested", () => {
    let state = customerReducer(undefined, menuRequested('onde-onde'));
    state = customerReducer(state, menuLoaded(menu));
    state = customerReducer(state, quantitySet({ itemId: 'nasi-campur', qty: 1 }));
    const next = customerReducer(state, menuRequested('dapur-demo'));
    expect(next.slug).toBe('dapur-demo');
    expect(next.menu).toEqual({ status: 'loading' });
    expect(next.basket).toEqual({});
  });

  it('stops the basket at the portions left', () => {
    let state = loaded();
    state = customerReducer(state, quantitySet({ itemId: 'lemper', qty: 99 }));
    expect(state.basket).toEqual({ lemper: 3 });
  });

  it('ignores a sold out or unknown item and removes a line at 0', () => {
    let state = loaded();
    state = customerReducer(state, quantitySet({ itemId: 'empek', qty: 1 }));
    state = customerReducer(state, quantitySet({ itemId: 'nope', qty: 1 }));
    expect(state.basket).toEqual({});
    state = customerReducer(state, quantitySet({ itemId: 'tempe', qty: 2 }));
    state = customerReducer(state, quantitySet({ itemId: 'tempe', qty: 0 }));
    expect(state.basket).toEqual({});
  });

  it('trims the basket when a refreshed menu has less stock', () => {
    let state = loaded();
    state = customerReducer(state, quantitySet({ itemId: 'lemper', qty: 3 }));
    state = customerReducer(state, quantitySet({ itemId: 'tempe', qty: 1 }));
    const lessStock: MenuResponse = {
      ...menu,
      items: [item('lemper', 1000, 1), item('tempe', 1000, 0)],
    };
    state = customerReducer(state, menuLoaded(lessStock));
    expect(state.basket).toEqual({ lemper: 1 });
  });

  it('models the place result as a union', () => {
    const request = {
      firstName: 'Rina',
      language: 'en' as const,
      fulfilment: 'pickup' as const,
      note: '',
    };
    const submitting = customerReducer(undefined, placeRequested(request));
    expect(submitting.place).toEqual({ status: 'submitting' });
    expect(
      customerReducer(submitting, placeFailed({ code: 'sold_out', message: 'x' })).place,
    ).toEqual({ status: 'failed', code: 'sold_out', message: 'x' });
  });

  it('clears the basket and keeps the order once placed', () => {
    let state = loaded();
    state = customerReducer(state, quantitySet({ itemId: 'tempe', qty: 2 }));
    const order = {
      seller: { slug: 'onde-onde', name: 'Onde Onde' },
      id: 'o1',
      code: 'K7F2QX',
      token: 'tok',
      firstName: 'Rina',
      language: 'en' as const,
      lines: [],
      fulfilment: 'pickup' as const,
      status: 'ordered' as const,
      locked: false,
      inbox: [],
      createdAt: '2026-10-07T10:00:00.000Z',
      updatedAt: '2026-10-07T10:00:00.000Z',
    };
    state = customerReducer(state, placeSucceeded(order));
    expect(state.basket).toEqual({});
    expect(state.place).toEqual({ status: 'placed', token: 'tok' });
    expect(state.order).toEqual({ status: 'ready', order });
  });
});

describe('selectors', () => {
  it('computes lines, count and total in menu order', () => {
    let state = loaded();
    state = customerReducer(state, quantitySet({ itemId: 'tempe', qty: 1 }));
    state = customerReducer(state, quantitySet({ itemId: 'lemper', qty: 2 }));
    const root = rootOf(state);
    expect(selectBasketLines(root).map((line) => [line.item.id, line.qty, line.lineCents])).toEqual(
      [
        ['lemper', 2, 2000],
        ['tempe', 1, 1000],
      ],
    );
    expect(selectBasketCount(root)).toBe(3);
    expect(selectBasketTotalCents(root)).toBe(3000);
  });

  it('returns the same reference while nothing relevant changed', () => {
    const state = customerReducer(loaded(), quantitySet({ itemId: 'tempe', qty: 1 }));
    const root = rootOf(state);
    expect(selectBasketLines(root)).toBe(selectBasketLines(rootOf({ ...state })));
    expect(selectRemainingById(root)).toBe(selectRemainingById(rootOf({ ...state })));
  });

  it('gives an empty basket before the menu is ready', () => {
    const root = rootOf(customerReducer(undefined, { type: 'init' }));
    expect(selectBasketLines(root)).toEqual([]);
    expect(selectBasketCount(root)).toBe(0);
  });

  it('reports the remaining portions per item', () => {
    expect(selectRemainingById(rootOf(loaded()))).toEqual({ lemper: 3, tempe: null, empek: 0 });
  });
});
