import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import type { Fulfilment, OrderStatus } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { DEFAULT_SELLER_SLUG } from '../../../shared/seller';
import { fetchSellerOrder, placeOrder, setOrderStatus } from '../../api/client';
import { fetchMessages } from '../../api/handover';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { HandOverScreen } from './HandOverScreen';
import { registerSellerSaturdayI18n } from './i18n/register';

type Made = { code: string; label: string };

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
  const { code } = placed.data.order;
  for (const status of path) {
    const moved = await setOrderStatus(code, status, undefined, DEFAULT_SELLER_SLUG);
    if (!moved.ok) throw new Error(`could not move to ${status}`);
  }
  return { code, label: formatOrderCode(code) };
}

async function statusOf(code: string): Promise<OrderStatus> {
  const result = await fetchSellerOrder(code, undefined, DEFAULT_SELLER_SLUG);
  if (!result.ok) throw new Error('order missing');
  return result.data.order.status;
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

describe('Pickup & delivery · Pickup', () => {
  it('shows a column per place with counts, rows with status, and no per-row buttons', async () => {
    const rina = await make('Rina', 'pickup', ['confirmed', 'ready_for_pickup']);
    await make('Tom', 'pickup', ['confirmed', 'ready_for_pickup', 'collected']);
    renderThemed(<HandOverScreen />);
    const row = await screen.findByRole('listitem', { name: `Order ${rina.label}, Rina` });
    expect(row).toHaveTextContent('Ready');
    expect(row).toHaveTextContent('Not paid');
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Message / }).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 collected by customers/)).toBeVisible();
  });

  it('searches by bag code or name', async () => {
    const rina = await make('Rina', 'pickup', ['confirmed']);
    await make('Tom', 'pickup', ['confirmed']);
    renderThemed(<HandOverScreen />);
    const search = await screen.findByRole('searchbox', { name: 'Bag code or name' });
    await screen.findByText('Tom');
    fireEvent.change(search, { target: { value: rina.label.toLowerCase() } });
    await waitFor(() => expect(screen.queryByText('Tom')).not.toBeInTheDocument());
    expect(screen.getByText('Rina')).toBeVisible();
  });

  it('sends Ready for pickup, marks the orders Ready, and warns on a repeat', async () => {
    const rina = await make('Rina', 'pickup', ['confirmed']);
    renderThemed(<HandOverScreen />);
    await screen.findByText('Rina');
    fireEvent.click(screen.getAllByRole('button', { name: /^Message / })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Ready for pickup' }));
    expect(within(dialog).getByText(/Also marks the open orders/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: /^Send to \d+ order/ }));
    expect(await screen.findByText(/marked Ready/)).toBeVisible();
    expect(await statusOf(rina.code)).toBe('ready_for_pickup');
    const log = await fetchMessages(undefined, DEFAULT_SELLER_SLUG);
    expect(log.ok && log.data.messages[0]?.type).toBe('ready_now');

    // Again: the server warns, Continue sends it with force.
    fireEvent.click(screen.getAllByRole('button', { name: /^Message / })[0] as HTMLElement);
    const again = await screen.findByRole('dialog');
    fireEvent.click(within(again).getByRole('radio', { name: 'Ready for pickup' }));
    fireEvent.click(within(again).getByRole('button', { name: /^Send to \d+ order/ }));
    const warning = await screen.findByRole('alertdialog');
    expect(warning).toHaveTextContent('Send this again?');
    fireEvent.click(within(warning).getByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Pickup & delivery · Delivery', () => {
  it('walks an order Out for delivery, Arriving soon, Delivered and shows the current step', async () => {
    const ani = await make('Ani', 'delivery', ['confirmed']);
    renderThemed(<HandOverScreen view="delivery" />);
    const row = await screen.findByRole('listitem', { name: `Order ${ani.label}, Ani` });
    fireEvent.click(within(row).getByRole('button', { name: 'Out for delivery' }));
    expect(await screen.findByText("Ani's order is out for delivery.")).toBeVisible();
    expect(await statusOf(ani.code)).toBe('out_for_delivery');
    await waitFor(() =>
      expect(within(row).getByRole('button', { name: 'Out for delivery' })).toHaveAttribute(
        'aria-current',
        'step',
      ),
    );
    fireEvent.click(within(row).getByRole('button', { name: 'Arriving soon' }));
    expect(await screen.findByText('Told Ani the order is arriving soon.')).toBeVisible();
    fireEvent.click(within(row).getByRole('button', { name: 'Delivered' }));
    expect(await screen.findByText("Ani's order is delivered.")).toBeVisible();
    expect(await statusOf(ani.code)).toBe('delivered');
  });

  it('warns on a step out of order and goes ahead on Send anyway', async () => {
    const ani = await make('Ani', 'delivery', ['confirmed']);
    renderThemed(<HandOverScreen view="delivery" />);
    const row = await screen.findByRole('listitem', { name: `Order ${ani.label}, Ani` });
    fireEvent.click(within(row).getByRole('button', { name: 'Delivered' }));
    const warning = await screen.findByRole('alertdialog');
    expect(warning).toHaveTextContent('Out of order?');
    fireEvent.click(within(warning).getByRole('button', { name: 'Send anyway' }));
    expect(await screen.findByText("Ani's order is delivered.")).toBeVisible();
  });
});

describe('Pickup & delivery · Indonesian', () => {
  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderThemed(<HandOverScreen />);
    expect(await screen.findByRole('searchbox', { name: 'Kode tas atau nama' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /^Antar/ })).toBeVisible();
  });
});
