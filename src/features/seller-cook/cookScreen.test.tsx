import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { CookScreen } from './CookScreen';
import { selectCookGroups, selectCookStats } from './cookSelectors';
import { pollingStarted, pollingStopped } from './cookSlice';
import {
  createTestStore,
  renderWithStore,
  sampleOrders,
  seed,
  setupI18n,
  type TestStore,
} from './testSupport';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

beforeAll(setupI18n);

describe('CookScreen on a desktop', () => {
  function renderDesktop(): void {
    const store = createTestStore({ saga: false });
    seed(store, sampleOrders());
    renderWithStore(<CookScreen desktop />, store);
  }

  it('shows who ordered inline, with quantities, and a print button', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderDesktop();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cook list · Sat 10 Oct');
    // Lemper: Rina 2 and Tom 3 (Dewi's order is cancelled), no disclosure to open.
    const row = screen.getByText('Lemper ayam').closest('li');
    if (!row) throw new Error('row');
    const list = within(row).getByRole('list', { name: 'Who ordered' });
    const chips = within(list).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Rina×2', 'Tom×3']);
    // All chips share one grid of equal columns, so they line up (D-033).
    const grid = getComputedStyle(list);
    expect(grid.display).toBe('grid');
    expect(grid.gridTemplateColumns).toBe('repeat(auto-fill, minmax(8.5rem, 1fr))');
    expect(within(row).getAllByText('×')).toHaveLength(2);
    expect(within(row).getByText('3').tagName).toBe('B');
    expect(screen.queryByRole('button', { name: /Who ordered/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Group by' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Print cook list' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});

describe('who-ordered chip tooltip', () => {
  it('shows the full name on keyboard focus', () => {
    const store = createTestStore({ saga: false });
    seed(store, sampleOrders());
    renderWithStore(<CookScreen desktop />, store);
    const row = screen.getByText('Lemper ayam').closest('li');
    if (!row) throw new Error('row');
    const chip = within(row).getAllByRole('listitem')[0]?.firstElementChild?.firstElementChild;
    if (!(chip instanceof HTMLElement)) throw new Error('chip');
    expect(within(row).queryByText('Rina', { selector: 'span[aria-hidden]' })).toBeNull();
    fireEvent.focus(chip);
    expect(within(row).getByText('Rina', { selector: 'span[aria-hidden]' })).toBeInTheDocument();
  });
});

describe('CookScreen', () => {
  function renderCook(): TestStore {
    const store = createTestStore({ saga: false });
    seed(store, sampleOrders());
    renderWithStore(<CookScreen />, store);
    return store;
  }

  it('shows the title with the cooking day, the stats and the items', () => {
    renderCook();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('To cook · Sat 10 Oct');
    const stats = screen.getByLabelText('Totals');
    expect(within(stats).getByText('3')).toBeInTheDocument();
    expect(within(stats).getByText('$100.00')).toBeInTheDocument();
    expect(within(stats).getByText('$35.00')).toBeInTheDocument();
    expect(within(stats).getByText('$65.00')).toBeInTheDocument();
    // Indonesian name first, the English one smaller.
    expect(screen.getByText('Lemper ayam')).toBeInTheDocument();
    expect(screen.getByText('Chicken lemper')).toBeInTheDocument();
    expect(screen.getByText('5 of 20 portions')).toBeInTheDocument();
  });

  it('lists every note with code and name', () => {
    renderCook();
    const notes = screen.getByRole('region', { name: 'Notes (2)' });
    expect(within(notes).getByText('K7F-2QX')).toBeInTheDocument();
    expect(within(notes).getByText('“No chilli on the tempeh please”')).toBeInTheDocument();
    expect(within(notes).getByText('“Peanut allergy”')).toBeInTheDocument();
    expect(within(notes).queryByText(/Cancelled order note/)).not.toBeInTheDocument();
  });

  it('switches to Confirmed only and the numbers follow', () => {
    renderCook();
    fireEvent.click(screen.getByRole('radio', { name: 'Confirmed only' }));
    const stats = screen.getByLabelText('Totals');
    expect(within(stats).getByText('2')).toBeInTheDocument();
    expect(within(stats).getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notes (1)' })).toBeInTheDocument();
    expect(screen.getByText('2 of 20 portions')).toBeInTheDocument();
  });

  it('groups by chef, with the chef name only on this seller screen', () => {
    renderCook();
    fireEvent.click(screen.getByRole('radio', { name: 'Chef' }));
    const wati = screen.getByRole('region', { name: 'Chef Wati' });
    expect(within(wati).getByText('Lemper ayam')).toBeInTheDocument();
    expect(within(wati).queryByText('Nasi campur')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Delave' })).getByText('Nasi campur'),
    ).toBeInTheDocument();
  });

  it('groups by customer and by pickup/delivery', () => {
    renderCook();
    fireEvent.click(screen.getByRole('radio', { name: 'Customer' }));
    expect(screen.getByRole('region', { name: 'Tom · M3H-9TD' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Who ordered/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Pickup/delivery' }));
    expect(screen.getByRole('region', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pickup' })).toBeInTheDocument();
  });

  it('expands who ordered an item', () => {
    renderCook();
    const row = screen.getByText('Lemper ayam').closest('li');
    if (!row) throw new Error('row');
    fireEvent.click(within(row).getByRole('button', { name: /Who ordered/ }));
    const chips = within(row).getAllByRole('listitem');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Rina×2', 'Tom×3']);
  });

  it('memoises: the same orders and options give the same result object', () => {
    const store = createTestStore({ saga: false });
    seed(store, sampleOrders());
    const state = store.getState();
    expect(selectCookGroups(state, 'all', 'chef')).toBe(selectCookGroups(state, 'all', 'chef'));
    expect(selectCookStats(state, 'all')).toBe(selectCookStats(state, 'all'));
  });
});

describe('cook polling', () => {
  beforeEach(() => mockStore.reset());

  it('loads orders and menu, polls while shown and stops when not', async () => {
    const order = (firstName: string) => {
      const result = mockStore.createOrder({
        firstName,
        language: 'en',
        lines: [{ itemId: 'lemper', qty: 1 }],
        fulfilment: 'pickup',
      });
      if (!result.ok) throw new Error(result.message);
    };
    order('Rina');
    const store = createTestStore({ saga: true, pollMs: 20 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerCook.list.status === 'ready');
    expect(store.getState().sellerCook.menu?.chefs.map((chef) => chef.name)).toEqual(['Chef Wati']);
    expect(store.getState().sellerCook.orders).toHaveLength(1);

    // A new order shows up on the next poll.
    order('Tom');
    await waitFor(() => store.getState().sellerCook.orders.length === 2);
    store.dispatch(pollingStopped());
    await sleep(60); // let an in-flight request finish
    order('Dewi');
    await sleep(100);
    expect(store.getState().sellerCook.orders).toHaveLength(2);
  });
});
