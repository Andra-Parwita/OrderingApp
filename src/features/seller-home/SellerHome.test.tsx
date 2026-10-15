import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../../shared/domain';
import type { Menu, MenuDishView, MenuView } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { SellerHome, type SellerHomeProps } from './SellerHome';
import type { HomeData } from './types';

const api = vi.hoisted(() => ({
  saveSettings: vi.fn(),
}));
vi.mock('../../api/client', () => ({
  fetchImages: () =>
    Promise.resolve({ ok: true, data: { images: { desktopBanner: '/banner.jpg' } } }),
  fetchSettings: () =>
    Promise.resolve({
      ok: true,
      data: {
        sellerId: 's1',
        settings: {
          whatsappNumber: '',
          postGreeting: { en: 'hi', id: 'hai' },
          postClosing: { en: 'bye', id: 'dadah' },
          orderingOpen: true,
        },
      },
    }),
  saveSettings: api.saveSettings,
  fetchPastWeek: () => Promise.resolve({ ok: false, error: 'not_found', message: '' }),
}));

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  localStorage.clear();
  api.saveSettings.mockReset();
});

// Wed 14 Oct 2026, noon-ish in Adelaide: the coming Saturday is the 17th.
const NOW = new Date('2026-10-14T01:00:00Z');
const DAY = 86_400_000;

function menu(over: Partial<Menu> = {}): Menu {
  return {
    id: 'm1',
    state: 'not_published',
    cookingDate: '2026-10-17',
    cutoffAt: '2026-10-15T20:00:00+10:30',
    delivery: { available: false, note: { en: '', id: '' } },
    wizardStep: 0,
    takingOrders: true,
    placeUses: [],
    ...over,
  };
}
function dishes(count: number): Array<MenuDishView> {
  return Array.from({ length: count }, (_, i) => ({ id: `d${i}` }) as MenuDishView);
}
function view(over: Partial<Menu> = {}, count = 0): MenuView {
  return { menu: menu(over), dishes: dishes(count), pickupPoints: [] };
}
function week(id: string, cookingDate: string, orders: number, unpaidCents = 0): PastWeekSummary {
  return {
    id,
    cookingDate,
    closedAt: `${cookingDate}T13:00:00Z`,
    hasOrders: false,
    totals: {
      orders,
      cancelled: 1,
      incomeCents: orders * 5000,
      paidCents: orders * 5000 - unpaidCents,
      unpaidCents,
      items: [
        { itemId: 'i1', name: { en: 'Rendang', id: 'Rendang' }, qty: 38 },
        { itemId: 'i2', name: { en: 'Onde onde', id: 'Onde onde' }, qty: 126 },
      ],
    },
  };
}
const PAST = [
  week('w4', '2026-10-10', 24, 2900),
  week('w3', '2026-10-03', 31),
  week('w2', '2026-08-29', 18),
  week('w1', '2026-08-22', 27),
];
const DEFAULTS = {
  cutoffDaysBefore: 1,
  cutoffTime: '20:00',
  delivery: { available: false, note: { en: '', id: '' } },
};
const SETS = [{ id: 'set1', name: 'Weekend favourites', dishIds: ['a', 'b', 'c'], timesUsed: 2 }];

function data(over: Partial<HomeData> = {}): HomeData {
  return { view: view(), past: [], sets: [], defaults: DEFAULTS, ...over };
}

function renderHome(props: Partial<SellerHomeProps> & { data: HomeData }) {
  const onStartMenu = vi.fn();
  const onContinue = vi.fn();
  const onGo = vi.fn();
  render(
    <AppThemeProvider>
      <SellerHome
        lang="en"
        now={NOW}
        onStartMenu={onStartMenu}
        onContinue={onContinue}
        onGo={onGo}
        {...props}
      />
    </AppThemeProvider>,
  );
  return { onStartMenu, onContinue, onGo };
}

