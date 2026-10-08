import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEntry } from '../../../shared/domain';
import { mockStore } from '../../../mocks/handlers';
import { OrderDetailScreen } from './OrderDetailScreen';
import { OrdersScreen } from './OrdersScreen';
import type { StatusFilter } from './orderStatus';
import { createTestStore, makeOrder, renderWithStore, seed, setupI18n } from './testSupport';

const noop = () => undefined;

/** Stands in for the route wrapper, which keeps the filter and the search in the URL. */
function UrlState({ onOpen }: Readonly<{ onOpen: (code: string) => void }>) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  return (
    <OrdersScreen
      filter={filter}
      query={query}
      onFilterChange={setFilter}
      onQueryChange={setQuery}
      onOpenOrder={onOpen}
    />
  );
}

function entry(minute: number, what: AuditEntry['what'], detail?: string): AuditEntry {
  return {
    by: { role: 'chef', name: 'Wati' },
    what,
    ...(detail !== undefined ? { detail } : {}),
    at: `2026-10-08T10:0${minute}:00Z`,
  };
}

describe('seller screens', () => {
  beforeAll(setupI18n);
  beforeEach(() => mockStore.reset());

  describe('OrdersScreen', () => {
    function renderList() {
      const store = createTestStore({ saga: false });
      seed(store, [
        makeOrder({ id: '1', code: 'K7F2QX', firstName: 'Rina', note: 'No chilli' }),
        makeOrder({
          id: '2',
          code: 'M3H9TD',
          firstName: 'Tom',
          status: 'ordered',
          enteredBy: { role: 'chef', name: 'Wati' },
        }),
        makeOrder({ id: '3', code: 'R8P4WB', firstName: 'Sari', paid: true }),
      ]);
      const onOpen = vi.fn();
      renderWithStore(<UrlState onOpen={onOpen} />, store);
      return onOpen;
    }

    it('marks notes, who entered an order, and paid', () => {
      renderList();
      const rina = screen.getByRole('button', { name: /K7F-2QX/ });
      expect(within(rina).getByText('✎ Note')).toBeInTheDocument();
      const tom = screen.getByRole('button', { name: /M3H-9TD/ });
      expect(within(tom).getByText('entered by Chef Wati')).toBeInTheDocument();
      expect(
        within(screen.getByRole('button', { name: /R8P-4WB/ })).getByText('✓ Paid'),
      ).toBeInTheDocument();
    });

    it('opens an order by its code', () => {
      const onOpen = renderList();
      fireEvent.click(screen.getByRole('button', { name: /K7F-2QX/ }));
      expect(onOpen).toHaveBeenCalledWith('K7F2QX');
    });

    it('filters to Ordered from the "not confirmed" shortcut and shows counts', () => {
      renderList();
      expect(screen.getByRole('button', { name: 'All 3' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /1 not confirmed/ }));
      expect(screen.getByRole('button', { name: 'Ordered 1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('button', { name: /K7F-2QX/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /M3H-9TD/ })).toBeInTheDocument();
    });

    it('searches by a sloppily typed code', () => {
      renderList();
      fireEvent.change(screen.getByLabelText('Order code or name'), {
        target: { value: 'k7f 2qx' },
      });
      expect(screen.getByRole('button', { name: /K7F-2QX/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /R8P-4WB/ })).not.toBeInTheDocument();
    });

    it('has no New order or Share button unless they are wired', () => {
      renderList();
      expect(screen.queryByRole('button', { name: /new order/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Share menu' })).not.toBeInTheDocument();
    });
  });

  describe('OrderDetailScreen', () => {
    function renderDetail(overrides = {}) {
      const store = createTestStore({ saga: false });
      seed(store, [makeOrder({ note: 'No chilli on the tempeh please', ...overrides })]);
      renderWithStore(<OrderDetailScreen code="K7F2QX" onBack={noop} />, store);
    }

    it('shows the note and who entered the order', () => {
      renderDetail({ enteredBy: { role: 'seller', name: 'Bu Ani' } });
      expect(screen.getByText('Note from customer')).toBeInTheDocument();
      expect(screen.getByText('No chilli on the tempeh please')).toBeInTheDocument();
      expect(screen.getByText('entered by Bu Ani')).toBeInTheDocument();
    });

    it('offers one next step, plus cancel, for a confirmed pickup order', () => {
      renderDetail();
      expect(screen.getByRole('button', { name: 'Mark ready for pickup' })).toBeInTheDocument();
      for (const later of [
        'Mark collected',
        'Mark delivered',
        'Confirm order',
        'Mark out for delivery',
      ]) {
        expect(screen.queryByRole('button', { name: later })).not.toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    });

    it('offers no steps and no cancel once the order is final', () => {
      renderDetail({ status: 'collected' });
      expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ready for pickup' })).not.toBeInTheDocument();
    });

    it('lists up to 4 last changes, newest first', () => {
      renderDetail({
        audit: [
          entry(1, 'created'),
          entry(5, 'status', 'confirmed'),
          entry(3, 'edited'),
          entry(4, 'paid', 'paid'),
          entry(2, 'edited'),
        ],
      });
      const history = screen.getByRole('list');
      const items = within(history).getAllByRole('listitem');
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent('Chef Wati · Status → Confirmed');
      expect(items[1]).toHaveTextContent('Chef Wati · Marked paid');
      expect(items[2]).toHaveTextContent('Chef Wati · Edited');
      expect(items[3]).toHaveTextContent('Chef Wati · Edited');
    });

    it('shows that the order is not found', () => {
      const store = createTestStore({ saga: false });
      seed(store, []);
      renderWithStore(<OrderDetailScreen code="AAAAAA" onBack={noop} />, store);
      expect(screen.getByText('Order not found.')).toBeInTheDocument();
    });

    it('needs a second tap to cancel, then cancels on the server', async () => {
      const created = mockStore.createOrder({
        firstName: 'Rina',
        language: 'en',
        lines: [{ itemId: 'nasi-campur', qty: 1 }],
        fulfilment: 'pickup',
      });
      if (!created.ok) throw new Error(created.message);
      const store = createTestStore({ saga: true });
      renderWithStore(<OrderDetailScreen code={created.value.code} onBack={noop} />, store);

      const cancel = await screen.findByRole('button', { name: 'Cancel order' });
      fireEvent.click(cancel);
      expect(
        await screen.findByRole('button', { name: 'Tap again to cancel' }),
      ).toBeInTheDocument();
      expect(mockStore.getByCode(created.value.code)?.status).toBe('ordered');

      fireEvent.click(screen.getByRole('button', { name: 'Tap again to cancel' }));
      expect(await screen.findByText('Cancelled')).toBeInTheDocument();
      expect(mockStore.getByCode(created.value.code)?.status).toBe('cancelled');
    });
  });
});
