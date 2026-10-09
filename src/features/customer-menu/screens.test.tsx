import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { BasketScreen } from './BasketScreen';
import { quantitySet } from './customerSlice';
import { OrderPlacedScreen } from './OrderPlacedScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import i18n from 'i18next';

const noop = () => undefined;

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

async function basketStore() {
  const store = createTestStore();
  const onPlaced = vi.fn();
  const onBack = vi.fn();
  renderWithStore(<BasketScreen slug="onde-onde" onBack={onBack} onPlaced={onPlaced} />, store);
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
  await screen.findByText('Thin battered tempeh');
  return { store, onPlaced, onBack };
}

describe('BasketScreen', () => {
  it('shows lines with totals and the cut-off line', async () => {
    await basketStore();
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Place order · $20.00' })).toBeInTheDocument();
    expect(screen.getByText('You can change or cancel until Fri 9 Oct, 9 pm')).toBeInTheDocument();
    expect(
      screen.getByText(/Allergies or requests\. Don't add your address, phone/),
    ).toBeInTheDocument();
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('shows the WhatsApp address note only for Delivery', async () => {
    await basketStore();
    expect(
      screen.queryByText(/send your address to the seller on WhatsApp/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByText(/send your address to the seller on WhatsApp/)).toBeInTheDocument();
  });

  it('requires a first name and does not call the API without one', async () => {
    const { store } = await basketStore();
    fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
    expect(await screen.findByText('Please enter your first name')).toBeInTheDocument();
    expect(store.getState().customer.place.status).toBe('idle');
  });

  it('caps the name at 40 and the note at 200 characters', async () => {
    await basketStore();
    expect(screen.getByLabelText(/Your first name/)).toHaveAttribute('maxlength', '40');
    expect(screen.getByLabelText(/Note for the seller/)).toHaveAttribute('maxlength', '200');
  });

  it('places the order and calls onPlaced with the token', async () => {
    const { onPlaced } = await basketStore();
    fireEvent.change(screen.getByLabelText(/Your first name/), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledTimes(1));
    expect(onPlaced.mock.calls[0]?.[0]).toEqual(expect.any(String));
  });

  it.each([
    ['sold_out', /just sold out/],
    ['exceeds_remaining', /fewer portions left/],
    ['cutoff_passed', /orders for this menu are closed/],
  ] as const)('shows %s inline and keeps the basket', async (code, text) => {
    server.use(
      http.post('*/api/s/onde-onde/orders', () =>
        HttpResponse.json({ error: code, message: 'x' }, { status: 409 }),
      ),
    );
    const { store, onPlaced } = await basketStore();
    fireEvent.change(screen.getByLabelText(/Your first name/), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(store.getState().customer.basket).toEqual({ 'tempe-mendoan': 2 });
    expect(onPlaced).not.toHaveBeenCalled();
  });

  it('goes back when the last item is removed', async () => {
    const { onBack } = await basketStore();
    const less = screen.getByRole('button', { name: 'Remove one Thin battered tempeh' });
    fireEvent.click(less);
    fireEvent.click(screen.getByRole('button', { name: 'Remove one Thin battered tempeh' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('OrderPlacedScreen', () => {
  async function placedOrder(language: 'en' | 'id', fulfilment: 'pickup' | 'delivery') {
    const response = await fetch('/api/s/onde-onde/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Rina',
        language,
        fulfilment,
        note: 'No chilli',
        lines: [
          { itemId: 'lemper', qty: 2 },
          { itemId: 'tempe-mendoan', qty: 1 },
        ],
      }),
    });
    return ((await response.json()) as { order: CustomerOrder }).order;
  }

  it('shows the code, summary, note and the WhatsApp button that opens the pre-filled text', async () => {
    const order = await placedOrder('en', 'pickup');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderWithStore(<OrderPlacedScreen token={order.token} onChange={noop} />);
    const code = await screen.findByTestId('order-code');
    expect(code).toHaveTextContent(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    expect(screen.getByText('2× Chicken lemper')).toBeInTheDocument();
    expect(screen.getByText('Note: No chilli')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Turn on updates/ })).toBeDisabled();
    expect(screen.getByText('Saved in My orders on this phone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send to seller on WhatsApp' }));
    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.slice('https://wa.me/?text='.length));
    expect(text).toContain(`my order is ${code.textContent}`);
    expect(text).toContain('2× Chicken lemper, 1× Thin battered tempeh');
    expect(text).toContain('Total $30.00');
    expect(text).toContain('Name: Rina');
    expect(text).not.toContain('No chilli');
  });

  it('shows an error with retry for an unknown token', async () => {
    renderWithStore(<OrderPlacedScreen token="nope" onChange={noop} />);
    expect(await screen.findByText('Could not load your order.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('WhatsApp text', () => {
  it('is in Indonesian for an Indonesian order, with the address ask for delivery', async () => {
    await setupI18n('en');
    const order = await (async () => {
      const response = await fetch('/api/s/onde-onde/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Rina',
          language: 'id',
          fulfilment: 'delivery',
          note: 'rahasia',
          lines: [{ itemId: 'lemper', qty: 2 }],
        }),
      });
      return ((await response.json()) as { order: CustomerOrder }).order;
    })();
    const text = buildWhatsAppText(order, i18n.getFixedT('id', 'customer'), null);
    expect(text).toMatch(
      /^Halo, pesanan saya [A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}: 2× Lemper ayam\./,
    );
    expect(text).toContain('Total $20.00. Diantar. Nama: Rina.');
    expect(text.endsWith('Alamat saya:')).toBe(true);
    expect(text).not.toContain('rahasia');
    expect(whatsAppUrl(text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
  });
});
