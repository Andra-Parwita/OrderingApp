import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '../../../theme/AppThemeProvider';
import { forgetAutoSavers } from '../autoSave';
import { MakeMenuScreen } from '../MakeMenuScreen';
import { loaded, menuReducer, opDone, opRequested, type MenuData } from '../menuSlice';
import type { MenuSlots } from '../slots';
import { parseStep, parseTab } from '../steps';
import { useMenuTestSetup } from '../testKit';
import { registerPhoneMenuI18n } from './i18n/register';
import { onWizardClosed } from './wizardNav';

// Plan 134 (stage B2): steps 2 Details, 3 Check and 4 Publish on the phone, the dish editor and the
// place editor as full-screen layers, and editing a live menu (Dishes / Details / Prices & limits).

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
vi.mock('../../../components/shareText/loadShareData', () => ({
  loadShareData: () => Promise.resolve(null),
}));

const text = (en: string) => ({ en, id: en });
const dish = (id: string, name: string, priceCents = 1000) => ({
  id,
  name: text(name),
  description: text(''),
  size: text(''),
  priceCents,
});
const LIBRARY = [dish('d1', 'Lemper', 1500), dish('d2', 'Rendang', 2500)];
const onMenu = () =>
  [
    { ...dish('i1', 'Lemper', 1500), dishId: 'd1', soldOut: false, remaining: null },
    { ...dish('i2', 'Rendang', 2500), dishId: 'd2', soldOut: false, remaining: null },
  ] as unknown as MenuData['view']['dishes'];
const PLACE = {
  id: 'p1',
  place: 'Goodwood Community Center',
  directions: text('Side door'),
  window: { start: '10:00', end: '13:00' },
};
const dataOf = (state: 'not_published' | 'live', wizardStep = 3): MenuData =>
  ({
    view: {
      menu: {
        id: 'm1',
        state,
        cookingDate: '2027-12-18',
        cutoffAt: '2027-12-16T20:00:00+10:30',
        delivery: { available: false, note: text('') },
        placeUses: [{ placeId: 'p1' }],
        wizardStep,
        takingOrders: true,
      },
      dishes: onMenu(),
      pickupPoints: [PLACE],
    },
    dishes: LIBRARY,
    sets: [],
    places: [PLACE],
    chefs: [],
    prefs: { menuDefaults: { cutoffDaysBefore: 2, cutoffTime: '20:00' } },
    past: [],
  }) as unknown as MenuData;

const slots = {
  preview: () => <p>customer preview</p>,
  share: () => <p>tablet share</p>,
  chefs: () => null,
  newMenu: () => null,
} as unknown as MenuSlots;

type Sent = { kind: string; ref?: string; request?: unknown };

function setup(initial: MenuData, path: string) {
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
  const entry = { pathname: path, state: { background: null, depth: 1 } };
  const wrap = (ui: React.ReactNode) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
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
  return { sent, wrap, answer, store };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}
function Make() {
  const { step } = useParams();
  return <MakeMenuScreen mode="make" step={parseStep(step) ?? 'dishes'} slots={slots} layered />;
}
function Edit() {
  const { step } = useParams();
  return <MakeMenuScreen mode="edit" step={parseTab(step) ?? 'dishes'} slots={slots} layered />;
}
const routed = (
  <>
    <Routes>
      <Route path="/seller/menu/make/:step" element={<Make />} />
      <Route path="/seller/menu/edit/:step" element={<Edit />} />
      <Route path="*" element={<p>Orders</p>} />
    </Routes>
    <Where />
  </>
);
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
  forgetAutoSavers();
  localStorage.clear();
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  registerPhoneMenuI18n();
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 30));
});

