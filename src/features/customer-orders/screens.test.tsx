import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { createOrder, nudgeOrder, setOrderLocked, setOrderStatus } from '../../api/client';
import { MY_ORDERS_KEY, readMyOrders, saveMyOrder } from '../../api/device/myOrders';
import { MyOrdersScreen } from './MyOrdersScreen';
import { OrderScreen } from './OrderScreen';
import { renderWithStore, setupI18n } from './testSupport';

const noop = () => undefined;
const NUMBER = '61412345678';

beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

async function useMenu(patch: {
  whatsappNumber?: string;
  ordering?: MenuResponse['ordering'];
}): Promise<void> {
  const body = (await (await fetch('/api/menu')).json()) as MenuResponse;
  const next: MenuResponse = {
    ...body,
    kitchen: {
      ...body.kitchen,
      ...(patch.whatsappNumber ? { whatsappNumber: patch.whatsappNumber } : {}),
    },
    ordering: patch.ordering ?? body.ordering,
  };
  server.use(http.get('*/api/menu', () => HttpResponse.json(next)));
}

async function place(language: 'en' | 'id' = 'en'): Promise<CustomerOrder> {
  const result = await createOrder({
    firstName: 'Rina',
    language,
    fulfilment: 'pickup',
    note: 'No chilli',
    lines: [{ itemId: 'tempe-mendoan', qty: 3 }],
  });
  if (!result.ok) throw new Error('could not place the sample order');
  saveMyOrder(result.data.order);
  return result.data.order;
}

function renderOrder(token: string, onChange: (token: string) => void = noop) {
  return renderWithStore(<OrderScreen token={token} onBack={noop} onChange={onChange} />);
}

describe('MyOrdersScreen', () => {
  it('shows the empty state with a way back to the menu', async () => {
    const onBack = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={onBack} onOpenOrder={noop} />);
    expect(
      await screen.findByText(
        "Your orders will appear here. Pick something from this week's menu to get started.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: "See this week's menu" }));
    expect(onBack).toHaveBeenCalled();
  });

  it('lists a saved order in "This week" with status, summary, fulfilment and total', async () => {
    const placed = await place();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('This week')).toBeVisible();
    const row = screen.getByRole('button', { name: new RegExp(placed.code.slice(0, 3)) });
    expect(row).toHaveTextContent('Ordered');
    expect(row).toHaveTextContent('3× Thin battered tempeh');
    expect(row).toHaveTextContent('Sat 10 Oct · Pickup');
    expect(row).toHaveTextContent('$30.00');
    expect(screen.getByText('Saved on this phone only. No account.')).toBeVisible();
    expect(screen.queryByText('Earlier orders')).not.toBeInTheDocument();
  });

  it('opens an order from its tapped row', async () => {
    const placed = await place();
    const onOpenOrder = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={onOpenOrder} />);
    fireEvent.click(await screen.findByRole('button', { name: /Ordered/ }));
    expect(onOpenOrder).toHaveBeenCalledWith(placed.token);
  });

  it.each([
    ['lowercase', (code: string) => code.toLowerCase()],
    ['with a space', (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`],
    ['with a dash', (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`],
  ])('opens by a typed code, %s, on the 6th character', async (_name, format) => {
    const placed = await place();
    const onOpenOrder = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={onOpenOrder} />);
    const field = await screen.findByLabelText('Order code');
    const typed = format(placed.code);
    // Not yet at the 5th character.
    fireEvent.change(field, { target: { value: typed.slice(0, 5) } });
    expect(onOpenOrder).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: typed } });
    expect(onOpenOrder).toHaveBeenCalledWith(placed.token);
  });

  it('says so when a typed code is not saved on this phone', async () => {
    await place();
    const onOpenOrder = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={onOpenOrder} />);
    fireEvent.change(await screen.findByLabelText('Order code'), { target: { value: 'ZZZ-ZZZ' } });
    expect(await screen.findByText(/not saved on this phone/)).toBeVisible();
    expect(onOpenOrder).not.toHaveBeenCalled();
  });

  it('shows an unseen-update dot with text only when the inbox is newer than last seen', async () => {
    const placed = await place();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    await screen.findByText('This week');
    expect(screen.queryByText('New update')).not.toBeInTheDocument();
    // The mock clock is fixed, so serve an inbox entry from later than the one the phone saw.
    const nudged: CustomerOrder = {
      ...placed,
      inbox: [{ at: '2026-10-08T09:00:00.000Z', kind: 'nudge', textKey: 'nudge' }, ...placed.inbox],
    };
    server.use(http.get('*/api/orders', () => HttpResponse.json({ orders: [nudged] })));
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('New update')).toBeInTheDocument();
  });

  it('shows a lock with a text label for a locked order, and updates the last status', async () => {
    const placed = await place();
    await setOrderLocked(placed.code, true);
    await setOrderStatus(placed.code, 'confirmed');
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Locked')).toBeVisible();
    expect(screen.getByText('Confirmed')).toBeVisible();
    await waitFor(() => expect(readMyOrders()[0]?.lastStatus).toBe('confirmed'));
  });

  it('shows a load error with retry', async () => {
    await place();
    server.use(
      http.get('*/api/orders', () => new HttpResponse(null, { status: 500 }), { once: true }),
    );
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This week')).toBeVisible();
  });
});

