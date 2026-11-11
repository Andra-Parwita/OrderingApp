import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { quantitySet } from './customerSlice';
import { OrderPlacedScreen } from './OrderPlacedScreen';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';
import { FIRST_NAME_KEY } from '../../api/device/firstName';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import i18n from 'i18next';

const noop = () => undefined;

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  localStorage.removeItem(FIRST_NAME_KEY);
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

async function basketStore() {
  const store = createTestStore();
  const onPlaced = vi.fn();
  const onBack = vi.fn();
  renderWithStore(<CheckoutFlow slug="onde-onde" onBack={onBack} onPlaced={onPlaced} />, store);
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
  await screen.findByText('Thin battered tempeh');
  return { store, onPlaced, onBack };
}

const toName = () => fireEvent.click(screen.getByRole('button', { name: /^Next: your name/ }));

describe('BasketScreen', () => {
  it('shows lines with line totals, the total and the pinned Next button', async () => {
    await basketStore();
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next: your name/ })).toBeEnabled();
  });

  it('shows the WhatsApp address note only for Delivery', async () => {
    await basketStore();
    expect(
      screen.queryByText(/send your address to the seller on WhatsApp/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByText(/send your address to the seller on WhatsApp/)).toBeInTheDocument();
  });

  it('shows the helpers on the name page, without the change-or-cancel line (plan 129)', async () => {
    await basketStore();
    toName();
    expect(screen.getByRole('heading', { name: 'Your name' })).toBeVisible();
    expect(screen.getByText('Place order & send on WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText(/You can change or cancel until/)).not.toBeInTheDocument();
    expect(screen.getByText('Only your first name or a nickname')).toBeInTheDocument();
    expect(
      screen.getByText("Allergies or requests. Please don't write your phone number here."),
    ).toBeInTheDocument();
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('prefills the first name saved on this phone, still editable', async () => {
    localStorage.setItem(FIRST_NAME_KEY, 'Lenny');
    await basketStore();
    toName();
    const input = screen.getByLabelText('First name');
    expect(input).toHaveValue('Lenny');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
  });

  it('requires a first name and does not call the API without one', async () => {
    const { store } = await basketStore();
    toName();
    fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
    expect(await screen.findByText('Please enter your first name')).toBeInTheDocument();
    expect(store.getState().customer.place.status).toBe('idle');
  });

  it('caps the name at 40 and the note at 200 characters', async () => {
    await basketStore();
    toName();
    expect(screen.getByLabelText('First name')).toHaveAttribute('maxlength', '40');
    expect(screen.getByLabelText(/^Note/)).toHaveAttribute('maxlength', '200');
  });

  it('keeps what was typed when going back and on again', async () => {
    await basketStore();
    toName();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Basket' }));
    toName();
    expect(screen.getByLabelText('First name')).toHaveValue('Rina');
  });

  it('places the order and calls onPlaced with the token', async () => {
    const { onPlaced } = await basketStore();
    toName();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledTimes(1));
    expect(onPlaced.mock.calls[0]?.[0]).toEqual(expect.any(String));
  });

  it.each([
    ['sold_out', /Something changed/],
    ['exceeds_remaining', /Something changed/],
    ['cutoff_passed', /are closed/],
  ] as const)(
    '%s sends the customer back to the basket with a banner and keeps it',
    async (code, text) => {
      server.use(
        http.post('*/api/s/onde-onde/orders', () =>
          HttpResponse.json({ error: code, message: 'x' }, { status: 409 }),
        ),
      );
      const { store, onPlaced } = await basketStore();
      toName();
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
      fireEvent.click(screen.getByRole('button', { name: /Place order/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.getByRole('button', { name: /^Next: your name/ })).toBeInTheDocument();
      expect(store.getState().customer.basket).toEqual({ 'tempe-mendoan': 2 });
      expect(onPlaced).not.toHaveBeenCalled();
    },
  );

  it('a failed menu load shows Try again, which reloads the menu', async () => {
    server.use(
      http.get('*/api/s/onde-onde/menu', () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const store = createTestStore();
    renderWithStore(<CheckoutFlow slug="onde-onde" />, store);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the menu');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  });

  it('goes back when the last item is removed', async () => {
    const { onBack } = await basketStore();
    fireEvent.click(screen.getByRole('button', { name: 'Remove one Thin battered tempeh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Thin battered tempeh' }));
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
    expect(code).toHaveAttribute('aria-label', expect.stringMatching(/^. . ., . . .$/));
    expect(screen.getByRole('button', { name: /Show QR code/ })).toBeEnabled();
    expect(screen.getByText('Saved in My orders on this phone.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Send to .* on WhatsApp/ }));
    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    const text = decodeURIComponent(url.slice('https://api.whatsapp.com/send?text='.length));
    expect(text).toContain(`my order is ${code.textContent}`);
    expect(text).toContain('2× Chicken lemper, 1× Thin battered tempeh');
    expect(text).toContain('Total $30.00');
    expect(text).toContain('Name: Rina');
    expect(text).not.toContain('No chilli');
  });

  it('says "Almost done" and asks to send it on WhatsApp while unconfirmed (plan 129)', async () => {
    const order = await placedOrder('en', 'pickup');
    renderWithStore(<OrderPlacedScreen token={order.token} onChange={noop} />);
    expect(await screen.findByRole('heading', { name: 'Almost done' })).toBeVisible();
    expect(screen.getByText('Your order is saved, but not sent yet.')).toBeVisible();
    const note = screen.getByTestId('send-note');
    expect(note).toHaveTextContent(
      /^Send it to .* on WhatsApp\. .* doesn't have your number, so they can only confirm your order after your message\.$/,
    );
    expect(note).not.toHaveTextContent('she');
    expect(screen.getByRole('button', { name: /Send to .* on WhatsApp/ })).toBeVisible();
    expect(screen.queryByText(/is optional/)).not.toBeInTheDocument();
    expect(screen.queryByText(/You can change or cancel until/)).not.toBeInTheDocument();
  });

  it('has no "optional" line even for a returning customer, and is in Indonesian (plan 129)', async () => {
    localStorage.setItem(
      'myOrders',
      JSON.stringify([
        { code: 'AAAAAA', token: 'old', placedAt: '2026-09-01T00:00:00Z', lastStatus: 'collected' },
      ]),
    );
    const order = await placedOrder('id', 'pickup');
    await i18n.changeLanguage('id');
    renderWithStore(<OrderPlacedScreen token={order.token} onChange={noop} />);
    expect(await screen.findByRole('heading', { name: 'Hampir selesai' })).toBeVisible();
    expect(screen.getByText('Pesanan Anda sudah tersimpan, tetapi belum terkirim.')).toBeVisible();
    expect(screen.queryByText(/opsional/)).not.toBeInTheDocument();
    localStorage.removeItem('myOrders');
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
    expect(whatsAppUrl(text)).toBe(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    );
  });

  it('asks for the address on WhatsApp only when the app does not hold one (plan 071)', () => {
    const base = {
      id: '1',
      code: 'K7M2QX',
      token: 't',
      firstName: 'Rina',
      language: 'en',
      lines: [
        {
          itemId: 'a',
          name: { en: 'Lemper', id: 'Lemper' },
          size: { en: '', id: '' },
          priceCents: 1000,
          qty: 1,
        },
      ],
      fulfilment: 'delivery',
      status: 'ordered',
      locked: false,
      inbox: [],
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
      paid: false,
      seller: { slug: 'onde-onde', name: 'Onde Onde' },
    } as unknown as CustomerOrder;
    const t = i18n.getFixedT('en', 'customer');
    expect(buildWhatsAppText(base, t, null)).toContain('My address:');
    expect(buildWhatsAppText({ ...base, addressState: 'saved' }, t, null)).not.toContain(
      'My address:',
    );
    expect(buildWhatsAppText({ ...base, addressState: 'unreadable' }, t, null)).toContain(
      'My address:',
    );
  });
});
