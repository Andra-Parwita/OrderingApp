import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { OrderPanel } from './OrderPanel';
import { OrdersTableScreen } from './OrdersTableScreen';
import type { StatusFilter } from './orderStatus';
import { createTestStore, makeOrder, renderWithStore, seed, setupI18n } from './testSupport';

beforeAll(setupI18n);

const noop = () => undefined;

function orders() {
  return [
    makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina', status: 'ordered' }),
    makeOrder({ id: '2', code: 'BBB333', firstName: 'Budi', status: 'confirmed', note: 'x' }),
    makeOrder({ id: '3', code: 'CCC444', firstName: 'Sari', status: 'confirmed' }),
    makeOrder({ id: '4', code: 'DDD555', firstName: 'Tom', status: 'ready_for_pickup' }),
  ];
}

/** Stands in for the route wrapper: the code, filter and search live in its state. */
function Workspace({ initialFilter = 'all' }: Readonly<{ initialFilter?: StatusFilter }>) {
  const [code, setCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(initialFilter);
  const [query, setQuery] = useState('');
  return (
    <>
      <OrdersTableScreen
        filter={filter}
        query={query}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onOpenOrder={setCode}
        onNewOrder={noop}
        onShare={noop}
        {...(code ? { selectedCode: code } : {})}
      />
      {code ? (
        <OrderPanel
          code={code}
          filter={filter}
          query={query}
          onClose={() => setCode(null)}
          onOpenOrder={setCode}
        />
      ) : null}
    </>
  );
}

function renderWorkspace(initialFilter: StatusFilter = 'all') {
  const store = createTestStore({ saga: false });
  seed(store, orders());
  renderWithStore(<Workspace initialFilter={initialFilter} />, store);
}

describe('the desktop orders table', () => {
  it('has the six plain columns and at most one flag per row', () => {
    renderWorkspace();
    const table = screen.getByRole('table', { name: 'Orders' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Order', 'Name', 'What they ordered', 'Total', 'Status', 'Needs attention']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(within(row).getAllByRole('cell')).toHaveLength(6);
    // Rina is waiting for confirmation and is new: just that flag. Budi has a note.
    expect(within(rows[0] as HTMLElement).getByText('New customer')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Note')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('Nothing to do')).toBeInTheDocument();
  });

  it('never cuts the code, name, total, status or flag; only "what they ordered" gives way', () => {
    renderWorkspace();
    const rows = within(screen.getByRole('table', { name: 'Orders' }))
      .getAllByRole('row')
      .slice(1);
    const cells = within(rows[0] as HTMLElement).getAllByRole('cell');
    for (const index of [0, 1, 3, 4, 5]) {
      const style = getComputedStyle(cells[index] as HTMLElement);
      expect(style.maxWidth).not.toBe('0');
      expect(style.textOverflow).not.toBe('ellipsis');
      expect(cells[index]?.querySelector('[data-full]')).toBeNull();
      expect(cells[index]).not.toHaveAttribute('data-full');
    }
    expect((cells[1] as HTMLElement).textContent).toBe('Rina');
    expect(cells[2]).toHaveAttribute('data-full');
    const widths = Array.from(
      screen.getByRole('table', { name: 'Orders' }).querySelectorAll('col'),
    ).map((col) => col.style.width);
    expect(widths).toEqual(['', '', '100%', '', '', '']);
  });

  it('names the chip for edited orders "Edited by customer"', () => {
    renderWorkspace();
    expect(screen.getByRole('button', { name: 'Edited by customer 0' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no orders at all', () => {
    const store = createTestStore({ saga: false });
    seed(store, []);
    renderWithStore(
      <OrdersTableScreen
        filter="all"
        query=""
        onFilterChange={noop}
        onQueryChange={noop}
        onOpenOrder={noop}
        onShare={noop}
      />,
      store,
    );
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share menu on WhatsApp' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('the order panel', () => {
  const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

  it('opens from a row with Enter and takes focus; Escape closes and returns focus to the row', () => {
    renderWorkspace();
    const row = rowOf('Budi');
    row.focus();
    fireEvent.keyDown(row, { key: 'Enter' });
    const dialog = screen.getByRole('dialog', { name: 'Order BBB-333' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(rowOf('Budi')).toHaveFocus();
  });

  it('closes with the labelled Close button', () => {
    renderWorkspace();
    fireEvent.click(rowOf('Sari'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves with Next order and Previous through the rows of the table', () => {
    renderWorkspace();
    fireEvent.click(rowOf('Budi'));
    expect(screen.getByRole('heading', { name: 'BBB-333' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next order/ }));
    expect(screen.getByRole('heading', { name: 'CCC-444' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
    fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(screen.getByRole('heading', { name: 'AAA-222' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
  });

  it('follows the filtered order, not the whole week', () => {
    renderWorkspace('confirmed');
    fireEvent.click(rowOf('Budi'));
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next order/ }));
    expect(screen.getByRole('heading', { name: 'CCC-444' })).toBeInTheDocument();
    // Tom (Ready) is not in the Confirmed table, so Sari is the last stop.
    expect(screen.getByRole('button', { name: /Next order/ })).toBeDisabled();
  });

  it('shows one big next step, labelled helpers, Cancel, and history folded away', () => {
    renderWorkspace();
    fireEvent.click(rowOf('Rina'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Confirm order' })).toBeInTheDocument();
    for (const name of ['Mark paid', 'Lock order', 'Send link on WhatsApp', 'Nudge customer']) {
      expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(within(dialog).getByText('Last changes').closest('details')).not.toHaveAttribute('open');
  });
});
