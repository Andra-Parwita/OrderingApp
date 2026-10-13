import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKey, readDraft } from '../../components/draft';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AUTOSAVE_DELAY_MS, forgetAutoSavers } from './autoSave';
import { DishesStep } from './DishesStep';
import { MakeMenuScreen } from './MakeMenuScreen';
import { menuReducer, opDone, opFailed, opRequested, type MenuData } from './menuSlice';
import { PricesTable } from './PricesTable';
import { useMenuTestSetup } from './testKit';
import type { MenuSlots } from './slots';

// Plan 072: ticks and price edits show at once and are saved in one request after a pause.

vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../api/client', () => ({
  fetchSellerOrders: () => Promise.resolve({ ok: true, data: { orders: [] } }),
}));

const text = (en: string) => ({ en, id: en });
const dish = (id: string, name: string, priceCents = 1000) => ({
  id,
  name: text(name),
  description: text(''),
  size: text(''),
  priceCents,
});
const names = [
  'Lemper',
  'Rendang',
  'Soto',
  'Pisang',
  'Klepon',
  'Onde',
  'Tahu',
  'Tempe',
  'Sate',
  'Gado',
];
const LIBRARY = names.map((name, index) => dish(`d${String(index + 1)}`, name));

const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'not_published',
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-15T20:00:00+10:00',
      delivery: { available: false, note: { en: '', id: '' } },
      placeUses: [],
      wizardStep: 0,
    },
    dishes: [
      { ...dish('i1', 'Lemper', 1500), dishId: 'd1', soldOut: false, remaining: null },
      { ...dish('i2', 'Rendang', 2500), dishId: 'd2', soldOut: false, remaining: null },
    ],
    pickupPoints: [],
  },
  dishes: LIBRARY,
  sets: [],
  places: [],
  chefs: [],
  prefs: {},
  past: [],
} as unknown as MenuData;

beforeEach(() => {
  forgetAutoSavers();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

type Sent = { kind: string; ref?: string; request?: unknown; id?: string };

function setup() {
  const sent: Array<Sent> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  const wrap = (ui: React.ReactNode) => (
    <Provider store={store}>
      <MemoryRouter>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  const answer = async (index: number, ok = true, code = 'network') => {
    const item = sent[index];
    if (!item?.ref) throw new Error('no such request');
    await act(() => {
      store.dispatch(
        ok
          ? opDone({ kind: item.kind as 'updateMenu', ref: item.ref })
          : opFailed({ kind: item.kind as 'updateMenu', ref: item.ref, code, message: code }),
      );
      return Promise.resolve();
    });
  };
  return { sent, wrap, answer };
}

const tick = (name: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const dishesOf = (item: Sent) => (item.request as { dishIds: Array<string> }).dishIds;

describe('Dishes step auto-save', () => {
  useMenuTestSetup();
  it('10 quick ticks make exactly one updateMenu with the final list, boxes never disabled', () => {
    const { sent, wrap } = setup();
    render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    for (const name of names.slice(2)) tick(name);
    tick('Soto');
    tick('Soto');
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeDisabled();
    expect(sent).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: /Gado/ })).toBeChecked();
    wait(AUTOSAVE_DELAY_MS - 50);
    expect(sent).toHaveLength(0);
    wait(100);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.kind).toBe('updateMenu');
    // Soto was ticked, then unticked and ticked again: it is last.
    expect(dishesOf(sent[0] as Sent)).toEqual([
      'd1',
      'd2',
      'd4',
      'd5',
      'd6',
      'd7',
      'd8',
      'd9',
      'd10',
      'd3',
    ]);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('tick then leave the step: the request goes out at once', () => {
    const { sent, wrap } = setup();
    const view = render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    tick('Soto');
    expect(sent).toHaveLength(0);
    view.unmount();
    expect(sent).toHaveLength(1);
    expect(dishesOf(sent[0] as Sent)).toEqual(['d1', 'd2', 'd3']);
  });

  it('a slow first answer does not overwrite newer ticks; the newest state goes next', async () => {
    const { sent, wrap, answer } = setup();
    render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    tick('Soto');
    wait(AUTOSAVE_DELAY_MS);
    expect(sent).toHaveLength(1);
    tick('Pisang'); // while the first is in flight
    await answer(0);
    expect(screen.getByRole('checkbox', { name: /Pisang/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Soto/ })).toBeChecked();
    expect(sent).toHaveLength(1); // single flight: the second waits for its pause
    wait(AUTOSAVE_DELAY_MS);
    expect(sent).toHaveLength(2);
    expect(dishesOf(sent[1] as Sent)).toEqual(['d1', 'd2', 'd3', 'd4']);
    await answer(1);
    expect(screen.getByText('Saved ✓')).toBeInTheDocument();
    expect(readDraft(draftKey('home', 'menu-dishes', 'm1'))).toBeNull();
  });

  it('a failure shows Not saved yet, keeps the state on the device and retries only on Try again', async () => {
    const { sent, wrap, answer } = setup();
    const view = render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    tick('Soto');
    wait(AUTOSAVE_DELAY_MS);
    await answer(0, false, 'network');
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Soto/ })).toBeChecked();
    expect(readDraft<Array<string>>(draftKey('home', 'menu-dishes', 'm1'))?.value).toEqual([
      'd1',
      'd2',
      'd3',
    ]);
    wait(10_000);
    expect(sent).toHaveLength(1); // no automatic retry
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(sent).toHaveLength(2);
    await answer(1, false, 'network');
    view.unmount();
    expect(sent).toHaveLength(2); // leaving does not retry a failure
    // Back later: the kept state is there, marked as not saved yet.
    render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Soto/ })).toBeChecked();
  });

  it('a refusal undoes the ticks and says why', async () => {
    const { sent, wrap, answer } = setup();
    render(
      wrap(<DishesStep data={DATA} lang="en" live={false} onEdit={vi.fn()} onNewDish={vi.fn()} />),
    );
    tick('Soto');
    wait(AUTOSAVE_DELAY_MS);
    await answer(0, false, 'limit_reached');
    expect(screen.getByRole('checkbox', { name: /Soto/ })).not.toBeChecked();
    expect(screen.getByText(/A menu holds at most 50 dishes/)).toBeInTheDocument();
    expect(readDraft(draftKey('home', 'menu-dishes', 'm1'))).toBeNull();
    expect(sent).toHaveLength(1);
  });
});