describe('Step 2 Details on the phone', () => {
  useMenuTestSetup();
  it('has every section of the tablet in one column and Back / Next: Check in the footer', () => {
    const { wrap } = setup(dataOf('not_published'), '/seller/menu/make/details');
    render(wrap(routed));
    expect(
      screen.getByRole('radiogroup', { name: 'How do customers get their food?' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Cooking day')).toBeVisible();
    expect(screen.getByLabelText('Orders close')).toBeVisible();
    expect(screen.getByRole('switch', { name: /Keep the menu open/ })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Goodwood Community Center/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeVisible();
    // The picture: Take photo and Choose photo (a phone), not the tablet's one button.
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Check' })).toBeVisible();
  });

  it('Add a place opens a full-screen layer with its own bar and Cancel / Save place', async () => {
    const { wrap, sent } = setup(dataOf('not_published'), '/seller/menu/make/details');
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const layer = await screen.findByRole('dialog', { name: 'Add a place' });
    expect(within(layer).getByRole('button', { name: 'Save place' })).toBeDisabled();
    fireEvent.change(within(layer).getByLabelText('Place'), { target: { value: 'Mile End' } });
    expect(within(layer).getByRole('button', { name: 'Save place' })).toBeEnabled();
    fireEvent.click(within(layer).getByRole('button', { name: 'Save place' }));
    expect(sent.find((op) => op.kind === 'createPlace')).toBeDefined();
    fireEvent.click(within(layer).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Add a place' })).not.toBeInTheDocument();
  });
});

describe('Step 3 Check on the phone', () => {
  useMenuTestSetup();
  it('shows Worth a look first, then the dishes with prices, then the details; no customer preview', () => {
    const { wrap } = setup(dataOf('not_published'), '/seller/menu/make/check');
    render(wrap(routed));
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
    const worth = headings.findIndex((h) => h === 'Worth a look');
    const dishes = headings.findIndex((h) => h.startsWith('Dishes on this menu'));
    const details = headings.findIndex((h) => h === 'Details');
    expect(worth).toBeGreaterThan(-1);
    expect(worth).toBeLessThan(dishes);
    expect(dishes).toBeLessThan(details);
    expect(screen.queryByText('customer preview')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Publish' })).toBeVisible();
  });

  it('a fix link goes to the right step', async () => {
    const { wrap } = setup(dataOf('not_published'), '/seller/menu/make/check');
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    await waitFor(() => expect(where()).toBe('/seller/menu/make/details'));
  });
});

describe('Step 4 Publish on the phone', () => {
  useMenuTestSetup();
  it('Publish menu asks when orders open, then the notify question, then the phone Share menu', async () => {
    const { wrap, sent, answer } = setup(dataOf('not_published'), '/seller/menu/make/publish');
    render(wrap(routed));
    expect(screen.getByRole('heading', { name: 'Ready to publish' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    const dialog = await screen.findByRole('dialog', { name: /Publish the menu for/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish and open orders' }));
    expect(sent.find((op) => op.kind === 'publish')).toMatchObject({ takingOrders: true });
    await answer();
    // The plan 133 question, as a bottom sheet.
    const ask = await screen.findByRole('dialog', {
      name: 'Send a notification to customers who already have the app?',
    });
    fireEvent.click(within(ask).getByRole('button', { name: 'Not now' }));
    // Then the phone's Share menu (not the tablet's composer).
    await screen.findByRole('dialog', { name: 'Share menu' });
    expect(screen.queryByText('tablet share')).not.toBeInTheDocument();
  });

  it('Android Back on the notify question closes only the question; the live page stays', async () => {
    const { wrap, answer, store } = setup(dataOf('not_published'), '/seller/menu/make/publish');
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    const dialog = await screen.findByRole('dialog', { name: /Publish the menu for/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish and open orders' }));
    await answer();
    const question = 'Send a notification to customers who already have the app?';
    await screen.findByRole('dialog', { name: question });
    // The menu turns live a moment later; the guard is armed from then on.
    act(() => {
      store.dispatch(loaded(dataOf('live')));
    });
    await screen.findByRole('heading', { name: 'Your menu is live' });
    const guarded = () => (window.history.state as { leaveGuard?: boolean } | null)?.leaveGuard;
    await waitFor(() => expect(guarded()).toBe(true));
    const path = where();
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: question })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Your menu is live' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Share menu' })).not.toBeInTheDocument();
    expect(where()).toBe(path);
    // Not now through Back sends nothing; a second Back is the way to Orders (see the guard's own test).
    await waitFor(() => expect(guarded()).toBe(true));
  });

  it('an empty menu publishes after the server warns (the existing warning)', async () => {
    const empty = dataOf('not_published');
    const { wrap, sent } = setup(
      { ...empty, view: { ...empty.view, dishes: [] } },
      '/seller/menu/make/publish',
    );
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    const dialog = await screen.findByRole('dialog', { name: /Publish the menu for/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish and open orders' }));
    expect(sent.some((op) => op.kind === 'publish')).toBe(true);
  });
});

describe('Edit menu on the phone', () => {
  useMenuTestSetup();
  const tabs = () => within(screen.getByRole('navigation', { name: 'Sections' }));

  it('is a full-screen sheet with the Edit mode band, three tabs and the Save footer', () => {
    const { wrap } = setup(dataOf('live'), '/seller/menu/edit/dishes');
    render(wrap(routed));
    expect(screen.getByRole('dialog', { name: 'Edit menu' })).toBeVisible();
    expect(
      screen.getByText('Edit mode — customers see the current menu until you save.'),
    ).toBeVisible();
    expect(
      tabs()
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Dishes', 'Details', 'Prices & limits']);
    expect(screen.getByRole('button', { name: 'New dish' })).toBeVisible();
    expect(screen.getByText('No changes yet')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Prices & limits: a price change counts; Discard puts it back; Save sends it', async () => {
    const { wrap, sent } = setup(dataOf('live'), '/seller/menu/edit/prices');
    render(wrap(routed));
    const price = screen.getByLabelText('Price of Lemper');
    fireEvent.change(price, { target: { value: '16.5' } });
    fireEvent.blur(price);
    await screen.findByText('1 change not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await screen.findByText('No changes yet');
    expect(sent.filter((op) => op.kind === 'updateMenuDish')).toHaveLength(0);
    const again = screen.getByLabelText('Price of Lemper');
    fireEvent.change(again, { target: { value: '17' } });
    fireEvent.blur(again);
    await screen.findByText('1 change not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent.some((op) => op.kind === 'updateMenuDish')).toBe(true));
    expect(sent.find((op) => op.kind === 'updateMenuDish')).toMatchObject({
      request: { priceCents: 1700 },
    });
  });

  it('closing with changes waiting asks first; Keep editing stays', async () => {
    const { wrap } = setup(dataOf('live'), '/seller/menu/edit/prices');
    render(wrap(routed));
    const price = screen.getByLabelText('Price of Lemper');
    fireEvent.change(price, { target: { value: '18' } });
    fireEvent.blur(price);
    await screen.findByText('1 change not saved');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const ask = await screen.findByRole('alertdialog', { name: /Save 1 change\?/ });
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog', { name: /Save 1 change\?/ })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit menu' })).toBeVisible();
  });

  it('Android Back with changes waiting asks instead of leaving', async () => {
    const { wrap } = setup(dataOf('live'), '/seller/menu/edit/prices');
    render(wrap(routed));
    const price = screen.getByLabelText('Price of Lemper');
    fireEvent.change(price, { target: { value: '18' } });
    fireEvent.blur(price);
    await screen.findByText('1 change not saved');
    act(() => window.history.back());
    await screen.findByRole('alertdialog', { name: /Save 1 change\?/ });
    expect(screen.getByRole('dialog', { name: 'Edit menu' })).toBeVisible();
  });

  it('Back with the question open is Keep editing; the next Back asks again, never leaving', async () => {
    const { wrap } = setup(dataOf('live'), '/seller/menu/edit/prices');
    render(wrap(routed));
    const price = screen.getByLabelText('Price of Lemper');
    fireEvent.change(price, { target: { value: '18' } });
    fireEvent.blur(price);
    await screen.findByText('1 change not saved');
    const guarded = () => (window.history.state as { leaveGuard?: boolean } | null)?.leaveGuard;
    await waitFor(() => expect(guarded()).toBe(true));
    const question = () => screen.queryByRole('alertdialog', { name: /Save 1 change\?/ });
    for (let round = 0; round < 3; round += 1) {
      // Back asks; Back again answers "Keep editing". The sentinel is stepped back onto (no new
      // entry), so the next Back is caught too.
      act(() => window.history.back());
      await screen.findByRole('alertdialog', { name: /Save 1 change\?/ });
      await waitFor(() => expect(guarded()).toBe(true));
      act(() => window.history.back());
      await waitFor(() => expect(question()).toBeNull());
      await waitFor(() => expect(guarded()).toBe(true));
      expect(screen.getByText('1 change not saved')).toBeVisible();
    }
    expect(screen.getByRole('dialog', { name: 'Edit menu' })).toBeVisible();
  });

  it('tells the Orders screen when it closes', () => {
    const closed = vi.fn();
    const off = onWizardClosed(closed);
    const { wrap } = setup(dataOf('live'), '/seller/menu/edit/dishes');
    const view = render(wrap(routed));
    view.unmount();
    expect(closed).toHaveBeenCalled();
    off();
  });
});

describe('The dish editor on the phone', () => {
  useMenuTestSetup();
  it('is a full-screen layer with its own bar and Cancel / Add dish pinned', async () => {
    const { wrap } = setup(dataOf('not_published'), '/seller/menu/make/dishes');
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'New dish' }));
    const editor = await screen.findByRole('dialog', { name: 'New dish' });
    expect(within(editor).getByRole('heading', { name: 'New dish' })).toBeVisible();
    expect(within(editor).getByRole('button', { name: 'Close' })).toBeVisible();
    expect(within(editor).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(within(editor).getByRole('button', { name: 'Add dish' })).toBeVisible();
    // The title is in the bar once (the form has no second heading).
    expect(within(editor).getAllByRole('heading', { name: 'New dish' })).toHaveLength(1);
  });

  it('Add dish with no price shows the error once (no hint beside it) and focuses the field', async () => {
    const { wrap } = setup(dataOf('not_published'), '/seller/menu/make/dishes');
    render(wrap(routed));
    fireEvent.click(screen.getByRole('button', { name: 'New dish' }));
    const editor = await screen.findByRole('dialog', { name: 'New dish' });
    fireEvent.change(within(editor).getByLabelText('Name (English)'), {
      target: { value: 'Tempe' },
    });
    expect(within(editor).getByText('For example 10, 10.00 or 10,50')).toBeVisible();
    fireEvent.click(within(editor).getByRole('button', { name: 'Add dish' }));
    expect(await within(editor).findByText('Enter a price like 10, 10.00 or 10,50.')).toBeVisible();
    expect(within(editor).queryByText('For example 10, 10.00 or 10,50')).not.toBeInTheDocument();
    await waitFor(() => expect(within(editor).getByLabelText('Price (AUD)')).toHaveFocus());
  });
});
