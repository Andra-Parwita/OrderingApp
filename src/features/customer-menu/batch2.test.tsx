import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { placeOrder, fetchOrder, setOrderLocked } from '../../api/client';
import { MY_ORDERS_KEY, readMyOrders, saveMyOrder } from '../../api/device/myOrders';
import { BasketScreen } from './BasketScreen';
import { menuRequested, placeRequested, quantitySet } from './customerSlice';
import { MenuScreen } from './MenuScreen';
import { OrderPlacedScreen } from './OrderPlacedScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';

const noop = () => undefined;
const NUMBER = '61412345678';

beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

/** The menu as the mock API serves it, with a patch (WhatsApp number, ordering state). */
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

async function placeSample(qty = 1) {
  const result = await placeOrder(DEFAULT_SELLER_SLUG, {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    note: 'No chilli',
    lines: [{ itemId: 'lemper', qty }],
  });
  if (!result.ok) throw new Error('could not place the sample order');
  return result.data.order;
}

describe('How ordering works', () => {
  it('names the kitchen and its WhatsApp number in step 3', async () => {
    await useMenu({ whatsappNumber: NUMBER });
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    await screen.findByText('How ordering works');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    const number = screen.getByText('+61 412 345 678');
    expect(number.closest('li')).toHaveTextContent(
      'Send that number to Onde Onde on WhatsApp (+61 412 345 678).',
    );
    // The number never wraps mid-number.
    expect(number).toHaveStyle({ whiteSpace: 'nowrap' });
  });

  it('falls back to "the seller" without a number, and speaks Indonesian', async () => {
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    expect(await screen.findByText('Send that number to the seller on WhatsApp.')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: 'ID' }));
    expect(await screen.findByText('Cara memesan')).toBeVisible();
    expect(screen.getByText('Kirim nomor itu ke penjual lewat WhatsApp.')).toBeVisible();
  });
});

