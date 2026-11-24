import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuView } from '../../../../shared/menusContract';
import { AppThemeProvider } from '../../../theme/AppThemeProvider';
import { forgetAutoSavers } from '../autoSave';
import { MakeMenuScreen } from '../MakeMenuScreen';
import { loaded, menuReducer, opDone, opRequested, type MenuData } from '../menuSlice';
import type { MenuSlots } from '../slots';
import { parseStep } from '../steps';
import { useMenuTestSetup } from '../testKit';
import { registerPhoneMenuI18n } from './i18n/register';
import { PhoneMenuCard, PhoneMenuProvider } from './PhoneMenuCard';

// Plan 134 (stage B1): the menu wizard on the phone: entry points on the Orders card, the shell, and
// step 1 Dishes with a quick New dish. The phone is "below 600 px": matchMedia says so here.

vi.mock('../../../api/useSellerLanguages', () => ({ useSellerLanguages: () => 'both' }));
vi.mock('../../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../../api/client', () => ({
  fetchSellerOrders: () => Promise.resolve({ ok: true, data: { orders: [] } }),
  fetchSellerMenu: () => new Promise(() => undefined),
}));
vi.mock('../../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: () => Promise.resolve({ ok: false }),
  sendMenuNotice: vi.fn(),
}));
vi.mock('../../../api/menus', () => ({ publishMenu: vi.fn() }));

const text = (en: string) => ({ en, id: en });
const dish = (id: string, name: string, size = '', priceCents = 1000) => ({
  id,
  name: text(name),
  description: text(''),
  size: text(size),
  priceCents,
});
const LIBRARY = [
  { ...dish('d1', 'Lemper', '4 pcs', 1500), lastUsedAt: '2026-10-17' },
  dish('d2', 'Rendang', '', 2500),
  dish('d3', 'Soto', '', 1800),
];
const base = {
  id: 'm1',
  state: 'not_published',
  cookingDate: '2027-12-18',
  cutoffAt: '2027-12-16T20:00:00+10:30',
  delivery: { available: false, note: text('') },
  placeUses: [],
  wizardStep: 0,
  takingOrders: true,
};
const data = (
  over: Partial<MenuData['view']['menu']> = {},
  dishes: MenuData['view']['dishes'] = [],
) =>
  ({
    view: { menu: { ...base, ...over }, dishes, pickupPoints: [] },
    dishes: LIBRARY,
    sets: [],
    places: [],
    chefs: [],
    prefs: { menuDefaults: { cutoffDaysBefore: 2, cutoffTime: '20:00' } },
    past: [],
  }) as unknown as MenuData;

const slots = {
  preview: () => null,
  share: () => null,
  chefs: () => null,
  newMenu: () => null,
} as unknown as MenuSlots;

type Sent = { kind: string; ref?: string; request?: unknown; addToMenu?: boolean };

function setup(initial: MenuData, entry = '/seller/menu/make/dishes') {
  const sent: Array<Sent> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data: initial, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  const wrap = (ui: React.ReactNode, entries: Array<unknown> = [entry]) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={entries as Array<string>} initialIndex={entries.length - 1}>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  const answer = async (extra: Record<string, unknown> = {}) => {
    const item = sent[sent.length - 1];
    if (!item) throw new Error('no request to answer');
    await act(() => {
      store.dispatch(opDone({ kind: item.kind as 'updateMenu', ref: item.ref, ...extra }));
      return Promise.resolve();
    });
  };
  return { sent, wrap, store, answer };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}
function Wizard() {
  const { step } = useParams();
  return <MakeMenuScreen mode="make" step={parseStep(step) ?? 'dishes'} slots={slots} layered />;
}
const routed = (
  <>
    <Routes>
      <Route path="/seller/menu/make/:step" element={<Wizard />} />
      <Route path="*" element={<p>Orders</p>} />
    </Routes>
    <Where />
  </>
);
const where = () => screen.getByTestId('where').textContent;

