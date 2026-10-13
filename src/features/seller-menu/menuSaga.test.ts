import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { menuReducer, loaded, opRequested, type MenuData } from './menuSlice';
import { menuSaga } from './menuSaga';

// Plan 073: an op uses its own answer; only what the answer cannot carry is read again.

const calls: Array<string> = [];
const NEW_VIEW = { menu: { id: 'm1', state: 'not_published' }, dishes: [], pickupPoints: [] };

vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../api/client', () => ({
  fetchCurrentMenu: () => reply('GET menu', { menu: NEW_VIEW }),
  fetchChefs: () => reply('GET chefs', { chefs: [] }),
  fetchPastWeeks: () => reply('GET past', { weeks: [] }),
  updateItem: () => reply('PATCH item', {}),
}));
vi.mock('../../api/menus', () => ({
  updateCurrentMenu: () =>
    reply('PUT menu', { menu: NEW_VIEW, warnings: { removedWithOrders: [] } }),
  publishMenu: () => reply('POST publish', { menu: NEW_VIEW }),
  createDish: () => reply('POST dish', { dish: { id: 'd9' } }),
  addDishToMenu: () => reply('PUT add', { menu: NEW_VIEW }),
  updateDish: () => reply('PATCH dish', { dish: { id: 'd1', name: 'x' } }),
  createPickupPlace: () => reply('POST place', {}),
  fetchDishes: () => reply('GET dishes', { dishes: [] }),
  fetchSavedSets: () => reply('GET sets', { sets: [] }),
  fetchPickupPlaces: () => reply('GET places', { places: [] }),
  fetchPreferences: () => reply('GET prefs', { preferences: {} }),
}));

function reply(name: string, data: unknown) {
  calls.push(name);
  return Promise.resolve({ ok: true, data });
}

const DATA = {
  view: { menu: { id: 'm0', state: 'not_published' }, dishes: [], pickupPoints: [] },
  dishes: [{ id: 'd1' }],
  sets: [],
  places: [],
  chefs: [],
  prefs: {},
  past: [],
} as unknown as MenuData;

async function run(op: Parameters<typeof opRequested>[0]) {
  const saga = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(saga),
  });
  saga.run(menuSaga);
  store.dispatch(loaded(DATA));
  const seen = new Promise<void>((resolve) => {
    store.subscribe(() => {
      if (store.getState().sellerMenu.result?.status) resolve();
    });
  });
  store.dispatch(opRequested(op));
  await seen;
  return store.getState().sellerMenu;
}

beforeEach(() => {
  calls.length = 0;
});

describe('menu ops (plan 073)', () => {
  it('a tick save is 1 request and no refresh GET: the answer is the new menu', async () => {
    const state = await run({ kind: 'updateMenu', request: { dishIds: ['d1'] }, ref: 'r1' });
    expect(calls).toEqual(['PUT menu']);
    expect(state.data?.view).toEqual(NEW_VIEW);
    expect(state.result).toMatchObject({ status: 'done', kind: 'updateMenu', ref: 'r1' });
  });

  it('publish uses the answer too', async () => {
    await run({ kind: 'publish' });
    expect(calls).toEqual(['POST publish']);
  });

  it('a new dish added to the menu reads only the library again', async () => {
    const state = await run({
      kind: 'createDish',
      request: { name: { en: 'a', id: 'a' }, priceCents: 1 },
      addToMenu: true,
    });
    expect(calls).toEqual(['POST dish', 'PUT add', 'GET dishes']);
    expect(state.data?.view).toEqual(NEW_VIEW);
  });

  it('editing a dish that is not on the menu replaces it from the answer, no GET', async () => {
    const state = await run({
      kind: 'updateDish',
      id: 'd1',
      request: { name: { en: 'x', id: 'x' } },
    });
    expect(calls).toEqual(['PATCH dish']);
    expect(state.data?.dishes).toEqual([{ id: 'd1', name: 'x' }]);
  });

  it('a place answer cannot carry the lists: places and menu are read again (2 GETs)', async () => {
    await run({ kind: 'createPlace', request: {} as never });
    expect([...calls].sort()).toEqual(['GET menu', 'GET places', 'POST place']);
  });
});
