import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import { readMyOrders } from '../../api/device/myOrders';
import { setRetryDelays } from '../../api/retryPolicy';
import { clearDraft, draftKey, readDraft, writeDraft } from '../../components/draft';
import { basketDraftOf, clientOrderIdFor, type BasketDraft } from './basketDraft';
import { checkoutSet, menuRequested, noteSet, placeRequested, quantitySet } from './customerSlice';
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

  it('saves line notes and puts them back with the basket', async () => {
    const first = await storeWithMenu();
    first.store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    first.store.dispatch(noteSet({ itemId: 'tempe-mendoan', note: 'extra crispy' }));
    await vi.waitFor(() =>
      expect(readDraft<BasketDraft>(first.key)?.value.notes).toEqual({
        'tempe-mendoan': 'extra crispy',
      }),
    );
    const second = await storeWithMenu();
    await vi.waitFor(() =>
      expect(second.store.getState().customer.basketNotes).toEqual({
        'tempe-mendoan': 'extra crispy',
      }),
    );
    clearDraft(first.key);
  });

  it('drops dishes that are not on the menu any more, and says so', async () => {
    const { key } = await storeWithMenu();
    writeDraft(
      key,
      {
        basket: { 'tempe-mendoan': 1, 'gone-dish': 3 },
        names: { 'gone-dish': { en: 'Gone dish', id: 'Hilang' } },
        checkout: {
          fulfilment: null,
          pickupPlaceId: 'no-such-place',
          firstName: '',
          note: null,
          address: null,
        },
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

  // Plan 114 item 2: the id sent with Place order survives a lost answer and a reload.
  it('keeps the client order id for the same order, makes a new one for a changed order', async () => {
    const { store, key } = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    await vi.waitFor(() => expect(readDraft(key)).not.toBeNull());
    const id = clientOrderIdFor(key, 'order-a');
    expect(clientOrderIdFor(key, 'order-a')).toBe(id);
    expect(readDraft<BasketDraft>(key)?.value.clientOrder).toEqual({
      id,
      signature: 'order-a',
    });
    // Editing the basket keeps the stored id for the same order, a different order gets its own.
    store.dispatch(noteSet({ itemId: 'tempe-mendoan', note: 'crispy' }));
    await vi.waitFor(() => expect(readDraft<BasketDraft>(key)?.value.notes).toBeDefined());
    expect(readDraft<BasketDraft>(key)?.value.clientOrder?.id).toBe(id);
    expect(clientOrderIdFor(key, 'order-b')).not.toBe(id);
    clearDraft(key);
  });

  it('sends the same id again after a lost answer, then clears it when the order succeeds', async () => {
    setRetryDelays([]);
    const ids: Array<unknown> = [];
    let lose = true;
    server.use(
      http.post('*/api/s/:slug/orders', async ({ request }) => {
        ids.push(((await request.clone().json()) as { clientOrderId?: string }).clientOrderId);
        return lose ? HttpResponse.error() : undefined;
      }),
    );
    const { store, key } = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    await vi.waitFor(() => expect(readDraft(key)).not.toBeNull());
    const place = () =>
      store.dispatch(
        placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'delivery', note: '' }),
      );
    const before = readMyOrders().length;
    place();
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('failed'));
    expect(readDraft<BasketDraft>(key)?.value.clientOrder?.id).toBe(ids[0]);
    lose = false;
    place();
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    // The first tap sent twice (the quiet re-send), the second tap once more: one id throughout.
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
    expect(typeof ids[0]).toBe('string');
    await vi.waitFor(() => expect(readDraft(key)).toBeNull());
    // The answer to the repeat is treated like any new placement: basket empty, order kept in My orders.
    expect(store.getState().customer.basket).toEqual({});
    expect(store.getState().customer.order.status).toBe('ready');
    expect(readMyOrders().length).toBeGreaterThan(before);
    setRetryDelays([1000, 3000, 9000]);
  });

  it('forgets the id after a definitive answer (sold out), so the next tap starts fresh', async () => {
    setRetryDelays([]);
    const ids: Array<unknown> = [];
    let refuse = true;
    server.use(
      http.post('*/api/s/:slug/orders', async ({ request }) => {
        ids.push(((await request.clone().json()) as { clientOrderId?: string }).clientOrderId);
        return refuse
          ? HttpResponse.json({ error: 'sold_out', message: 'Sold out' }, { status: 409 })
          : undefined;
      }),
    );
    const { store, key } = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    await vi.waitFor(() => expect(readDraft(key)).not.toBeNull());
    const place = () =>
      store.dispatch(
        placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'delivery', note: '' }),
      );
    place();
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('failed'));
    expect(readDraft<BasketDraft>(key)?.value.clientOrder).toBeUndefined();
    refuse = false;
    place();
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
    setRetryDelays([1000, 3000, 9000]);
  });

  it('keeps the id after a server error (5xx: the order may have been made)', async () => {
    setRetryDelays([]);
    server.use(http.post('*/api/s/:slug/orders', () => new HttpResponse(null, { status: 503 })));
    const { store, key } = await storeWithMenu();
    store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
    await vi.waitFor(() => expect(readDraft(key)).not.toBeNull());
    store.dispatch(
      placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'delivery', note: '' }),
    );
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('failed'));
    expect(readDraft<BasketDraft>(key)?.value.clientOrder?.id).toBeDefined();
    setRetryDelays([1000, 3000, 9000]);
  });
});