const matchPhone = (phone: boolean) => {
  window.matchMedia = (query: string) =>
    ({
      matches: phone && query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
};

beforeEach(() => {
  forgetAutoSavers();
  localStorage.clear();
  matchPhone(true);
  registerPhoneMenuI18n();
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 30));
});

describe('The wizard on the phone', () => {
  useMenuTestSetup();
  it('has a top bar, a four-part step bar and a footer with the On this menu chip and Next', () => {
    const { wrap } = setup(data());
    render(wrap(routed));
    expect(screen.getByRole('dialog', { name: 'Make a menu' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Menu for Sat 18 Dec' })).toBeVisible();
    expect(screen.getByText('Not published · saved')).toBeVisible();
    const steps = within(screen.getByRole('navigation', { name: 'Steps' }));
    expect(steps.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '1Dishes',
      '2Details',
      '3Check',
      '4Publish',
    ]);
    expect(steps.getByRole('button', { name: /Dishes/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'On this menu 0' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Details' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    // One column: New dish first, the source switch, a search, a row per dish.
    expect(screen.getByRole('button', { name: 'New dish' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /Your dishes\s*3/ })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'On this menu: Lemper' })).not.toBeChecked();
    expect(screen.getByText('· 4 pcs')).toBeVisible();
    expect(screen.getByText('$15.00 · Sat 17 Oct')).toBeVisible();
  });

  it('ticks a dish into the chip, lists it in the sheet and removes it from there', async () => {
    const { wrap } = setup(data());
    render(wrap(routed));
    fireEvent.click(screen.getByRole('checkbox', { name: 'On this menu: Lemper' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'On this menu: Soto' }));
    expect(screen.getByRole('button', { name: 'On this menu 2' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'On this menu 2' }));
    const sheet = await screen.findByRole('dialog', { name: /On this menu · 2 dishes/ });
    expect(within(sheet).getByText('Lemper')).toBeVisible();
    expect(within(sheet).getByText('$18.00')).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Save these as a set' })).toBeVisible();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Lemper from this menu' }));
    expect(screen.getByRole('button', { name: 'On this menu 1' })).toBeVisible();
    expect(within(sheet).queryByText('Lemper')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'On this menu: Lemper' })).not.toBeChecked();
  });

  it('+ New dish opens the editor with "Add to this menu too" ticked and adds it to the library and the menu', async () => {
    const { wrap, sent, answer, store } = setup(data());
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'New dish' }));
    expect(where()).toBe('/seller/menu/make/dishes?dish=new');
    const editor = await screen.findByRole('dialog', { name: 'New dish' });
    const add = within(editor).getByRole('checkbox', { name: /Add to this menu too/ });
    expect(add).toBeChecked();
    fireEvent.change(within(editor).getByLabelText('Name (English)'), {
      target: { value: 'Fried tempeh' },
    });
    fireEvent.change(within(editor).getByLabelText('Price (AUD)'), { target: { value: '10' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Add dish' }));
    const create = sent.find((op) => op.kind === 'createDish');
    expect(create).toBeDefined();
    // In the wizard's session the dish goes on the menu as a tick, not behind its back.
    await answer({ dishId: 'd9' });
    const made = dish('d9', 'Fried tempeh', '', 1000);
    await act(() => {
      store.dispatch(loaded({ ...data(), dishes: [...LIBRARY, made] }));
      return Promise.resolve();
    });
    await waitFor(() => expect(where()).toBe('/seller/menu/make/dishes'));
    expect(screen.getByRole('checkbox', { name: 'On this menu: Fried tempeh' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'On this menu 1' })).toBeVisible();
    // The dish has no picture yet: a link goes straight to its editor.
    fireEvent.click(screen.getByRole('button', { name: 'Add a picture' }));
    expect(where()).toBe('/seller/menu/make/dishes?dish=d9');
  });

  it('Next goes to the next step; the Back button and Android Back step back', async () => {
    const { wrap } = setup(data({ wizardStep: 1 }, []));
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Details' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/details'));
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Check' })).toBeVisible();
    // The Back button pops the step it came from (no pile of entries behind it).
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/dishes'));
    // Close pops the wizard's entries and lands on the screen behind it.
    fireEvent.click(screen.getByRole('button', { name: 'Next: Details' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/details'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(where()).toBe('/seller/orders'));
  });

  it('a step in the bar is a tap away once it has been reached', async () => {
    const { wrap } = setup(data({ wizardStep: 2 }, []));
    render(wrap(routed));
    const bar = within(screen.getByRole('navigation', { name: 'Steps' }));
    expect(bar.getByRole('button', { name: /Publish/ })).toBeDisabled();
    fireEvent.click(bar.getByRole('button', { name: /Check/ }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/check'));
  });
});

describe('The tablet wizard is unchanged', () => {
  it('keeps the table layout, the side list and the Steps header', () => {
    matchPhone(false);
    const { wrap } = setup(data());
    render(wrap(routed));
    expect(screen.queryByRole('button', { name: 'On this menu 0' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'On this menu' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Details' })).toBeVisible();
    expect(screen.getByRole('table', { name: 'Your dishes' })).toBeVisible();
  });
});

describe('The Orders card starts and continues a menu', () => {
  const none = (view: MenuView | null, newMenu?: MenuSlots['newMenu']) => {
    const kit = setup(data(), '/seller/orders');
    const reload = vi.fn();
    render(
      kit.wrap(
        <>
          <PhoneMenuProvider view={view} reload={reload} {...(newMenu ? { newMenu } : {})}>
            <PhoneMenuCard />
          </PhoneMenuProvider>
          <Where />
        </>,
      ),
    );
    return kit;
  };
  const viewOf = (over: Partial<MenuData['view']['menu']>, dishes: MenuData['view']['dishes']) =>
    data(over, dishes).view;
  const NOW = new Date('2026-10-26T00:00:00Z');
  void NOW;

  it('no menu open: a card with + New menu opens the New menu dialog; Create menu starts and opens step 1', async () => {
    const dialog: MenuSlots['newMenu'] = ({ onCreate, onClose }) => (
      <div role="dialog" aria-label="New menu dialog">
        <button
          type="button"
          onClick={() =>
            onCreate({
              cookingDate: '2026-12-05',
              cutoffAt: '2026-12-03T20:30:00+10:30',
              source: { kind: 'empty' },
            })
          }
        >
          Create menu
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    );
    const { sent, answer } = none(viewOf({ wizardStep: 0 }, []), dialog);
    expect(screen.getByText('No menu open')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'New menu' }));
    await screen.findByRole('dialog', { name: 'New menu dialog' });
    // Android Back closes the dialog.
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'New menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create menu' }));
    await waitFor(() => expect(sent.some((op) => op.kind === 'updateMenu')).toBe(true));
    expect(sent[0]).toMatchObject({
      kind: 'updateMenu',
      request: { cookingDate: '2026-12-05', cutoffAt: '2026-12-03T20:30:00+10:30' },
    });
    await answer();
    await waitFor(() => expect(where()).toBe('/seller/menu/make/dishes'));
  });

  it('a draft that is not ready says what is missing and Continue opens the first step that needs work', async () => {
    none(viewOf({ wizardStep: 1 }, []), () => null);
    expect(screen.getByText(/Still needed: no dishes/)).toBeVisible();
    expect(screen.queryByText(/Finish on the tablet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/dishes'));
  });

  it('with dishes but no pickup place or delivery, Continue opens Details', async () => {
    const withDish = [
      { ...dish('i1', 'Lemper'), dishId: 'd1', soldOut: false, remaining: null },
    ] as unknown as MenuData['view']['dishes'];
    none(viewOf({ wizardStep: 1 }, withDish), () => null);
    expect(screen.getByText('Still needed: no pickup place or delivery')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/details'));
  });
});