describe('closed ordering', () => {
  it.each([
    ['cutoff_passed', 'The order cut-off has passed.'],
    ['closed_by_seller', 'The seller has paused ordering for now.'],
  ] as const)('shows the closed state for %s and hides the basket bar', async (reason, line) => {
    await useMenu({ ordering: { open: false, reason }, whatsappNumber: NUMBER });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const store = createTestStore();
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />, store);
    expect(await screen.findByText('Orders for this Saturday are closed')).toBeVisible();
    expect(screen.getByText(line)).toBeVisible();
    // A basket left from before does not bring the bar back.
    store.dispatch(quantitySet({ itemId: 'lemper', qty: 2 }));
    expect(screen.queryByRole('button', { name: /View basket/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one Chicken lemper' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Message seller on WhatsApp' }));
    expect(open).toHaveBeenCalledWith(`https://wa.me/${NUMBER}`, '_blank', 'noopener,noreferrer');
  });

  it('opens the WhatsApp chat picker when the number is not known', async () => {
    await useMenu({ ordering: { open: false, reason: 'closed_by_seller' } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Message seller on WhatsApp' }));
    expect(open).toHaveBeenCalledWith('https://wa.me/', '_blank', 'noopener,noreferrer');
  });
});

describe('returning customer', () => {
  async function placeAndCaptureBody(slug = 'onde-onde') {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`*/api/s/${slug}/orders`, async ({ request }) => {
        body = (await request.clone().json()) as Record<string, unknown>;
        return undefined;
      }),
    );
    const store = createTestStore();
    store.dispatch(menuRequested(slug));
    await vi.waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
    store.dispatch(quantitySet({ itemId: slug === 'onde-onde' ? 'lemper' : 'es-teh', qty: 1 }));
    store.dispatch(
      placeRequested({ firstName: 'Rina', language: 'en', fulfilment: 'pickup', note: '' }),
    );
    await vi.waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    return body;
  }

  it('sends returning: true when My orders holds a collected or delivered order', async () => {
    const earlier = await placeSample();
    saveMyOrder({ ...earlier, status: 'collected' });
    expect((await placeAndCaptureBody())['returning']).toBe(true);
  });

  it('is per seller: an order collected from one seller does not make a customer of another', async () => {
    const earlier = await placeSample();
    saveMyOrder({ ...earlier, status: 'collected' });
    expect('returning' in (await placeAndCaptureBody('dapur-demo'))).toBe(false);
  });

  it('sends nothing for a first-time customer or one with only open orders', async () => {
    saveMyOrder(await placeSample());
    expect('returning' in (await placeAndCaptureBody())).toBe(false);
  });

  it('marks WhatsApp as optional on the order-placed screen', async () => {
    const earlier = await placeSample();
    saveMyOrder({ ...earlier, status: 'delivered' });
    const current = await placeSample();
    renderWithStore(<OrderPlacedScreen token={current.token} onChange={noop} />);
    expect(
      await screen.findByText('You have ordered before, so sending this on WhatsApp is optional.'),
    ).toBeVisible();
  });

  it('does not say optional to a first-time customer', async () => {
    const current = await placeSample();
    renderWithStore(<OrderPlacedScreen token={current.token} onChange={noop} />);
    await screen.findByText('Send to seller on WhatsApp');
    expect(screen.queryByText(/optional/)).not.toBeInTheDocument();
  });

  it('opens the seller chat with the order text when the number is known', async () => {
    await useMenu({ whatsappNumber: NUMBER });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const current = await placeSample();
    renderWithStore(<OrderPlacedScreen token={current.token} onChange={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to seller on WhatsApp' }));
    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith(`https://wa.me/${NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain('1× Chicken lemper');
  });
});

describe('basket edit mode', () => {
  function renderEdit(token: string, onUpdated: (token: string) => void = noop) {
    return renderWithStore(
      <BasketScreen editToken={token} onBack={noop} onPlaced={noop} onUpdated={onUpdated} />,
    );
  }

  it('loads the order lines, offers Update order, and saves a changed quantity', async () => {
    const placed = await placeSample(1);
    const onUpdated = vi.fn();
    renderEdit(placed.token, onUpdated);
    const update = await screen.findByRole('button', { name: 'Update order · $10.00' });
    // The order's own details are loaded; the name is not asked again.
    expect(screen.getByRole('heading', { name: 'Change your order' })).toBeVisible();
    expect(screen.queryByLabelText('Your first name')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/Note for the seller/)).toHaveValue('No chilli'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add one Chicken lemper' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update order · $20.00' }));
    expect(update).toBeDefined();
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(placed.token));
    const after = await fetchOrder(placed.token);
    expect(after.ok && after.data.order.lines[0]?.qty).toBe(2);
    expect(after.ok && after.data.order.note).toBe('No chilli');
  });

  it('keeps the last line: the stepper cannot go to zero', async () => {
    const placed = await placeSample(1);
    renderEdit(placed.token);
    await screen.findByRole('button', { name: 'Update order · $10.00' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove one Chicken lemper' }));
    expect(screen.getByRole('button', { name: 'Update order · $10.00' })).toBeVisible();
  });

  it('shows order_locked inline when the seller has locked the order', async () => {
    const placed = await placeSample(1);
    renderEdit(placed.token);
    await screen.findByRole('button', { name: 'Update order · $10.00' });
    await setOrderLocked(placed.code, true);
    fireEvent.click(screen.getByRole('button', { name: 'Add one Chicken lemper' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update order · $20.00' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The seller has locked this order. Message them on WhatsApp to change it.',
    );
  });

  it.each([
    ['ordering_closed', 'Sorry, ordering is closed right now.'],
    ['cutoff_passed', 'Sorry, orders for this week are closed.'],
  ] as const)('shows %s inline', async (code, text) => {
    const placed = await placeSample(1);
    server.use(
      http.patch('*/api/orders/*', () =>
        HttpResponse.json({ error: code, message: 'no' }, { status: 409 }),
      ),
    );
    renderEdit(placed.token);
    await screen.findByRole('button', { name: 'Update order · $10.00' });
    fireEvent.click(screen.getByRole('button', { name: 'Add one Chicken lemper' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update order · $20.00' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(readMyOrders()).toEqual([]);
  });
});