describe('OrderScreen', () => {
  it('shows the code, timeline, lines, total, pickup details and note', async () => {
    await useMenu({ whatsappNumber: NUMBER });
    const placed = await place();
    renderOrder(placed.token);
    expect(await screen.findByTestId('order-code')).toHaveTextContent(
      `${placed.code.slice(0, 3)}-${placed.code.slice(3)}`,
    );
    expect(screen.getByText('QR code (coming later)')).toBeVisible();
    const timeline = screen.getByTestId('timeline');
    expect(timeline).toHaveTextContent('Ordered (now)');
    expect(timeline).toHaveTextContent('Ready for pickup');
    expect(screen.getByText('3× Thin battered tempeh')).toBeVisible();
    expect(screen.getAllByText('$30.00')).toHaveLength(2);
    expect(screen.getByText(/Sat 10 Oct, 2–5 pm · Glen Waverley/)).toBeVisible();
    expect(screen.getByText('Note: No chilli')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change order' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeVisible();
  });

  it('moves the timeline when the seller confirms, and polls for it', async () => {
    const placed = await place();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderOrder(placed.token);
      await screen.findByTestId('timeline');
      await setOrderStatus(placed.code, 'confirmed');
      await vi.advanceTimersByTimeAsync(15_100);
      await waitFor(() =>
        expect(screen.getByTestId('timeline')).toHaveTextContent('Confirmed (now)'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the nudge, a status, a seller message and minutes from keys, newest first', async () => {
    const placed = await place();
    await setOrderStatus(placed.code, 'confirmed');
    await nudgeOrder(placed.code);
    renderOrder(placed.token);
    const updates = await screen.findByTestId('updates');
    const items = Array.from(updates.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(items[0]).toContain('The seller is waiting for your order number on WhatsApp.');
    expect(items[1]).toContain('Your order is confirmed');
    expect(items[2]).toContain('Order placed');
  });

  it('shows the returning nudge text, and falls back for an unknown key', async () => {
    const placed = await place();
    const order: CustomerOrder = {
      ...placed,
      inbox: [
        { at: '2026-10-07T12:00:00.000Z', kind: 'nudge', textKey: 'nudgeReturning' },
        { at: '2026-10-07T11:00:00.000Z', kind: 'message', text: 'See you at 2!' },
        { at: '2026-10-07T10:30:00.000Z', kind: 'nudge', textKey: 'readyIn', minutes: 20 },
        { at: '2026-10-07T10:15:00.000Z', kind: 'nudge', textKey: 'brandNew' },
      ],
    };
    server.use(http.get('*/api/orders/:token', () => HttpResponse.json({ order })));
    renderOrder(placed.token);
    const updates = await screen.findByTestId('updates');
    expect(updates).toHaveTextContent('Sending it on WhatsApp is optional');
    expect(updates).toHaveTextContent('See you at 2!');
    expect(updates).toHaveTextContent('Ready in about 20 minutes.');
    expect(updates).toHaveTextContent('Update from the seller');
  });

  it('marks the inbox as seen on view', async () => {
    const placed = await place();
    const later = '2026-10-08T09:00:00.000Z';
    const nudged: CustomerOrder = {
      ...placed,
      inbox: [{ at: later, kind: 'nudge', textKey: 'nudge' }, ...placed.inbox],
    };
    server.use(http.get('*/api/orders/:token', () => HttpResponse.json({ order: nudged })));
    expect(readMyOrders()[0]?.lastSeenInboxAt).toBe(placed.inbox[0]?.at);
    renderOrder(placed.token);
    await screen.findByTestId('updates');
    await waitFor(() => expect(readMyOrders()[0]?.lastSeenInboxAt).toBe(later));
  });

  it('hides Change and Cancel and shows the locked banner when the seller has locked it', async () => {
    const placed = await place();
    await setOrderLocked(placed.code, true);
    renderOrder(placed.token);
    expect(
      await screen.findByText(
        'The seller has locked this order. Message them on WhatsApp to change it.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to seller on WhatsApp' })).toBeVisible();
  });

  it('shows "Changes closed at the cut-off" instead of Change and Cancel when ordering is closed', async () => {
    await useMenu({ ordering: { open: false, reason: 'cutoff_passed' } });
    const placed = await place();
    renderOrder(placed.token);
    expect(
      await screen.findByRole('button', { name: 'Changes closed at the cut-off' }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
  });

  it('shows the ready banner and no Change once the order is ready for pickup', async () => {
    const placed = await place();
    await setOrderStatus(placed.code, 'confirmed');
    await setOrderStatus(placed.code, 'ready_for_pickup');
    renderOrder(placed.token);
    expect(await screen.findByText(/Ready! Pick up Sat 10 Oct, 2–5 pm/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
  });

  it('hands the token to the Change callback', async () => {
    const placed = await place();
    const onChange = vi.fn();
    renderOrder(placed.token, onChange);
    fireEvent.click(await screen.findByRole('button', { name: 'Change order' }));
    expect(onChange).toHaveBeenCalledWith(placed.token);
  });

  it('cancels on the second tap only', async () => {
    const placed = await place();
    renderOrder(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(screen.getByTestId('timeline')).not.toHaveTextContent('Cancelled');
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to cancel' }));
    await waitFor(() => expect(screen.getByTestId('timeline')).toHaveTextContent('Cancelled'));
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
    expect(readMyOrders()[0]?.lastStatus).toBe('cancelled');
  });

  it('shows a cancel error inline', async () => {
    const placed = await place();
    server.use(
      http.post('*/api/orders/:token/cancel', () =>
        HttpResponse.json({ error: 'order_locked', message: 'no' }, { status: 409 }),
      ),
    );
    renderOrder(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to cancel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The seller has locked this order');
  });

  it('shows a load error with retry', async () => {
    const placed = await place();
    server.use(
      http.get('*/api/orders/:token', () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    renderOrder(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('order-code')).toBeVisible();
  });

  describe('WhatsApp', () => {
    it('opens the seller chat when the number is known (EN)', async () => {
      await useMenu({ whatsappNumber: NUMBER });
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const placed = await place('en');
      renderOrder(placed.token);
      fireEvent.click(await screen.findByRole('button', { name: 'Send to seller on WhatsApp' }));
      const url = decodeURIComponent(String(open.mock.calls[0]?.[0]));
      expect(url.startsWith(`https://wa.me/${NUMBER}?text=Hi, my order is `)).toBe(true);
      expect(url).toContain('3× Thin battered tempeh');
      expect(url).toContain('Pickup Sat 10 Oct, 2–5 pm');
    });

    it('opens the chat picker without a number, in Indonesian for an Indonesian order', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const placed = await place('id');
      renderOrder(placed.token);
      fireEvent.click(await screen.findByRole('button', { name: 'Send to seller on WhatsApp' }));
      const url = decodeURIComponent(String(open.mock.calls[0]?.[0]));
      expect(url.startsWith('https://wa.me/?text=Halo, pesanan saya ')).toBe(true);
      expect(url).toContain('3× Tempe mendoan');
    });

    it('speaks Indonesian when the language is switched', async () => {
      const placed = await place('id');
      renderOrder(placed.token);
      await screen.findByTestId('order-code');
      fireEvent.click(screen.getByRole('radio', { name: 'ID' }));
      expect(
        await screen.findByRole('button', { name: 'Kirim ke penjual lewat WhatsApp' }),
      ).toBeVisible();
      expect(screen.getByText('Kabar terbaru')).toBeVisible();
    });
  });
});
