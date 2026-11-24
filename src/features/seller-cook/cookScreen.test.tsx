import { fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CookScreen } from './CookScreen';
import { selectCookGroups } from './cookSelectors';
import { ordersLoaded } from '../../api/kitchenOrders';
import { currentSellerSlug, rememberSignedIn } from '../../api/device/sellerContext';
import { fetchMade } from '../../api/made';
import { loaded } from './cookSlice';
import {
  MENU,
  createTestStore,
  renderWithStore,
  line,
  makeOrder,
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

function Location() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname + search}</p>;
}

beforeAll(setupI18n);
beforeEach(() => window.localStorage.clear());

function renderKitchen(): TestStore {
  const store = createTestStore();
  seed(store, sampleOrders());
  renderWithStore(<CookScreen />, store);
  return store;
}

describe('Kitchen · Cook', () => {
  it('adds the private orders of today to the dish totals, tagged Private (plan 081)', () => {
    const store = createTestStore();
    store.dispatch(ordersLoaded({ orders: sampleOrders() }));
    store.dispatch(
      loaded({
        menu: MENU,
        privateOrders: [
          makeOrder({
            id: 'p1',
            code: 'PPPPPP',
            firstName: 'Bu Wayan',
            private: { eventDate: '2026-10-10', eventTime: '12:00' },
            lines: [line('lemper', 6)],
          }),
        ],
      }),
    );
    renderWithStore(<CookScreen />, store);
    const row = screen.getByText('Chicken lemper').closest('li');
    if (!row) throw new Error('row');
    expect(within(row).getByText('Private')).toBeInTheDocument();
    expect(within(row).getByText(/Menu 5 · Private 6/)).toBeInTheDocument();
    expect(within(row).getByText('0/11')).toBeInTheDocument();
  });

  it('shows the title with the cooking day, the rows and the pickup / delivery split', () => {
    renderKitchen();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kitchen · Sat 10 Oct');
    const row = screen.getByText('Chicken lemper').closest('li');
    if (!row) throw new Error('row');
    // Rina 2 pickup, Tom 3 delivery (Dewi's order is cancelled).
    expect(within(row).getByText('2 pickup · 3 delivery')).toBeInTheDocument();
    expect(within(row).getByText('0/5')).toBeInTheDocument();
  });

  it('counts made portions with + and − and saves them on the server', async () => {
    const store = renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li');
    if (!row) throw new Error('row');
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    expect(within(row).getByText('2/5')).toBeInTheDocument();
    await waitFor(() => store.getState().sellerCook.made['lemper'] === 2);
    // Another device reads the same count from the server.
    expect((await fetchMade(undefined, currentSellerSlug())).ok).toBe(true);
    expect(await fetchMade(undefined, currentSellerSlug())).toMatchObject({
      data: { made: { lemper: 2 } },
    });
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
    const store = createTestStore();
    seed(store, sampleOrders());
    const state = store.getState();
    expect(selectCookGroups(state, 'all', 'chef')).toBe(selectCookGroups(state, 'all', 'chef'));
  });
});

describe('Kitchen · chef filter', () => {
  it('hides the control when the kitchen has no chefs', () => {
    const store = createTestStore();
    store.dispatch(ordersLoaded({ orders: sampleOrders() }));
    store.dispatch(loaded({ menu: { ...MENU, chefs: [] }, made: {} }));
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

  it('Print label opens the Labels page with the open bag selected', () => {
    const store = createTestStore();
    seed(store, sampleOrders());
    renderWithStore(
      <>
        <CookScreen />
        <Location />
      </>,
      store,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Print label' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/seller\/labels\?order=[A-Z0-9]{6}$/,
    );
  });

  it('shows the total with Paid / Not paid and place and time on one line per bag', () => {
    openPack();
    const rows = within(screen.getByRole('list', { name: 'Bags' })).getAllByRole('listitem');
    const rina = rows.find((row) => within(row).queryByText('Rina')) as HTMLElement;
    expect(within(rina).getByText('$35.00')).toBeInTheDocument();
    expect(within(rina).getByText('Paid')).toBeInTheDocument();
    expect(within(rina).getByText('0/2')).toBeInTheDocument();
    const tom = rows.find((row) => within(row).queryByText('Tom')) as HTMLElement;
    expect(within(tom).getByText('Not paid')).toBeInTheDocument();
    expect(within(tom).getByText('Delivery')).toBeInTheDocument();
  });

  it('pins the total and the count in the open bag header', () => {
    openPack();
    const bag = screen.getByRole('region', { name: /Rina/ });
    expect(within(bag).getByText('$35.00')).toBeInTheDocument();
    expect(within(bag).getByText('0 of 2 items in the bag')).toBeInTheDocument();
  });
});

describe('Kitchen · who ordered', () => {
  function openWho(dish: string) {
    fireEvent.click(screen.getByRole('tab', { name: /Cook/ }));
    fireEvent.click(screen.getByRole('button', { name: `Who ordered ${dish}` }));
    return screen.getByRole('dialog');
  }

  it('lists the people, quantities and fulfilment, sorted by first name', () => {
    renderKitchen();
    const dialog = openWho('Chicken lemper');
    expect(within(dialog).getByText('5 portions · 2 customers')).toBeInTheDocument();
    const rows = within(dialog).getAllByRole('link');
    expect(rows).toHaveLength(2); // Dewi is cancelled
    expect(rows[0]).toHaveTextContent('Rina');
    expect(rows[0]).toHaveTextContent('K7F-2QX');
    expect(rows[0]).toHaveTextContent('×2');
    expect(rows[0]).toHaveTextContent('Pickup');
    expect(rows[1]).toHaveTextContent('Tom');
    expect(rows[1]).toHaveTextContent('×3');
    expect(rows[1]).toHaveTextContent('Delivery');
  });

  it('follows the chef filter', () => {
    renderKitchen();
    fireEvent.click(screen.getByRole('radio', { name: 'Chef Wati' }));
    expect(
      screen.queryByRole('button', { name: 'Who ordered Mixed rice' }),
    ).not.toBeInTheDocument();
    expect(within(openWho('Tempeh')).getAllByRole('link')).toHaveLength(1);
  });

  it('opens the order when a person is tapped', () => {
    renderKitchen();
    fireEvent.click(within(openWho('Chicken lemper')).getByRole('link', { name: /Tom/ }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/orders/M3H9TD');
  });
});
