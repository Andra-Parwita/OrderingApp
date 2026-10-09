import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import type { Fulfilment, OrderStatus } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { UPDATE_TEXT_MAX } from '../../../shared/updateContract';
import { fetchOrder, fetchSellerOrder, placeOrder, setOrderStatus } from '../../api/client';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DeliveryRunScreen } from './DeliveryRunScreen';
import { HandOverScreen } from './HandOverScreen';
import { registerSellerSaturdayI18n } from './i18n/register';
import { SendUpdateScreen } from './SendUpdateScreen';

type Made = { code: string; token: string; label: string };

/** A real order on the mock, moved along `path` (statuses in order). */
async function make(
  firstName: string,
  fulfilment: Fulfilment,
  path: ReadonlyArray<OrderStatus> = [],
): Promise<Made> {
  const placed = await placeOrder(DEFAULT_SELLER_SLUG, {
    firstName,
    language: 'en',
    fulfilment,
    lines: [{ itemId: 'pesmol', qty: 2 }],
  });
  if (!placed.ok) throw new Error('could not place the order');
  const { code, token } = placed.data.order;
  for (const status of path) {
    const moved = await setOrderStatus(code, status, undefined, DEFAULT_SELLER_SLUG);
    if (!moved.ok) throw new Error(`could not move to ${status}`);
  }
  return { code, token, label: formatOrderCode(code) };
}

async function statusOf(code: string): Promise<OrderStatus> {
  const result = await fetchSellerOrder(code, undefined, DEFAULT_SELLER_SLUG);
  if (!result.ok) throw new Error('order missing');
  return result.data.order.status;
}

async function inboxOf(code: string) {
  const result = await fetchSellerOrder(code, undefined, DEFAULT_SELLER_SLUG);
  if (!result.ok) throw new Error('order missing');
  return result.data.order.inbox;
}

