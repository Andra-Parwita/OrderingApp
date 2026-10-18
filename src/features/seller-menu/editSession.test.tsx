import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { forgetAutoSavers } from './autoSave';
import { MakeMenuScreen } from './MakeMenuScreen';
import { MenuScreen } from './MenuScreen';
import { menuReducer, opDone, opFailed, opRequested, type MenuData } from './menuSlice';
import type { MenuSlots } from './slots';
import { useMenuTestSetup } from './testKit';

// Plan 103 fix 8: a live menu is edited in a session. Changes stay on this device; Save sends them.

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
const LIBRARY = ['Lemper', 'Rendang', 'Soto'].map((name, index) =>
  dish(`d${String(index + 1)}`, name),
);
const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'live',
      cookingDate: '2026-10-24',
      cutoffAt: '2026-10-22T20:00:00+10:00',
      delivery: { available: false, note: text('') },
      placeUses: [],
      wizardStep: 3,
      takingOrders: true,
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

const slots = {
  preview: () => null,
  share: () => null,
  chefs: () => null,
  newMenu: () => null,
} as unknown as MenuSlots;

type Sent = { kind: string; ref?: string; request?: unknown; id?: string };

function setup(data: MenuData = DATA) {
  const sent: Array<Sent> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  const wrap = (ui: React.ReactNode, entry = '/') => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  const answerLast = async () => {
    const item = sent[sent.length - 1];
    if (!item?.ref) throw new Error('no request to answer');
    await act(() => {
      store.dispatch(opDone({ kind: item.kind as 'updateMenu', ref: item.ref }));
      return Promise.resolve();
    });
  };
  const failLast = async () => {
    const item = sent[sent.length - 1];
    if (!item?.ref) throw new Error('no request to answer');
    await act(() => {
      store.dispatch(
        opFailed({ kind: item.kind as 'updateMenu', ref: item.ref, code: 'network', message: 'x' }),
      );
      return Promise.resolve();
    });
  };
  return { sent, wrap, answerLast, failLast };
}

function Routed() {
  const { step } = useParams();
  return (
    <MakeMenuScreen
      mode="edit"
      step={step === 'prices' ? 'prices' : 'dishes'}
      slots={slots}
      layered
    />
  );
}
const routed = (
  <Routes>
    <Route path="/seller/menu/edit/:step" element={<Routed />} />
  </Routes>
);
const sheet = (step: 'dishes' | 'prices' = 'dishes') => (
  <MakeMenuScreen mode="edit" step={step} slots={slots} layered />
);
const tick = (name: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));

