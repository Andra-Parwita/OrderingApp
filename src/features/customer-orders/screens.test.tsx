import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { placeOrder, nudgeOrder, setOrderLocked, setOrderStatus } from '../../api/client';
import { MY_ORDERS_KEY, readMyOrders, saveMyOrder } from '../../api/device/myOrders';
import { MyOrdersScreen } from './MyOrdersScreen';
import { OrderScreen } from './OrderScreen';
import { listFailed } from './slice';
import { renderWithStore, setupI18n } from './testSupport';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';

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
  const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
  const next: MenuResponse = {
    ...body,
    kitchen: {
      ...body.kitchen,
      ...(patch.whatsappNumber ? { whatsappNumber: patch.whatsappNumber } : {}),
    },
    ordering: patch.ordering ?? body.ordering,
  };
  server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json(next)));
}

async function place(language: 'en' | 'id' = 'en'): Promise<CustomerOrder> {
  const result = await placeOrder(DEFAULT_SELLER_SLUG, {
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
    expect(await screen.findByText('Your orders will appear here')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Go to the menu' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('lists a saved order in "Current" with status, summary, fulfilment and total', async () => {
    const placed = await place();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Current')).toBeVisible();
    const row = screen.getByRole('button', { name: new RegExp(placed.code.slice(0, 3)) });
    expect(row).toHaveTextContent('Ordered');
    expect(row).toHaveTextContent('3× Thin battered tempeh');
    await waitFor(() => expect(row).toHaveTextContent('Sat 10 Oct · Pickup')); // after the menu loads
    expect(row).toHaveTextContent('$30.00');
    expect(screen.getByText(/Saved on this phone only. No account./)).toBeVisible();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
  });

  it('shows the seller name on each order across sellers', async () => {
    const onde = await place();
    const demo = await placeOrder('dapur-demo', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'es-teh', qty: 1 }],
    });
    if (!demo.ok) throw new Error('could not place the sample order');
    saveMyOrder(demo.data.order);
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    await screen.findByText('Current');
    expect(
      screen.getByRole('button', { name: new RegExp(`${onde.code.slice(0, 3)}.*Onde Onde`) }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: new RegExp(`${demo.data.order.code.slice(0, 3)}.*Dapur Demo`),
      }),
    ).toBeVisible();
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
    expect(await screen.findByText(/Not saved on this phone/)).toBeVisible();
    expect(onOpenOrder).not.toHaveBeenCalled();
  });

  it('opens a saved code with the Open button, and says so for one that is not valid', async () => {
    const placed = await place();
    const onOpenOrder = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={onOpenOrder} />);
    const field = await screen.findByLabelText('Order code');
    fireEvent.change(field, { target: { value: 'k7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText(/Not saved on this phone/)).toBeVisible();
    fireEvent.change(field, { target: { value: placed.code.slice(0, 5) } });
    expect(screen.queryByText(/Not saved on this phone/)).not.toBeInTheDocument();
    expect(onOpenOrder).not.toHaveBeenCalled();
  });

  it('shows an unseen-update dot with text only when the inbox is newer than last seen', async () => {
    const placed = await place();
    // Look at this order's own row: a request still in flight from an earlier test can add rows.
    const rowName = new RegExp(`${placed.code.slice(0, 3)}-${placed.code.slice(3)}`);
    const first = renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    const before = await within(first.container).findByRole('button', { name: rowName });
    expect(before).not.toHaveTextContent('New update');
    // The mock clock is fixed, so serve an inbox entry from later than the one the phone saw.
    const nudged: CustomerOrder = {
      ...placed,
      inbox: [{ at: '2026-10-08T09:00:00.000Z', kind: 'nudge', textKey: 'nudge' }, ...placed.inbox],
    };
    server.use(http.get('*/api/orders', () => HttpResponse.json({ orders: [nudged] })));
    const second = renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    await waitFor(() =>
      expect(within(second.container).getByRole('button', { name: rowName })).toHaveTextContent(
        'New update',
      ),
    );
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
    expect(await screen.findByText('Current')).toBeVisible();
  });

  it('keeps the last loaded orders and says "You\'re offline" when a refresh fails', async () => {
    await place();
    const { store } = renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Current')).toBeVisible();
    store.dispatch(listFailed('network'));
    expect(await screen.findByText("You're offline.")).toBeVisible();
    expect(screen.getByText('Current')).toBeVisible();
    // Try again loads them afresh and the note goes.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText("You're offline.")).not.toBeInTheDocument());
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
    expect(screen.getByTestId('order-code')).toHaveAttribute(
      'aria-label',
      `${placed.code.slice(0, 3).split('').join(' ')}, ${placed.code.slice(3).split('').join(' ')}`,
    );
    expect(screen.getByRole('button', { name: 'Show QR code' })).toBeVisible();
    const timeline = screen.getByTestId('timeline');
    expect(within(timeline).getByText('Ordered')).toHaveAttribute('aria-current', 'step');
    expect(within(timeline).getByText('Ready')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('3 × Thin battered tempeh')).toBeVisible();
    expect(screen.getAllByText('$30.00')).toHaveLength(2);
    expect(screen.getByText('Glen Waverley · 2–5 pm')).toBeVisible();
    expect(screen.getByText('No chilli')).toBeVisible();
    expect(screen.getByText('Rina')).toBeVisible();
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
        expect(within(screen.getByTestId('timeline')).getByText('Confirmed')).toHaveAttribute(
          'aria-current',
          'step',
        ),
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
    expect(updates).toHaveTextContent('Ready in 20 min');
    expect(updates).toHaveTextContent('Update from the seller');
  });

  const SATURDAY_KEYS: ReadonlyArray<{ key: string; minutes?: number; en: string; id: string }> = [
    { key: 'readyIn', minutes: 15, en: 'Ready in 15 min', id: 'Siap dalam 15 menit' },
    {
      key: 'ready',
      en: 'Ready for pickup at Glen Waverley',
      id: 'Siap diambil di Glen Waverley',
    },
    {
      key: 'arrived',
      en: 'The seller has arrived at the pickup point.',
      id: 'Penjual sudah tiba di tempat pengambilan.',
    },
    { key: 'arrivingIn', minutes: 20, en: 'Arriving in 20 min', id: 'Tiba dalam 20 menit' },
    { key: 'arrivingSoon', en: 'Arriving soon', id: 'Segera tiba' },
    { key: 'outForDelivery', en: 'Out for delivery', id: 'Sedang diantar' },
    { key: 'delivered', en: 'Delivered', id: 'Sudah diterima' },
    { key: 'collected', en: 'Collected', id: 'Sudah diambil' },
  ];

  it.each(['en', 'id'] as const)(
    'shows every Saturday message and a custom text as written (%s)',
    async (lang) => {
      const placed = await place();
      const order: CustomerOrder = {
        ...placed,
        inbox: [
          { at: '2026-10-10T11:00:00.000Z', kind: 'message', text: 'Parking is behind the shop' },
          ...SATURDAY_KEYS.map((entry, index) => ({
            at: `2026-10-10T10:0${String(index)}:00.000Z`,
            kind: 'message' as const,
            textKey: entry.key,
            ...(entry.minutes !== undefined ? { minutes: entry.minutes } : {}),
          })),
        ],
      };
      server.use(http.get('*/api/orders/:token', () => HttpResponse.json({ order })));
      await i18n.changeLanguage(lang);
      renderOrder(placed.token);
      const updates = await screen.findByTestId('updates');
      expect(updates).toHaveTextContent('Parking is behind the shop');
      for (const entry of SATURDAY_KEYS) expect(updates).toHaveTextContent(entry[lang]);
      expect(updates).not.toHaveTextContent(/Update from the seller|Kabar dari penjual/);
    },
  );

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
    expect(screen.getByRole('button', { name: /Message .* on WhatsApp/ })).toBeVisible();
  });

  it('shows "Changes closed at the cut-off" instead of Change and Cancel when ordering is closed', async () => {
    await useMenu({ ordering: { open: false, reason: 'cutoff_passed' } });
    const placed = await place();
    renderOrder(placed.token);
    expect(await screen.findByText('Changes closed at the cut-off.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
  });

  it('shows the ready banner and no Change once the order is ready for pickup', async () => {
    const placed = await place();
    await setOrderStatus(placed.code, 'confirmed');
    await setOrderStatus(placed.code, 'ready_for_pickup');
    renderOrder(placed.token);
    expect(await screen.findByText(/Ready! Pick up at Glen Waverley/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
  });

  it('offers "I\'ve collected my order" only when ready, asks once, then moves to Collected', async () => {
    const placed = await place();
    renderOrder(placed.token);
    await screen.findByTestId('order-code');
    expect(
      screen.queryByRole('button', { name: "I've collected my order" }),
    ).not.toBeInTheDocument();
    cleanup();
    await setOrderStatus(placed.code, 'confirmed');
    await setOrderStatus(placed.code, 'ready_for_pickup');
    renderOrder(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: "I've collected my order" }));
    expect(await screen.findByText('Mark as collected?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I collected it' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: "I've collected my order" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Collected/).length).toBeGreaterThan(0);
  });

  it('hands the token to the Change callback', async () => {
    const placed = await place();
    const onChange = vi.fn();
    renderOrder(placed.token, onChange);
    fireEvent.click(await screen.findByRole('button', { name: 'Change order' }));
    expect(onChange).toHaveBeenCalledWith(placed.token);
  });

  it('asks in a sheet first, and cancels only on "Yes, cancel my order"', async () => {
    const placed = await place();
    renderOrder(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveTextContent("You can't undo this.");
    fireEvent.click(screen.getByRole('button', { name: 'Keep my order' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel my order' }));
    expect(await screen.findByText('This order was cancelled.')).toBeVisible();
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
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel my order' }));
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
      fireEvent.click(await screen.findByRole('button', { name: /Message .* on WhatsApp/ }));
      const url = decodeURIComponent(String(open.mock.calls[0]?.[0]));
      expect(url.startsWith(`https://wa.me/${NUMBER}?text=Hi, my order is `)).toBe(true);
      expect(url).toContain('3× Thin battered tempeh');
      expect(url).toContain('Pickup Sat 10 Oct, 2–5 pm');
    });

    it('opens the chat picker without a number, in Indonesian for an Indonesian order', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const placed = await place('id');
      renderOrder(placed.token);
      fireEvent.click(await screen.findByRole('button', { name: /Message .* on WhatsApp/ }));
      const url = decodeURIComponent(String(open.mock.calls[0]?.[0]));
      expect(url.startsWith('https://wa.me/?text=Halo, pesanan saya ')).toBe(true);
      expect(url).toContain('3× Tempe mendoan');
    });

    it('speaks Indonesian when the phone language is Indonesian', async () => {
      const placed = await place('id');
      await i18n.changeLanguage('id');
      renderOrder(placed.token);
      expect(
        await screen.findByRole('button', { name: /Kirim pesan ke .* lewat WhatsApp/ }),
      ).toBeVisible();
      expect(screen.getByText('Kabar dari penjual')).toBeVisible();
    });
  });
});
