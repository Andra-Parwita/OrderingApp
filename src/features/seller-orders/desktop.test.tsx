import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OrdersTableScreen } from './OrdersTableScreen';
import type { StatusFilter } from './orderStatus';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

beforeAll(setupI18n);

const noop = () => undefined;

function orders() {
  return [
    makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina', status: 'ordered', changed: true }),
    makeOrder({ id: '2', code: 'BBB333', firstName: 'Budi', status: 'confirmed', note: 'x' }),
    makeOrder({ id: '3', code: 'CCC444', firstName: 'Sari', status: 'confirmed', paid: true }),
    makeOrder({ id: '4', code: 'DDD555', firstName: 'Tom', status: 'ready_for_pickup' }),
  ];
}

/** Stands in for the route wrapper: the code, filter, search and toggles live in its state. */
function Workspace({
  initialFilter = 'all',
  onShare = noop,
}: Readonly<{ initialFilter?: StatusFilter; onShare?: () => void }>) {
  const [code, setCode] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<StatusFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [toggles, setToggles] = useState({ changed: false, unpaid: false });
  return (
    <OrdersTableScreen
      filter={filter}
      query={query}
      onFilterChange={setFilter}
      onQueryChange={setQuery}
      onOpenOrder={setCode}
      onNewOrder={noop}
      onShare={onShare}
      toggles={toggles}
      onToggle={(key) => setToggles((old) => ({ ...old, [key]: !old[key] }))}
      onCloseOrder={() => setCode(undefined)}
      {...(code ? { selectedCode: code } : {})}
    />
  );
}

function renderLive(initialFilter: StatusFilter = 'all', onShare: () => void = noop) {
  const store = createTestStore({ saga: false });
  seed(store, orders());
  seedMenu(store, makeMenuView('live'));
  renderWithStore(<Workspace initialFilter={initialFilter} onShare={onShare} />, store);
  return store;
}

describe('Home with a live menu', () => {
  it('has a one-row header: switch, search, toggles, Dishes, New order and a More menu', () => {
    renderLive();
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Taking orders' })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Name or code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Changed\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Not paid\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dishes\s*\d+$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show more orders' })).toBeInTheDocument();
    expect(screen.queryByText(/Menu for .*17 Oct/)).not.toBeInTheDocument();
  });

  it('keeps the menu line and Share menu in the More menu, and Share still works', () => {
    const onShare = vi.fn();
    renderLive('all', onShare);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(screen.getByText(/Menu for .*17 Oct.* · Orders close/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share menu' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it('closes the More menu with Escape', () => {
    renderLive();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: 'Share menu' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });

  it('shows "Orders paused" when Taking orders is off', () => {
    const store = createTestStore({ saga: false });
    seed(store, orders());
    seedMenu(store, makeMenuView('live', { takingOrders: false }));
    renderWithStore(<Workspace />, store);
    expect(screen.getByRole('switch', { name: 'Orders paused' })).not.toBeChecked();
  });

  it('lists every order as a row, with Changed and Not paid counts and status tab counts', () => {
    renderLive();
    expect(screen.getByRole('button', { name: /Rina/ })).toHaveTextContent('Changed');
    // The count sits in its own span, so the name reads "Changed1" or "Changed 1".
    expect(screen.getByRole('button', { name: /^Changed\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Not paid\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Confirmed\s*2$/ })).toBeInTheDocument();
  });

  it('narrows the list with the status tab, the toggles and the search', () => {
    renderLive();
    fireEvent.click(screen.getByRole('button', { name: /^Confirmed\s*2$/ }));
    expect(screen.queryByRole('button', { name: /Rina/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Not paid\s*3$/ }));
    expect(screen.queryByRole('button', { name: /Sari/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Budi/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name or code' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No orders match.')).toBeInTheDocument();
  });

  it('opens the Dishes slide-over from its button and closes it with Close or Escape', () => {
    renderLive();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const open = screen.getByRole('button', { name: /^Dishes\s*\d+$/ });
    open.focus(); // a real click focuses the button; fireEvent does not
    fireEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Dishes' });
    expect(dialog).toHaveFocus();
    expect(
      within(dialog).getByRole('button', { name: 'Edit limit: Chicken lemper' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sold out' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    fireEvent.click(open);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still edits a dish limit inside the slide-over', () => {
    renderLive();
    fireEvent.click(screen.getByRole('button', { name: /^Dishes\s*\d+$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Dishes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit limit: Chicken lemper' }));
    expect(within(dialog).getByLabelText(/Limit for Chicken lemper/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).queryByLabelText(/Limit for Chicken lemper/)).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no orders at all', () => {
    const store = createTestStore({ saga: false });
    seed(store, []);
    seedMenu(store, makeMenuView('live'));
    renderWithStore(<Workspace />, store);
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share menu on WhatsApp' })).toBeInTheDocument();
  });
});

describe('the order beside the list', () => {
  const rowOf = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

  it('opens from a row and closes with the labelled Close button', () => {
    renderLive();
    fireEvent.click(rowOf('Budi'));
    const panel = screen.getByRole('complementary', { name: 'Order BBB333' });
    expect(within(panel).getByRole('heading', { level: 2, name: /Budi/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('shows one row: Confirm order, two icon buttons and a More menu with the rest', () => {
    renderLive();
    fireEvent.click(rowOf('Rina'));
    const panel = screen.getByRole('complementary');
    for (const name of ['Confirm order', 'Send link on WhatsApp', 'Mark paid', 'More']) {
      expect(within(panel).getByRole('button', { name })).toBeInTheDocument();
    }
    fireEvent.click(within(panel).getByRole('button', { name: 'More' }));
    for (const name of ['Mark collected', 'Lock', 'Nudge', 'Cancel order']) {
      expect(within(panel).getByRole('menuitem', { name })).toBeEnabled();
    }
  });

  it('asks before cancelling and names who is told', () => {
    renderLive();
    fireEvent.click(rowOf('Rina'));
    const panel = screen.getByRole('complementary');
    fireEvent.click(within(panel).getByRole('button', { name: 'More' }));
    fireEvent.click(within(panel).getByRole('menuitem', { name: 'Cancel order' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText("Cancel Rina's order?")).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep order' })).toBeInTheDocument();
  });
});

describe('Home without a live menu', () => {
  it('first run: the set-up checklist', () => {
    const store = createTestStore({ saga: false });
    seed(store, []);
    const view = makeMenuView('not_published', { wizardStep: 0 });
    seedMenu(store, { ...view, dishes: [] });
    renderWithStore(<Workspace />, store);
    expect(screen.getByText('Set up your kitchen')).toBeInTheDocument();
    expect(screen.getAllByText('Add your pictures').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Add your WhatsApp number').length).toBeGreaterThan(0);
    expect(screen.getByText('Publish and share')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('not published: the Continue line for the cooking date', () => {
    const store = createTestStore({ saga: false });
    seed(store, []);
    seedMenu(store, makeMenuView('not_published', { wizardStep: 1 }));
    renderWithStore(<Workspace />, store);
    expect(screen.getByText(/isn't published yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4 · saved')).toBeInTheDocument();
  });

  it('cooking day over: Just finished, the unpaid loose ends and Earlier menus', () => {
    const store = createTestStore({ saga: false });
    seed(store, orders());
    seedMenu(store, makeMenuView('finished'));
    renderWithStore(<Workspace />, store);
    expect(screen.getByText('Just finished')).toBeInTheDocument();
    expect(screen.getByText('Earlier menus')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark paid' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'See all 4 orders' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