beforeEach(() => {
  forgetAutoSavers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('The live Menu screen', () => {
  useMenuTestSetup();
  it('has no pencil on a row, one Edit menu button and the Sell link', () => {
    const { wrap } = setup();
    render(wrap(<MenuScreen slots={slots} />));
    expect(screen.queryByRole('button', { name: /^Edit Lemper/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add dish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit menu' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Sold out: Lemper/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sell at the stall/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'On the day' })).not.toBeInTheDocument(); // no slot: a phone
  });

  const withDay = { ...slots, onTheDay: () => <p>Sell screen here</p> } as unknown as MenuSlots;
  it('shows Pre-orders | On the day tabs; the On the day tab holds the Sell screen', () => {
    const { wrap } = setup();
    render(wrap(<MenuScreen slots={withDay} />));
    expect(screen.getByRole('radio', { name: 'Pre-orders' })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Sold out: Lemper/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'On the day' }));
    expect(screen.getByText('Sell screen here')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Sold out: Lemper/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Pre-orders' }));
    expect(screen.getByRole('switch', { name: /Sold out: Lemper/ })).toBeInTheDocument();
  });

  it('opens on the On the day tab on the menu cooking day', () => {
    const today = {
      ...DATA,
      view: { ...DATA.view, menu: { ...DATA.view.menu, cookingDate: '2020-01-01' } },
    };
    const { wrap } = setup(today);
    render(wrap(<MenuScreen slots={withDay} />));
    expect(screen.getByRole('radio', { name: 'On the day' })).toBeChecked();
    expect(screen.getByText('Sell screen here')).toBeInTheDocument();
  });
});

describe('The edit session of a live menu', () => {
  useMenuTestSetup();

  it('keeps ticks on the device, counts them and sends them only on Save', async () => {
    const { sent, wrap, answerLast } = setup();
    render(wrap(sheet()));
    expect(screen.getByText('Editing menu · Sat 24 Oct')).toBeInTheDocument();
    expect(screen.getByText(/customers see the current menu until you save/)).toBeInTheDocument();
    tick('Soto');
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(sent).toHaveLength(0);
    expect(screen.getByText('1 change not saved')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: 'updateMenu',
      request: { dishIds: ['d1', 'd2', 'd3'] },
    });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await answerLast();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('sends a price change as one dish update on Save', async () => {
    const { sent, wrap, answerLast } = setup();
    render(wrap(sheet('prices')));
    const price = screen.getByLabelText('Price of Lemper');
    fireEvent.change(price, { target: { value: '17' } });
    fireEvent.blur(price);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(sent).toHaveLength(0);
    expect(screen.getByText('1 change not saved')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(() => Promise.resolve());
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: 'updateMenuDish',
      id: 'i1',
      request: { priceCents: 1700 },
    });
    await answerLast();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('maps Sell as to preorder and dayStock and sends them only on Save', async () => {
    const { sent, wrap, answerLast } = setup();
    render(wrap(sheet('prices')));
    const group = screen.getByRole('radiogroup', { name: 'Sell as: Lemper' });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('radio', { name: 'On the day' })[0]!);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(sent).toHaveLength(0);
    const portions = screen.getByLabelText('Portions for the day: Lemper');
    fireEvent.change(portions, { target: { value: '6' } });
    fireEvent.blur(portions);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(sent).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(() => Promise.resolve());
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: 'updateMenuDish',
      id: 'i1',
      request: { preorder: false, dayStock: 6 },
    });
    await answerLast();
  });

  it('Sell as Both keeps pre-order on and offers 10 portions', async () => {
    const { sent, wrap } = setup();
    render(wrap(sheet('prices')));
    fireEvent.click(screen.getAllByRole('radio', { name: 'Both' })[0]!);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(() => Promise.resolve());
    expect(sent[0]).toMatchObject({ request: { preorder: true, dayStock: 10 } });
  });

  it('counts a tick, an untick and a price together, also after a change of tab', async () => {
    const { sent, wrap } = setup();
    render(wrap(routed, '/seller/menu/edit/dishes'));
    tick('Soto');
    tick('Lemper');
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText('2 changes not saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prices & limits' }));
    const price = screen.getByLabelText('Price of Rendang');
    fireEvent.change(price, { target: { value: '30' } });
    fireEvent.blur(price);
    fireEvent.click(screen.getByRole('button', { name: 'Dishes' }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText('3 changes not saved')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it('Discard drops the changes and sends nothing', async () => {
    const { sent, wrap } = setup();
    render(wrap(sheet()));
    tick('Soto');
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('No changes yet')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Soto/ })).not.toBeChecked();
    expect(sent).toHaveLength(0);
  });

  it('asks "Save 1 change?" on close; Keep editing stays, Don\'t save sends nothing', async () => {
    const { sent, wrap } = setup();
    render(wrap(sheet()));
    tick('Soto');
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('alertdialog', { name: 'Save 1 change?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('1 change not saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: "Don't save" }));
    expect(sent).toHaveLength(0);
  });

  it('keeps the changes and says so when Save does not get through', async () => {
    const { sent, wrap, failLast } = setup();
    render(wrap(sheet()));
    tick('Soto');
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await failLast();
    expect(sent).toHaveLength(1);
    expect(screen.getByText('Not saved — try again')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Soto/ })).toBeChecked();
  });
});