describe('Prices table auto-save', () => {
  useMenuTestSetup();
  it('a burst of price edits is one batch, one request per changed dish, sent together', () => {
    const { sent, wrap } = setup();
    render(wrap(<PricesTable data={DATA} lang="en" />));
    const price = (name: string, value: string) => {
      const field = screen.getByRole('textbox', { name: `Price of ${name}` });
      fireEvent.change(field, { target: { value } });
      fireEvent.blur(field);
    };
    price('Lemper', '16');
    wait(300);
    price('Rendang', '30');
    price('Lemper', '17');
    expect(sent).toHaveLength(0);
    wait(AUTOSAVE_DELAY_MS + 10);
    expect(sent.map((item) => [item.id, item.request])).toEqual([
      ['i1', { priceCents: 1700 }],
      ['i2', { priceCents: 3000 }],
    ]);
  });
});

describe('Leaving the wizard step', () => {
  useMenuTestSetup();
  const slots = {
    preview: () => null,
    share: () => null,
    chefs: () => null,
    newMenu: () => null,
  } as unknown as MenuSlots;

  it('saves at once on Next, without waiting for the pause', () => {
    const { sent, wrap } = setup();
    render(wrap(<MakeMenuScreen mode="make" step="dishes" slots={slots} layered />));
    tick('Soto');
    fireEvent.click(screen.getByRole('button', { name: /Next: Details/ }));
    // The step was left: its request went out immediately.
    const first = sent.find((item) => item.kind === 'updateMenu');
    expect(first && dishesOf(first)).toEqual(['d1', 'd2', 'd3']);
  });

  it('warns calmly when an earlier save did not get through', async () => {
    const { sent, wrap, answer } = setup();
    render(wrap(<MakeMenuScreen mode="make" step="dishes" slots={slots} layered />));
    tick('Soto');
    wait(AUTOSAVE_DELAY_MS);
    const index = sent.findIndex((item) => item.ref !== undefined);
    await answer(index, false, 'network');
    fireEvent.click(screen.getByRole('button', { name: /Next: Details/ }));
    expect(
      screen.getByText(/Some changes aren't saved yet. They're kept on this device./),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }));
    expect(screen.queryByText(/kept on this device/)).not.toBeInTheDocument();
  });
});
