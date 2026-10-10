import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import * as kitchen from '../../api/kitchen';
import { CookScreen } from './CookScreen';
import { selectCookGroups } from './cookSelectors';
import { rememberSignedIn } from '../../api/device/sellerContext';
import { loaded, pollingStarted, pollingStopped } from './cookSlice';
import {
  MENU,
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
beforeEach(() => window.localStorage.clear());

function renderKitchen(): TestStore {
  const store = createTestStore({ saga: false });
  seed(store, sampleOrders());
  renderWithStore(<CookScreen />, store);
  return store;
}

describe('Kitchen · Cook', () => {
  it('shows the title with the cooking day, the rows and the pickup / delivery split', () => {
    renderKitchen();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kitchen · Sat 10 Oct');
    const row = screen.getByText('Chicken lemper').closest('li');
    if (!row) throw new Error('row');
    // Rina 2 pickup, Tom 3 delivery (Dewi's order is cancelled).
    expect(within(row).getByText('2 pickup · 3 delivery')).toBeInTheDocument();
    expect(within(row).getByText('0/5')).toBeInTheDocument();
  });

  it('counts made portions with + and − and keeps them on the device', () => {
    renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li');
    if (!row) throw new Error('row');
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    expect(within(row).getByText('2/5')).toBeInTheDocument();
    expect(window.localStorage.getItem('cook-made:2026-10-10')).toBe('{"lemper":2}');
    fireEvent.click(within(row).getByRole('button', { name: 'One less Chicken lemper' }));
    expect(within(row).getByText('1/5')).toBeInTheDocument();
  });

  it('hides the counters when count mode is off', () => {
    renderKitchen();
    fireEvent.click(screen.getByRole('switch', { name: /Count mode/ }));
    expect(screen.queryByRole('button', { name: /One more/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('cook-count-mode')).toBe('off');
  });

  it('groups by chef', () => {
    renderKitchen();
    fireEvent.click(screen.getByRole('radio', { name: 'Chef' }));
    const wati = screen.getByRole('region', { name: 'Chef Wati' });
    expect(within(wati).getByText('Chicken lemper')).toBeInTheDocument();
    expect(within(wati).queryByText('Mixed rice')).not.toBeInTheDocument();
  });

  it('lists every note with code and name', () => {
    renderKitchen();
    const notes = screen.getByRole('region', { name: 'Notes (2)' });
    expect(within(notes).getByText('K7F-2QX')).toBeInTheDocument();
    expect(within(notes).queryByText(/Cancelled order note/)).not.toBeInTheDocument();
  });

  it('memoises the groups', () => {
    const store = createTestStore({ saga: false });
    seed(store, sampleOrders());
    const state = store.getState();
    expect(selectCookGroups(state, 'all', 'chef')).toBe(selectCookGroups(state, 'all', 'chef'));
  });
});

describe('Kitchen · chef filter', () => {
  it('hides the control when the kitchen has no chefs', () => {
    const store = createTestStore({ saga: false });
    store.dispatch(loaded({ orders: sampleOrders(), menu: { ...MENU, chefs: [] } }));
    renderWithStore(<CookScreen />, store);
    expect(screen.queryByRole('radio', { name: 'Chef Wati' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'All' })).not.toBeInTheDocument();
  });

  it('shows only the chosen chef in Cook, and remembers it', () => {
    renderKitchen();
    fireEvent.click(screen.getByRole('radio', { name: 'Chef Wati' }));
    expect(screen.getByText('Chicken lemper')).toBeInTheDocument();
    expect(screen.queryByText('Mixed rice')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('cook-chef-filter')).toBe('chef-wati');
  });

  it('defaults to the signed-in chef', () => {
    rememberSignedIn({ slug: 'delave', chefId: 'wati' });
    renderKitchen();
    expect(screen.getByRole('radio', { name: 'Chef Wati' })).toBeChecked();
    expect(screen.queryByText('Fried chicken')).not.toBeInTheDocument();
  });

  it('in Pack lists only orders with that chef and greys the other lines', () => {
    renderKitchen();
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Chef Wati' }));
    expect(
      within(screen.getByRole('list', { name: 'Bags' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    // Rina's bag is open: lemper is hers to pack, the nasi is another chef's.
    expect(screen.getByRole('checkbox', { name: /Mixed rice/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Chicken lemper/ })).toBeEnabled();
  });
});

describe('Kitchen · Pack', () => {
  function openPack(): TestStore {
    const store = renderKitchen();
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
    return store;
  }

  it('lists the bags with progress and the header count', () => {
    openPack();
    expect(screen.getByText('0 of 3 bags packed')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Bags' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('ticks an item and saves the whole ticked set', async () => {
    const pack = vi.spyOn(kitchen, 'packOrder').mockImplementation((code) => {
      const order = sampleOrders().find((candidate) => candidate.code === code);
      if (!order) throw new Error(code);
      return Promise.resolve({
        ok: true,
        data: { order: { ...order, lines: order.lines } },
      } as never);
    });
    openPack();
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    await waitFor(() => pack.mock.calls.length === 1);
    expect(pack.mock.calls[0]?.[1]).toEqual({ ticked: [expect.any(String)] });
    pack.mockRestore();
  });

  it('asks before packing a bag with unticked items, then sends force', async () => {
    const pack = vi.spyOn(kitchen, 'packOrder');
    pack.mockResolvedValueOnce({
      ok: false,
      error: 'conflict',
      status: 409,
      message: 'Items not ticked',
      warning: { code: 'items_unticked', unticked: ['lemper', 'nasi'] },
    } as never);
    pack.mockImplementationOnce(async (code) => {
      const order = sampleOrders().find((candidate) => candidate.code === code);
      return Promise.resolve({ ok: true, data: { order: { ...order, packed: true } } } as never);
    });
    openPack();
    fireEvent.click(screen.getByRole('button', { name: 'Packed · next bag' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('2 items not ticked')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark packed anyway' }));
    await waitFor(() => pack.mock.calls.length === 2);
    expect(pack.mock.calls[1]?.[1]).toEqual({ packed: true, force: true });
    pack.mockRestore();
  });

  it('says packing does not change the status once everything is ticked', () => {
    const store = createTestStore({ saga: false });
    const orders = sampleOrders().map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({ ...line, ticked: true })),
    }));
    seed(store, orders);
    renderWithStore(<CookScreen />, store);
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
    expect(screen.getByText(/Packing doesn't change the order status/)).toBeInTheDocument();
  });
});

describe('cook polling', () => {
  beforeEach(() => mockStore.reset());

  it('loads orders and menu, polls while shown and stops when not', async () => {
    const order = async (firstName: string) => {
      const result = await mockStore.createOrder({
        firstName,
        language: 'en',
        lines: [{ itemId: 'lemper', qty: 1 }],
        fulfilment: 'pickup',
      });
      if (!result.ok) throw new Error(result.message);
    };
    await order('Rina');
    const store = createTestStore({ saga: true, pollMs: 20 });
    store.dispatch(pollingStarted());
    await waitFor(() => store.getState().sellerCook.list.status === 'ready');
    expect(store.getState().sellerCook.menu?.chefs.map((chef) => chef.name)).toEqual(['Chef Wati']);
    expect(store.getState().sellerCook.orders).toHaveLength(1);

    await order('Tom');
    await waitFor(() => store.getState().sellerCook.orders.length === 2);
    store.dispatch(pollingStopped());
    await sleep(60);
    await order('Dewi');
    await sleep(100);
    expect(store.getState().sellerCook.orders).toHaveLength(2);
  });
});
