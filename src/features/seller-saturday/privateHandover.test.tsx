import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import type { Fulfilment, SellerOrder } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { placeOrder } from '../../api/client';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { HandOverScreen, mergeOrders } from './HandOverScreen';
import { registerSellerSaturdayI18n } from './i18n/register';

// Plan 081: today's private orders inside Pickup & delivery. The private list and the status call are
// stubbed (the server side has its own tests); the menu orders are real ones on the mock.

const mocks = vi.hoisted(() => ({
  fetchPrivate: vi.fn(),
  setOrderStatus: vi.fn(),
  sendDeliveryStep: vi.fn(),
}));
vi.mock('../../api/private', () => ({ fetchPrivate: mocks.fetchPrivate }));
vi.mock('../../api/handover', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/handover')>()),
  sendDeliveryStep: mocks.sendDeliveryStep,
}));
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  setOrderStatus: mocks.setOrderStatus,
}));

function priv(
  code: string,
  firstName: string,
  fulfilment: Fulfilment,
  eventTime: string,
  address: SellerOrder['address'],
): SellerOrder {
  return {
    id: `id-${code}`,
    code,
    token: `tok-${code}`,
    firstName,
    language: 'en',
    fulfilment,
    status: 'confirmed',
    paid: false,
    createdAt: '2026-10-17T01:00:00.000Z',
    lines: [{ itemId: 'x', name: { en: 'Rendang', id: 'Rendang' }, priceCents: 1000, qty: 2 }],
    private: { eventDate: '2026-10-17', eventTime, depositCents: 0, toPayCents: 2000 },
    ...(address ? { address } : {}),
  } as unknown as SellerOrder;
}

const FULL = { address: { street: '12 Test Lane', suburb: 'Norwood', postcode: '5067' } };
const late = priv('PRV2', 'Wati', 'delivery', '18:00', FULL);
const early = priv('PRV1', 'Budi', 'delivery', '09:30', FULL);
const noAddress = priv('PRV3', 'Sari', 'delivery', '20:00', { unavailable: true });
const pickupOne = priv('PRV4', 'Dewi', 'pickup', '11:00', undefined);

function renderThemed(ui: React.ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

async function menuOrder(firstName: string, fulfilment: Fulfilment) {
  const placed = await placeOrder(DEFAULT_SELLER_SLUG, {
    firstName,
    language: 'en',
    fulfilment,
    lines: [{ itemId: 'pesmol', qty: 1 }],
  });
  if (!placed.ok) throw new Error('could not place the order');
  return placed.data.order.code;
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
  mocks.fetchPrivate.mockReset();
  mocks.setOrderStatus.mockReset();
  mocks.sendDeliveryStep.mockReset();
  mocks.sendDeliveryStep.mockResolvedValue({ ok: true, data: { order: early } });
  mocks.fetchPrivate.mockResolvedValue({
    ok: true,
    data: {
      orders: [late, early, noAddress, pickupOne],
      due: { today: 4, tomorrow: 0 },
      today: '2026-10-17',
    },
  });
  mocks.setOrderStatus.mockResolvedValue({ ok: true, data: { order: early } });
});

describe('mergeOrders', () => {
  it('keeps menu orders first and sorts the private ones of that kind by event time', () => {
    const menu = [priv('M1', 'Menu', 'delivery', '00:00', undefined)] as Array<SellerOrder>;
    const merged = mergeOrders(menu, [late, early, pickupOne], 'delivery');
    expect(merged.map((o) => o.code)).toEqual(['M1', 'PRV1', 'PRV2']);
  });
});

