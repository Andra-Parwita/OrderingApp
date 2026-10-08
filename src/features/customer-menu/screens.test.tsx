import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { BasketScreen } from './BasketScreen';
import { quantitySet } from './customerSlice';
import { MenuScreen } from './MenuScreen';
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

async function menuStore() {
  const store = createTestStore();
  renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />, store);
  await screen.findByText('Chicken lemper');
  return store;
}

describe('MenuScreen', () => {
  it('shows the kitchen, the week and the items, with no chef data', async () => {
    await menuStore();
    expect(screen.getByRole('heading', { name: 'Onde Onde' })).toBeInTheDocument();
    expect(screen.getByText('Sat 10 Oct')).toBeInTheDocument();
    expect(screen.getByText('Fri 9 Oct, 9 pm')).toBeInTheDocument();
    expect(screen.getByText('2–5 pm, Glen Waverley')).toBeInTheDocument();
    expect(screen.queryByText(/Chef Wati/)).not.toBeInTheDocument();
    expect(screen.queryByText(/View basket/)).not.toBeInTheDocument();
  });

  it('shows the phone banner with its alt text in the current language', async () => {
    await menuStore();
    const banner = screen.getByRole('img', { name: 'Onde Onde — Indonesian homemade food' });
    expect(banner).toHaveAttribute('src', '/samples/banner-phone.jpg');
    await i18n.changeLanguage('id');
    expect(
      await screen.findByRole('img', { name: 'Onde Onde — masakan rumahan Indonesia' }),
    ).toBeInTheDocument();
  });

  it('falls back to the desktop banner, then to the labelled placeholder', async () => {
    const showMenuWith = (images: unknown) =>
      server.use(
        http.get('*/api/s/onde-onde/menu', () =>
          HttpResponse.json({
            seller: { id: 's1', slug: 'onde-onde', name: 'Delave' },
            kitchen: { sellerId: 's1', name: 'Delave', tagline: { en: 'a', id: 'b' }, images },
            week: {
              cookingDate: '2026-10-10',
              cutoffAt: '2026-10-09T21:00:00+11:00',
              status: 'published',
              pickupPoints: [],
              delivery: { available: false, note: { en: 'a', id: 'b' } },
            },
            items: [],
            ordering: { open: true },
          }),
        ),
      );

    showMenuWith({ desktopBanner: '/samples/banner-wide.jpg' });
    const first = renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    expect(await screen.findByRole('img', { name: 'Delave banner' })).toHaveAttribute(
      'src',
      '/samples/banner-wide.jpg',
    );
    first.unmount();

    showMenuWith(undefined);
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    expect(await screen.findByText('Kitchen photo')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('stops a limited item at its portions left', async () => {
    const store = await menuStore();
    expect(screen.queryByText(/\d+ left/)).not.toBeInTheDocument();
    const more = screen.getByRole('button', { name: 'Add one Chicken lemper' });
    // Limit is 20 minus whatever other tests ordered; drive the slice to the limit.
    const menu = store.getState().customer.menu;
    const remaining =
      menu.status === 'ready'
        ? (menu.data.items.find((i) => i.id === 'lemper')?.remaining ?? 0)
        : 0;
    store.dispatch(quantitySet({ itemId: 'lemper', qty: remaining + 5 }));
    await waitFor(() => expect(more).toBeDisabled());
    expect(store.getState().customer.basket['lemper']).toBe(remaining);
  });

  it('adds items and shows the sticky bar with count and total', async () => {
    await menuStore();
    const lemper = screen.getByRole('button', { name: 'Add one Chicken lemper' });
    fireEvent.click(lemper);
    fireEvent.click(lemper);
    fireEvent.click(screen.getByRole('button', { name: 'Add one Thin battered tempeh' }));
    expect(screen.getByText('3 items · $30.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View basket/ })).toBeInTheDocument();
  });

  it.each([
    [6, false],
    [5, true],
    [1, true],
    [0, false],
  ])('with %i portions remaining, "N left" shown: %s', async (remaining, shown) => {
    const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as {
      items: Array<Record<string, unknown>>;
    };
    const items = body.items.map((item) =>
      item['id'] === 'lemper' ? { ...item, remaining, soldOut: remaining === 0 } : item,
    );
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json({ ...body, items })));
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    await screen.findByText('Chicken lemper');
    const left = screen.queryByText(`${remaining} left`);
    if (shown) expect(left).toBeInTheDocument();
    else expect(left).not.toBeInTheDocument();
  });

  it('disables a sold out item', async () => {
    // Selling out through real orders is slow; stub the menu response instead.
    const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as {
      items: Array<Record<string, unknown>>;
    };
    const items = body.items.map((item) =>
      item['id'] === 'tempe-mendoan' ? { ...item, remaining: 0, soldOut: true, limit: 1 } : item,
    );
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json({ ...body, items })));
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    await screen.findByText('Sold out');
    expect(screen.getByRole('button', { name: 'Add one Thin battered tempeh' })).toBeDisabled();
  });

  it('shows an error with retry, then the menu', async () => {
    server.use(
      http.get('*/api/s/onde-onde/menu', () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Chicken lemper')).toBeInTheDocument();
  });

  it('switches every string and item name to Indonesian', async () => {
    await menuStore();
    fireEvent.click(screen.getByRole('radio', { name: 'ID' }));
    expect(await screen.findByText('Lemper ayam')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ID' })).toBeChecked();
    expect(screen.getByText('Sabtu, 10 Okt')).toBeInTheDocument();
    expect(screen.getByText('Jumat, 9 Okt, 21.00')).toBeInTheDocument();
    expect(screen.getByText('14.00–17.00, Glen Waverley')).toBeInTheDocument();
  });
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
    ['cutoff_passed', /orders for this week are closed/],
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