function renderThemed(ui: React.ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerSaturdayI18n();
});
beforeEach(async () => {
  await mockStore.reset();
  localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('HandOverScreen', () => {
  it('shows the date and counts, and keeps scanning disabled with a note', async () => {
    await make('Rina', 'pickup', ['confirmed', 'ready_for_pickup']);
    await make('Tom', 'pickup', ['confirmed', 'ready_for_pickup', 'collected']);
    renderThemed(<HandOverScreen />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Pickup · \w{3} \d+ \w{3}$/ }),
    ).toBeVisible();
    expect(await screen.findByText('Ready 1 · Collected 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Scan label' })).toBeDisabled();
    expect(screen.getByText(/Scanning is coming later/)).toBeVisible();
    expect(screen.getByText(/looks up after the 6th character/)).toBeVisible();
  });

  it('finds an order from a sloppy code on the 6th character and marks it collected', async () => {
    const rina = await make('Rina', 'pickup', ['confirmed', 'ready_for_pickup']);
    renderThemed(<HandOverScreen />);
    const field = await screen.findByLabelText('Type order code');
    const sloppy = `${rina.code.slice(0, 3).toLowerCase()} ${rina.code.slice(3, 5).toLowerCase()}`;
    fireEvent.change(field, { target: { value: sloppy } });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: `${sloppy}${rina.code.slice(5).toLowerCase()}` } });
    const card = await screen.findByRole('article', { name: `Order ${rina.label}` });
    expect(card).toHaveTextContent('Rina');
    expect(card).toHaveTextContent('2×');
    expect(card).toHaveTextContent('Ready for pickup');
    expect(card).toHaveTextContent('Not paid');
    fireEvent.click(within(card).getByRole('button', { name: 'Mark collected' }));
    expect(await screen.findByText(`Rina's order ${rina.label} is collected.`)).toBeVisible();
    expect(await statusOf(rina.code)).toBe('collected');
    await waitFor(() => expect(screen.getByText('Ready 0 · Collected 1')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Next order' }));
    expect(field).toHaveValue('');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('dims Mark collected with a reason when the order is not ready yet', async () => {
    const budi = await make('Budi', 'pickup', ['confirmed']);
    renderThemed(<HandOverScreen />);
    fireEvent.change(await screen.findByLabelText('Type order code'), {
      target: { value: budi.label },
    });
    const card = await screen.findByRole('article', { name: `Order ${budi.label}` });
    expect(within(card).getByRole('button', { name: 'Mark collected' })).toBeDisabled();
    expect(within(card).getByText('Not ready for pickup yet. Mark it ready first.')).toBeVisible();
  });

  it('says so for an unknown code, a malformed code and a delivery order', async () => {
    const dewi = await make('Dewi', 'delivery', ['confirmed']);
    renderThemed(<HandOverScreen />);
    const field = await screen.findByLabelText('Type order code');
    fireEvent.change(field, { target: { value: 'ZZZZZZ' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No order has that code');
    fireEvent.change(field, { target: { value: 'OOOOOO' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('That is not an order code');
    fireEvent.change(field, { target: { value: dewi.label } });
    const card = await screen.findByRole('article', { name: `Order ${dewi.label}` });
    expect(card).toHaveTextContent('This is a delivery order. Use the Delivery run.');
    expect(within(card).queryByRole('button', { name: 'Mark collected' })).not.toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderThemed(<HandOverScreen />);
    expect(await screen.findByLabelText('Ketik kode pesanan')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pindai label' })).toBeDisabled();
    expect(await screen.findByText('Siap 0 · Diambil 0')).toBeVisible();
  });
});

describe('DeliveryRunScreen', () => {
  it('dims the actions that do not fit the status, with a reason', async () => {
    const ani = await make('Ani', 'delivery', ['confirmed']);
    const budi = await make('Budi', 'delivery', ['confirmed', 'out_for_delivery']);
    const citra = await make('Citra', 'delivery');
    await make('Pickup person', 'pickup', ['confirmed']);
    renderThemed(<DeliveryRunScreen />);
    const aniCard = await screen.findByRole('article', { name: `Order ${ani.label}` });
    expect(screen.getByText('3 orders')).toBeVisible();
    expect(screen.queryByText('Pickup person')).not.toBeInTheDocument();
    expect(within(aniCard).getByRole('button', { name: 'Out for delivery' })).toBeEnabled();
    expect(within(aniCard).getByRole('button', { name: 'Arriving soon' })).toBeDisabled();
    expect(within(aniCard).getByRole('button', { name: 'Mark delivered' })).toBeDisabled();
    expect(within(aniCard).getAllByText('Available once it is out for delivery.')).toHaveLength(2);

    const budiCard = screen.getByRole('article', { name: `Order ${budi.label}` });
    expect(within(budiCard).getByRole('button', { name: 'Out for delivery' })).toBeDisabled();
    expect(within(budiCard).getByText('Already out for delivery.')).toBeVisible();
    expect(within(budiCard).getByRole('button', { name: 'Arriving soon' })).toBeEnabled();
    expect(within(budiCard).getByRole('button', { name: 'Mark delivered' })).toBeEnabled();

    const citraCard = screen.getByRole('article', { name: `Order ${citra.label}` });
    expect(within(citraCard).getAllByText('Confirm the order first.')).toHaveLength(3);
    expect(
      screen.getByText('Addresses are in your WhatsApp chats, not in the app (D-007).'),
    ).toBeVisible();
  });

  it('moves an order out, sends arriving soon to the inbox, then marks it delivered', async () => {
    const ani = await make('Ani', 'delivery', ['confirmed']);
    renderThemed(<DeliveryRunScreen />);
    const card = await screen.findByRole('article', { name: `Order ${ani.label}` });
    fireEvent.click(within(card).getByRole('button', { name: 'Out for delivery' }));
    expect(await screen.findByText("Ani's order is out for delivery.")).toBeVisible();
    expect(await statusOf(ani.code)).toBe('out_for_delivery');

    await waitFor(() =>
      expect(within(card).getByRole('button', { name: 'Arriving soon' })).toBeEnabled(),
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Arriving soon' }));
    expect(await screen.findByText('Sent “arriving soon” to Ani.')).toBeVisible();
    expect((await inboxOf(ani.code))[0]).toMatchObject({
      kind: 'message',
      textKey: 'arrivingSoon',
    });
    expect(await statusOf(ani.code)).toBe('out_for_delivery');

    fireEvent.click(within(card).getByRole('button', { name: 'Mark delivered' }));
    expect(await screen.findByText("Ani's order is delivered.")).toBeVisible();
    expect(await statusOf(ani.code)).toBe('delivered');
    await waitFor(() =>
      expect(within(card).getByRole('button', { name: 'Mark delivered' })).toBeDisabled(),
    );
    expect(within(card).getAllByText('Already delivered.').length).toBeGreaterThan(0);
  });

  it('says so when an action fails', async () => {
    const ani = await make('Ani', 'delivery', ['confirmed']);
    server.use(http.post('*/api/seller/orders/:code/status', () => HttpResponse.error()));
    renderThemed(<DeliveryRunScreen />);
    const card = await screen.findByRole('article', { name: `Order ${ani.label}` });
    fireEvent.click(within(card).getByRole('button', { name: 'Out for delivery' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work');
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    const ani = await make('Ani', 'delivery', ['confirmed']);
    renderThemed(<DeliveryRunScreen />);
    const card = await screen.findByRole('article', { name: `Pesanan ${ani.label}` });
    expect(within(card).getByRole('button', { name: 'Sedang diantar' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'Hampir tiba' })).toBeDisabled();
    expect(screen.getByText(/Alamat ada di chat WhatsApp/)).toBeVisible();
  });
});

describe('SendUpdateScreen', () => {
  async function seed() {
    const ani = await make('Ani', 'pickup'); // ordered
    const budi = await make('Budi', 'pickup', ['confirmed']);
    const citra = await make('Citra', 'delivery', ['confirmed']);
    const dewi = await make('Dewi', 'pickup', ['cancelled']);
    return { ani, budi, citra, dewi };
  }

  const sendButton = (count: number) => screen.getByRole('button', { name: `Send to ${count}` });

  it('picks recipients by group, lists open orders only, and can clear', async () => {
    const { dewi } = await seed();
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    expect(
      screen.queryByRole('checkbox', { name: new RegExp(dewi.label) }),
    ).not.toBeInTheDocument();
    expect(sendButton(0)).toBeDisabled();
    expect(screen.getByText('Choose at least one customer.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Pickup' }));
    expect(sendButton(2)).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pickup' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /^Ani / })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Citra / })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Delivery' }));
    expect(sendButton(1)).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'All open' }));
    expect(sendButton(3)).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /^Ani / }));
    expect(sendButton(2)).toBeEnabled();
    expect(screen.getByRole('button', { name: 'All open' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(sendButton(0)).toBeDisabled();
    expect(
      screen.getByText(
        'Every customer sees it in their order. Customers with updates on also get a notification.',
      ),
    ).toBeVisible();
  });

  it('sends "Ready in 45" and also moves the status where it can, then reports it', async () => {
    const { ani, budi, citra } = await seed();
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pickup' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also update the order status' }));
    expect(screen.getByText('Moves each order to “Ready for pickup” where it can.')).toBeVisible();
    fireEvent.click(sendButton(2));

    expect(await screen.findByText('Sent to 2 of 2 customers.')).toBeVisible();
    expect(screen.getByText('Status moved for 1; 1 stayed as they were.')).toBeVisible();
    for (const made of [ani, budi]) {
      const entry = (await inboxOf(made.code)).find((e) => e.textKey === 'readyIn');
      expect(entry).toMatchObject({ kind: 'message', minutes: 45 });
    }
    expect(await statusOf(budi.code)).toBe('ready_for_pickup');
    expect(await statusOf(ani.code)).toBe('ordered');
    expect((await inboxOf(citra.code)).some((e) => e.textKey === 'readyIn')).toBe(false);
    // The selection is cleared once sent.
    expect(sendButton(0)).toBeDisabled();
  });

  it('hides minutes and the status toggle where they do not apply', async () => {
    renderThemed(<SendUpdateScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Arrived at pickup' }));
    expect(screen.queryByRole('button', { name: '15 min' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Also update the order status' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Arriving in…' }));
    expect(screen.getByRole('button', { name: '60 min' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Collected' }));
    expect(screen.getByRole('checkbox', { name: 'Also update the order status' })).toBeVisible();
  });

  it('sends a custom message as written, needs text, and limits it to 200', async () => {
    const { citra } = await seed();
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    fireEvent.click(screen.getByRole('button', { name: 'Custom message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delivery' }));
    expect(sendButton(1)).toBeDisabled();
    const box = screen.getByLabelText('Your message');
    expect(box).toHaveAttribute('maxlength', String(UPDATE_TEXT_MAX));
    expect(screen.getByText(`0/${String(UPDATE_TEXT_MAX)}`)).toBeVisible();
    fireEvent.change(box, { target: { value: '   ' } });
    expect(sendButton(1)).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Parking is behind the shop' } });
    expect(screen.getByText(`26/${String(UPDATE_TEXT_MAX)}`)).toBeVisible();
    fireEvent.click(sendButton(1));
    expect(await screen.findByText('Sent to 1 of 1 customers.')).toBeVisible();
    expect((await inboxOf(citra.code))[0]).toMatchObject({
      kind: 'message',
      text: 'Parking is behind the shop',
    });
  });

  it('lists the orders that were skipped, in plain words', async () => {
    const { ani, budi } = await seed();
    server.use(
      http.post('*/api/seller/updates', () =>
        HttpResponse.json({
          sent: 1,
          results: [
            { code: ani.code, ok: true },
            { code: budi.code, ok: false, error: 'invalid_status' },
            { code: 'ZZZZZZ', ok: false, error: 'not_found' },
          ],
        }),
      ),
    );
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    fireEvent.click(screen.getByRole('button', { name: 'Pickup' }));
    fireEvent.click(sendButton(2));
    expect(await screen.findByText('Sent to 1 of 2 customers.')).toBeVisible();
    expect(screen.getByText('Not sent:')).toBeVisible();
    expect(screen.getByText(`Budi (${budi.label}): the order is cancelled`)).toBeVisible();
    expect(screen.getByText('ZZZZZZ (ZZZ-ZZZ): no order with that code')).toBeVisible();
  });

  it('keeps the selection and says so when nothing could be sent', async () => {
    await seed();
    server.use(http.post('*/api/seller/updates', () => HttpResponse.error()));
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    fireEvent.click(screen.getByRole('button', { name: 'All open' }));
    fireEvent.click(sendButton(3));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send. Nothing was sent.');
    expect(sendButton(3)).toBeEnabled();
  });

  it('can be read by the customer afterwards', async () => {
    const { budi } = await seed();
    renderThemed(<SendUpdateScreen />);
    await screen.findByRole('checkbox', { name: /^Ani / });
    fireEvent.click(screen.getByRole('button', { name: 'Pickup' }));
    fireEvent.click(sendButton(2));
    await screen.findByText('Sent to 2 of 2 customers.');
    const customer = await fetchOrder(budi.token);
    expect(customer.ok && customer.data.order.inbox[0]).toMatchObject({
      kind: 'message',
      textKey: 'readyIn',
      minutes: 15,
    });
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    await seed();
    renderThemed(<SendUpdateScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Kirim kabar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Siap dalam…' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kirim ke 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semua yang aktif' })).toBeVisible();
  });
});