describe('Pickup & delivery · private orders today', () => {
  it('counts them in Delivery, tags and sorts them, and offers Directions only with a readable address', async () => {
    const menuCode = await menuOrder('Ani', 'delivery');
    renderThemed(<HandOverScreen view="delivery" />);
    await screen.findByRole('listitem', { name: `Order ${formatOrderCode(early.code)}, Budi` });
    expect(screen.getByRole('radio', { name: 'Delivery · 4' })).toBeVisible();
    const names = screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(names).toEqual([
      `Order ${formatOrderCode(menuCode)}, Ani`,
      `Order ${formatOrderCode(early.code)}, Budi`,
      `Order ${formatOrderCode(late.code)}, Wati`,
      `Order ${formatOrderCode(noAddress.code)}, Sari`,
    ]);

    const row = screen.getByRole('listitem', { name: /Budi/ });
    expect(within(row).getByText('Private')).toBeVisible();
    expect(within(row).getByText('09:30')).toBeVisible();
    expect(within(row).getByText('12 Test Lane, Norwood 5067')).toBeVisible();
    const directions = within(row).getByRole('link', { name: 'Directions to Budi' });
    expect(directions.getAttribute('href')).toContain('google.com/maps/dir/?api=1&destination=');
    expect(within(row).getByRole('link', { name: 'View on map: Budi' })).toBeVisible();
    // The same step control as a menu delivery, never a lone Delivered button.
    expect(within(row).getByRole('button', { name: 'Out for delivery' })).toBeVisible();
    expect(within(row).getByRole('button', { name: 'Arriving soon' })).toBeVisible();

    const bare = screen.getByRole('listitem', { name: /Sari/ });
    expect(within(bare).getByText('No address saved')).toBeVisible();
    expect(within(bare).queryByRole('link')).not.toBeInTheDocument();
    // A menu delivery keeps its steps and, with no address saved on this device, has no links.
    const menuRow = screen.getByRole('listitem', { name: /Ani/ });
    expect(within(menuRow).queryByRole('link')).not.toBeInTheDocument();
    expect(within(menuRow).getByRole('button', { name: 'Out for delivery' })).toBeVisible();
  });

  it('gives menu delivery rows Directions and Map when an address is saved on the phone', async () => {
    const menuCode = await menuOrder('Ani', 'delivery');
    renderThemed(
      <HandOverScreen
        view="delivery"
        phone
        addressOf={(code) => (code === menuCode ? '5 Rundle St, Kent Town 5067' : undefined)}
      />,
    );
    const row = await screen.findByRole('listitem', { name: /Ani/ });
    const directions = within(row).getByRole('link', { name: 'Directions to Ani' });
    expect(directions.getAttribute('href')).toContain('google.com/maps/dir/?api=1&destination=');
    expect(within(row).getByRole('link', { name: 'View on map: Ani' })).toBeVisible();
  });

  it('sends a private delivery step through the delivery-step call and reloads the private list', async () => {
    renderThemed(<HandOverScreen view="delivery" />);
    const row = await screen.findByRole('listitem', { name: /Budi/ });
    const before = mocks.fetchPrivate.mock.calls.length;
    fireEvent.click(within(row).getByRole('button', { name: 'Out for delivery' }));
    await waitFor(() =>
      expect(mocks.sendDeliveryStep).toHaveBeenCalledWith(
        'PRV1',
        { step: 'out_for_delivery' },
        undefined,
        expect.anything(),
      ),
    );
    await waitFor(() => expect(mocks.fetchPrivate.mock.calls.length).toBeGreaterThan(before));
    expect(mocks.setOrderStatus).not.toHaveBeenCalled();
  });

  it('shows a private pickup under the first place and marks it collected', async () => {
    renderThemed(<HandOverScreen />);
    const row = await screen.findByRole('listitem', { name: /Dewi/ });
    expect(screen.getByRole('radio', { name: 'Pickup · 1' })).toBeVisible();
    expect(within(row).getByText('Private')).toBeVisible();
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Collected' }));
    await waitFor(() =>
      expect(mocks.setOrderStatus).toHaveBeenCalledWith(
        'PRV4',
        'collected',
        undefined,
        expect.anything(),
        true,
      ),
    );
    expect(await screen.findByText("Dewi's private order is collected.")).toBeVisible();
  });

  it('finds a private order by name or code, and opens its page on tap', async () => {
    const opened: Array<string> = [];
    renderThemed(<HandOverScreen view="delivery" onOpenPrivate={(code) => opened.push(code)} />);
    await screen.findByRole('listitem', { name: /Budi/ });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Bag code or name' }), {
      target: { value: 'wati' },
    });
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: /Budi/ })).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: "Open Wati's private order" }));
    expect(opened).toEqual(['PRV2']);
  });
});