describe('Home, first time (state 1)', () => {
  it('shows "Nothing on yet", the checklist and how it works', async () => {
    renderHome({ data: data() });
    expect(screen.getByRole('heading', { level: 1, name: 'Nothing on yet' })).toBeInTheDocument();
    expect(screen.getByText('Your WhatsApp number')).toBeInTheDocument();
    expect(screen.getByText('Make your first menu', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/^3\. You cook from Kitchen/)).toBeInTheDocument();
    // The pictures step ticks once the kitchen has a picture.
    expect(
      await screen.findByText(/Banner, small icon and menu picture · done/),
    ).toBeInTheDocument();
  });

  it('saves the WhatsApp number from a dialog and ticks the checklist item', async () => {
    api.saveSettings.mockImplementation((settings: { whatsappNumber: string }) =>
      Promise.resolve({ ok: true, data: { sellerId: 's1', settings } }),
    );
    renderHome({ data: data() });
    const opener = screen.getByRole('button', { name: 'Set up' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Your WhatsApp number' });
    const field = within(dialog).getByLabelText('Number customers send their order number to');
    await waitFor(() => expect(field).not.toBeDisabled());
    fireEvent.change(field, { target: { value: '+61 412 345 678' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Only the number changes; the other settings are sent back as they were.
    expect(api.saveSettings.mock.calls[0]?.[0]).toEqual({
      whatsappNumber: '+61 412 345 678',
      postGreeting: { en: 'hi', id: 'hai' },
      postClosing: { en: 'bye', id: 'dadah' },
      orderingOpen: true,
    });
    expect(screen.getByText('Customers send their order number here · done')).toBeInTheDocument();
  });

  it('closes a dialog on Escape and on the close button, and returns focus to the opener', () => {
    renderHome({ data: data() });
    const opener = screen.getByRole('button', { name: 'Set up' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('offers only an empty menu, and creating it moves Home to state 2 in place', () => {
    const { onStartMenu, onContinue } = renderHome({ data: data() });
    fireEvent.click(screen.getByRole('button', { name: 'Make your first menu' }));
    const dialog = screen.getByRole('dialog', { name: 'New menu' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(1);
    expect(within(dialog).getByRole('radio', { name: /Empty menu/ })).toBeChecked();
    // The defaults come from Settings: the day before at 20:00.
    expect(within(dialog).getByLabelText('Cooking day')).toHaveValue('2026-10-17');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-16');
    expect(within(dialog).getByLabelText('Time')).toHaveValue('20:00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create menu' }));
    expect(onStartMenu).toHaveBeenCalledWith({
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T20:00:00+10:30',
      source: { kind: 'empty' },
    });
    // No navigation: the same screen is now "Not published".
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Not published')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Menu for Sat 17 Oct' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue making it' }));
    expect(onContinue).toHaveBeenCalledWith(0);
  });

  it('keeps Orders close following the cooking day until it is edited', () => {
    renderHome({ data: data() });
    fireEvent.click(screen.getByRole('button', { name: 'Make your first menu' }));
    const dialog = screen.getByRole('dialog', { name: 'New menu' });
    fireEvent.change(within(dialog).getByLabelText('Cooking day'), {
      target: { value: '2026-10-24' },
    });
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-23');
    fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: '18:30' } });
    fireEvent.change(within(dialog).getByLabelText('Cooking day'), {
      target: { value: '2026-10-31' },
    });
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-23');
    expect(within(dialog).getByLabelText('Time')).toHaveValue('18:30');
  });
});

describe('Home, menu not published (state 2)', () => {
  it('shows the making steps with the one the seller stopped at, and continues there', () => {
    const { onContinue } = renderHome({
      data: data({ view: view({ wizardStep: 1 }, 6), past: PAST }),
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Menu for Sat 17 Oct' }),
    ).toBeInTheDocument();
    // In the header and in the Dishes step.
    expect(screen.getAllByText('6 dishes')).toHaveLength(2);
    const steps = within(screen.getByRole('region', { name: 'Making the menu' })).getAllByRole(
      'listitem',
    );
    expect(steps.map((step) => step.textContent)).toEqual([
      'Dishes6 dishes',
      'DetailsYou stopped here',
      'Check',
      'Publish & share',
    ]);
    // The phase strip marks the first phase as the current one.
    expect(screen.getByText('Make the menu').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Until Thu 15 Oct')).toBeInTheDocument();
    expect(screen.getByText("Customers can't order yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue making it' }));
    expect(onContinue).toHaveBeenCalledWith(1);
  });

  it('links each making step to the matching tab of the Menu screen (plan 053)', () => {
    const { onGo } = renderHome({ data: data({ view: view({ wizardStep: 1 }, 6), past: PAST }) });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGo).toHaveBeenCalledWith('menu', 'step=check');
  });
});

describe('Home, no menu running (states 5 and 6)', () => {
  const finished = (daysAgo: number) =>
    view(
      {
        state: 'finished',
        cookingDate: '2026-10-10',
        publishedAt: '2026-10-01T00:00:00Z',
        finishedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      },
      6,
    );

  it('highlights the last menu with the accent, and lists three earlier menus', () => {
    const { onGo } = renderHome({ data: data({ view: finished(1), past: PAST, sets: SETS }) });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Nothing on right now' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your last menu finished yesterday\./)).toBeInTheDocument();
    expect(screen.getByText('Finished yesterday')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'Menu for Sat 10 Oct' });
    expect(within(card).getByText('24')).toBeInTheDocument();
    expect(within(card).getByText('$29.00')).toBeInTheDocument();
    expect(within(card).getByText('Onde onde')).toBeInTheDocument();
    // Earlier menus: the three before the last one, never the last one itself.
    const earlier = screen.getByRole('region', { name: 'Earlier menus' });
    const rows = within(earlier).getAllByRole('button', { name: /\d+ orders/ });
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      'Sat 3 Oct',
      'Sat 29 Aug',
      'Sat 22 Aug',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Menu · all 4 menus' }));
    expect(onGo).toHaveBeenCalledWith('menu');
    fireEvent.click(screen.getByRole('button', { name: 'Go to its orders' }));
    expect(onGo).toHaveBeenCalledWith('orders');
  });

  it('turns muted and says weeks once the menu is older than two days', () => {
    renderHome({ data: data({ view: finished(14), past: PAST }) });
    expect(screen.getByText('Finished 2 weeks ago')).toBeInTheDocument();
    expect(screen.getByText(/Your last menu finished 2 weeks ago\./)).toBeInTheDocument();
  });

  it("creates a new menu with the last menu's dishes from the New menu dialog", () => {
    const { onStartMenu } = renderHome({
      data: data({ view: finished(1), past: PAST, sets: SETS }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'New menu' }));
    const dialog = screen.getByRole('dialog', { name: 'New menu' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog).getByRole('radio', { name: /Dishes from Sat 10 Oct/ })).toBeChecked();
    expect(
      within(dialog).getByRole('radio', { name: /Weekend favourites · 3 dishes/ }),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create menu' }));
    expect(onStartMenu).toHaveBeenCalledWith(
      expect.objectContaining({ source: { kind: 'past', weekId: 'w4' } }),
    );
  });

  it('starts from a saved set when that is chosen', () => {
    const { onStartMenu } = renderHome({
      data: data({ view: finished(1), past: PAST, sets: SETS }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'New menu' }));
    const dialog = screen.getByRole('dialog', { name: 'New menu' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /A saved set/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create menu' }));
    expect(onStartMenu).toHaveBeenCalledWith(
      expect.objectContaining({ source: { kind: 'set', setId: 'set1' } }),
    );
  });

  it('opens an earlier menu in a side panel, and its button opens New menu with those dishes', () => {
    const { onGo } = renderHome({ data: data({ view: finished(1), past: PAST }) });
    const row = within(screen.getByRole('region', { name: 'Earlier menus' })).getAllByRole(
      'button',
      {
        name: /\d+ orders/,
      },
    )[1] as HTMLElement;
    row.focus();
    fireEvent.click(row);
    const panel = screen.getByRole('dialog', { name: 'Past menu' });
    expect(within(panel).getByRole('heading', { name: 'Sat 29 Aug' })).toBeInTheDocument();
    expect(within(panel).getByText('Dishes sold')).toBeInTheDocument();
    expect(within(panel).getByText('126')).toBeInTheDocument();

    // Esc closes it and focus goes back to the row.
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(row).toHaveFocus();

    fireEvent.click(row);
    const again = screen.getByRole('dialog', { name: 'Past menu' });
    fireEvent.click(within(again).getByRole('button', { name: 'Go to its orders' }));
    expect(onGo).toHaveBeenCalledWith('orders');
    fireEvent.click(within(again).getByRole('button', { name: 'New menu with these dishes' }));
    expect(screen.queryByRole('dialog', { name: 'Past menu' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'New menu' });
    expect(within(dialog).getByRole('radio', { name: /Dishes from Sat 29 Aug/ })).toBeChecked();
  });
});

function dish(id: string, name: string, limit?: number, soldOut = false): MenuDishView {
  return {
    id,
    name: { en: name, id: name },
    ...(limit === undefined ? {} : { limit }),
    soldOut,
  } as MenuDishView;
}
function order(over: Partial<Order> & { qty?: number; itemId?: string } = {}): Order {
  const { qty = 1, itemId = 'rendang', ...rest } = over;
  return {
    id: `o${Math.random()}`,
    code: 'AAA111',
    firstName: 'Tom',
    status: 'ordered',
    paid: false,
    changed: false,
    fulfilment: 'pickup',
    pickupPlaceId: 'glenelg',
    lines: [
      { itemId, name: { en: 'x', id: 'x' }, size: { en: '', id: '' }, priceCents: 1000, qty },
    ],
    ...rest,
  } as Order;
}
const PLACES = [
  {
    id: 'glenelg',
    place: 'Glenelg',
    directions: { en: '', id: '' },
    window: { start: '10:00', end: '12:00' },
  },
  {
    id: 'clayton',
    place: 'Clayton',
    directions: { en: '', id: '' },
    window: { start: '11:00', end: '13:00' },
  },
];
function liveView(over: Partial<Menu> = {}): MenuView {
  return {
    menu: menu({
      state: 'live',
      wizardStep: 3,
      delivery: { available: true, note: { en: '', id: '' } },
      ...over,
    }),
    dishes: [
      dish('rendang', 'Rendang', 10),
      dish('urab', 'Sayur urab'),
      dish('lapis', 'Kue lapis', 4, true),
    ],
    pickupPoints: PLACES,
  };
}
// 3 orders ($100, $10 paid), 1 cancelled; 1 to confirm, 1 changed; 2 not paid ($90).
const ORDERS: Array<Order> = [
  order({ qty: 8 }),
  order({ paid: true, status: 'confirmed', changed: true }),
  order({ fulfilment: 'delivery', itemId: 'urab', status: 'delivered', packed: true }),
  order({ status: 'cancelled' }),
];
const FRIDAY = new Date('2026-10-16T01:00:00Z');
const SATURDAY = new Date('2026-10-17T00:00:00Z'); // 10:30 in Adelaide

describe('Home, taking orders (state 3)', () => {
  it('shows the numbers, the dish stock and the orders per place', () => {
    renderHome({ data: data({ view: liveView(), past: PAST, orders: ORDERS }) });
    expect(screen.getByText('Taking orders', { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Menu for Sat 17 Oct' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Orders close Thu 15 Oct, 8 pm · 1 d 8 h left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Orders · 1 to confirm' })).toBeInTheDocument();
    expect(screen.getByText('orders · 1 cancelled')).toBeInTheDocument();
    expect(screen.getByText('total · $10.00 paid')).toBeInTheDocument();
    // Rendang: limit 10, 9 sold; Sayur urab has no limit; Kue lapis is switched to sold out.
    expect(screen.getByText('1 left')).toBeInTheDocument();
    expect(screen.getByText('1 · no limit')).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.getByText('Pickup 10 am–12 pm')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
  });

  it('marks the current phase and links the tiles to Orders with a filter', () => {
    const { onGo } = renderHome({ data: data({ view: liveView(), orders: ORDERS }) });
    expect(
      screen.getByText('Taking orders', { selector: 'li span.label' }).closest('li'),
    ).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByText('to confirm · 1 changed'));
    expect(onGo).toHaveBeenLastCalledWith('orders', 'status=ordered');
    fireEvent.click(screen.getByText('not paid · $90.00'));
    expect(onGo).toHaveBeenLastCalledWith('orders', 'unpaid=1');
    fireEvent.click(screen.getByText('orders · 1 cancelled'));
    expect(onGo).toHaveBeenLastCalledWith('orders');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Menu to change limits' }));
    expect(onGo).toHaveBeenLastCalledWith('menu');
  });

  it('says paused, with a Go to Menu hint, when Taking orders is off', () => {
    const { onGo } = renderHome({
      data: data({ view: liveView({ takingOrders: false }), orders: ORDERS }),
    });
    expect(screen.getByText('Orders paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Menu' }));
    expect(onGo).toHaveBeenCalledWith('menu');
  });

  it('has no hint while orders are being taken', () => {
    renderHome({ data: data({ view: liveView(), orders: ORDERS }) });
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
  });
});

describe('Home, cooking day (state 4) and orders closed', () => {
  it('shows the bars, the handover table, "Now" for a running pickup and the unpaid strip', () => {
    const { onGo } = renderHome({
      now: SATURDAY,
      data: data({ view: liveView(), orders: ORDERS }),
    });
    expect(screen.getByText('Cooking day · today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sat 17 Oct' })).toBeInTheDocument();
    expect(
      screen.getByText('Orders closed Thu 15 Oct, 8 pm · 3 orders · first pickup Glenelg at 10:00'),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Packed' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getByRole('progressbar', { name: 'Collected' })).toHaveAttribute(
      'aria-valuemax',
      '2',
    );
    expect(screen.getByRole('progressbar', { name: 'Delivered' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getAllByText('Now · until 12:00')).toHaveLength(1);
    expect(screen.getByText('1 delivered')).toBeInTheDocument();
    expect(screen.getByText('2 orders not paid yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Kitchen' }));
    expect(onGo).toHaveBeenLastCalledWith('kitchen');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Pickup & delivery' }));
    expect(onGo).toHaveBeenLastCalledWith('handover');
    fireEvent.click(screen.getByRole('button', { name: 'See who' }));
    expect(onGo).toHaveBeenLastCalledWith('orders', 'unpaid=1');
  });

  it('shows no unpaid strip when everyone has paid', () => {
    renderHome({
      now: SATURDAY,
      data: data({ view: liveView(), orders: [order({ paid: true })] }),
    });
    expect(screen.queryByRole('button', { name: 'See who' })).not.toBeInTheDocument();
  });

  it('after the cut-off and before the day: "Orders closed", the cooking-day layout and the hint', () => {
    const { onGo } = renderHome({
      now: FRIDAY,
      data: data({ view: liveView(), orders: ORDERS }),
    });
    expect(screen.getByText('Orders closed · cooking Sat 17 Oct')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Kitchen' })).toBeInTheDocument();
    expect(screen.queryByText('Now · until 12:00')).not.toBeInTheDocument();
    expect(screen.getByText(/Want more orders\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Menu' }));
    expect(onGo).toHaveBeenCalledWith('menu');
  });
});

describe('Home, remembering that the first menu was started', () => {
  it('shows the draft, not "Nothing on yet", after a reload', () => {
    const { unmount } = render(
      <AppThemeProvider>
        <SellerHome
          lang="en"
          now={NOW}
          data={data()}
          onStartMenu={vi.fn()}
          onContinue={vi.fn()}
          onGo={vi.fn()}
        />
      </AppThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make your first menu' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'New menu' })).getByRole('button', {
        name: 'Create menu',
      }),
    );
    unmount();
    // The page reloaded: the server still says "untouched", this device remembers.
    renderHome({ data: data() });
    expect(screen.getByText('Not published')).toBeInTheDocument();
  });
});

describe('Home in Indonesian', () => {
  it('is Indonesian when the language is', async () => {
    await i18n.changeLanguage('id');
    renderHome({ data: data(), lang: 'id' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Belum ada apa-apa' }),
    ).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
