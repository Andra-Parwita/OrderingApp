import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { placeOrder, fetchOrder, setOrderLocked } from '../../api/client';
import { MY_ORDERS_KEY, readMyOrders, saveMyOrder } from '../../api/device/myOrders';
import { menuRequested, placeRequested, quantitySet } from './customerSlice';
import { OrderPlacedScreen } from './OrderPlacedScreen';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';
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
    await screen.findByRole('button', { name: /Send to .* on WhatsApp/ });
    expect(screen.queryByText(/optional/)).not.toBeInTheDocument();
  });

  it('opens the seller chat with the order text when the number is known', async () => {
    await useMenu({ whatsappNumber: NUMBER });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const current = await placeSample();
    renderWithStore(<OrderPlacedScreen token={current.token} onChange={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: /Send to .* on WhatsApp/ }));
    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith(`https://wa.me/${NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain('1× Chicken lemper');
  });
});

describe('basket edit mode', () => {
  function renderEdit(token: string, onUpdated: (token: string) => void = noop) {
    return renderWithStore(<CheckoutFlow editToken={token} onUpdated={onUpdated} />);
  }
  const toName = () => fireEvent.click(screen.getByRole('button', { name: /^Next: your name/ }));

  it('loads the order lines, offers Update order, and saves a changed quantity', async () => {
    const placed = await placeSample(1);
    const onUpdated = vi.fn();
    renderEdit(placed.token, onUpdated);
    expect(await screen.findByRole('heading', { name: 'Change your order' })).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Add one Chicken lemper' }));
    toName();
    // The order's own details are loaded; the name is shown but fixed.
    expect(screen.getByRole('heading', { name: 'Change your order' })).toBeVisible();
    expect(screen.getByLabelText('First name')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('First name')).toHaveValue('Rina');
    expect(screen.getByLabelText(/^Note/)).toHaveValue('No chilli');
    fireEvent.click(screen.getByRole('button', { name: /^Update order · / }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(placed.token));
    const after = await fetchOrder(placed.token);
    expect(after.ok && after.data.order.lines[0]?.qty).toBe(2);
    expect(after.ok && after.data.order.note).toBe('No chilli');
  });

  it('keeps the last line: the bin cannot take it out', async () => {
    const placed = await placeSample(1);
    renderEdit(placed.token);
    expect(await screen.findByRole('button', { name: 'Remove Chicken lemper' })).toBeDisabled();
  });

  it('shows order_locked inline when the seller has locked the order', async () => {
    const placed = await placeSample(1);
    renderEdit(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Add one Chicken lemper' }));
    await setOrderLocked(placed.code, true);
    toName();
    fireEvent.click(screen.getByRole('button', { name: /^Update order · / }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The seller has locked this order. Message them on WhatsApp to change it.',
    );
  });

  it.each([
    ['ordering_closed', /Ordering is paused/],
    ['cutoff_passed', /are closed/],
  ] as const)('%s sends the customer back to the basket with a banner', async (code, text) => {
    const placed = await placeSample(1);
    server.use(
      http.patch('*/api/orders/*', () =>
        HttpResponse.json({ error: code, message: 'no' }, { status: 409 }),
      ),
    );
    renderEdit(placed.token);
    fireEvent.click(await screen.findByRole('button', { name: 'Add one Chicken lemper' }));
    toName();
    fireEvent.click(screen.getByRole('button', { name: /^Update order · / }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: /^Next: your name/ })).toBeDisabled();
    expect(readMyOrders()).toEqual([]);
  });
});
