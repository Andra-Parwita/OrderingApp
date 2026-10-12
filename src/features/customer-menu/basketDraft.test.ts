import { describe, expect, it, vi } from 'vitest';
import { clearDraft, draftKey, readDraft, writeDraft } from '../../components/draft';
import { basketDraftOf, type BasketDraft } from './basketDraft';
import { checkoutSet, menuRequested, placeRequested, quantitySet } from './customerSlice';
import { createTestStore } from './testSupport';

// Plan 061 stage 9: the basket and checkout fields survive a reload, per kitchen and menu.

async function storeWithMenu() {
  const store = createTestStore();
  store.dispatch(menuRequested('onde-onde'));
  await vi.waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  const state = store.getState().customer;
  const date = state.menu.status === 'ready' ? state.menu.data.week.cookingDate : '';
  return { store, key: draftKey('onde-onde', 'basket', date) };
}

describe('basket draft', () => {
  it('saves the basket and note after 400 ms, and a fresh store restores them', async () => {
    const first = await storeWithMenu();
    first.store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
    first.store.dispatch(checkoutSet({ note: 'no chilli', firstName: 'Rina' }));
    await vi.waitFor(() => expect(readDraft<BasketDraft>(first.key)).not.toBeNull());
    expect(readDraft<BasketDraft>(first.key)?.value.basket).toEqual({ 'tempe-mendoan': 2 });

    const second = await storeWithMenu();
    await vi.waitFor(() =>
      expect(second.store.getState().customer.basket).toEqual({ 'tempe-mendoan': 2 }),
    );
    expect(second.store.getState().customer.checkout).toMatchObject({
      note: 'no chilli',
      firstName: 'Rina',
    });
    clearDraft(first.key);
  });

  it('drops dishes that are not on the menu any more, and says so', async () => {
    const { key } = await storeWithMenu();
    writeDraft(
      key,
      {
        basket: { 'tempe-mendoan': 1, 'gone-dish': 3 },
        names: { 'gone-dish': { en: 'Gone dish', id: 'Hilang' } },
        checkout: { fulfilment: null, pickupPlaceId: 'no-such-place', firstName: '', note: null },
      } satisfies BasketDraft,
      '',
    );
    const { store } = await storeWithMenu();
    await vi.waitFor(() =>
      expect(store.getState().customer.basket).toEqual({ 'tempe-mendoan': 1 }),
    );
    expect(store.getState().customer.notices).toEqual([
      { kind: 'sold_out', itemId: 'gone-dish', name: { en: 'Gone dish', id: 'Hilang' }, qty: 0 },
    ]);
    expect(store.getState().customer.checkout.pickupPlaceId).toBeNull();
    clearDraft(key);
  });

  it('an empty basket stores nothing, and a placed order clears the draft', async () => {
    const { store, key } = await storeWithMenu();
    expect(basketDraftOf(store.getState())).toBeNull();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    await vi.waitFor(() => expect(readDraft(key)).not.toBeNull());
    store.dispatch(
      placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'delivery', note: '' }),
    );
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    await vi.waitFor(() => expect(readDraft(key)).toBeNull());
  });

  it('ignores a draft older than 7 days', async () => {
    const { key } = await storeWithMenu();
    writeDraft(
      key,
      {
        basket: { 'tempe-mendoan': 1 },
        names: {},
        checkout: { fulfilment: null, pickupPlaceId: null, firstName: '', note: null },
      },
      '',
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    );
    const { store } = await storeWithMenu();
    expect(store.getState().customer.basket).toEqual({});
  });
});
