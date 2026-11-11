import { screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_NOW } from '../../../mocks/handlers';
import type { CustomerOrder } from '../../../shared/domain';
import { setOrderStatus, setOrderWaReceived } from '../../api/client';
import { MY_ORDERS_KEY, rememberStatus, saveMyOrder } from '../../api/device/myOrders';
import { MenuScreen } from './MenuScreen';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 129: the menu's first page reminds, per unconfirmed order of this kitchen saved on the phone.

beforeAll(() => setupI18n('en'));
beforeEach(() => {
  // The saved orders count as recent only next to the mock server's clock.
  vi.useFakeTimers({ toFake: ['Date'], now: MOCK_NOW });
  localStorage.removeItem(MY_ORDERS_KEY);
  localStorage.setItem('howItWorksSeen', '1');
});
afterEach(async () => {
  vi.useRealTimers();
  localStorage.removeItem(MY_ORDERS_KEY);
  await i18n.changeLanguage('en');
});

async function place(slug = 'onde-onde'): Promise<CustomerOrder> {
  const response = await fetch(`/api/s/${slug}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'tempe-mendoan', qty: 1 }],
    }),
  });
  const order = ((await response.json()) as { order: CustomerOrder }).order;
  saveMyOrder(order);
  return order;
}

describe('menu first page reminders (plan 129)', () => {
  it('shows the line for everyone, and no card without an order on the phone', async () => {
    renderWithStore(<MenuScreen slug="onde-onde" />);
    expect(await screen.findByTestId('after-ordering')).toHaveTextContent(
      /^After ordering, send your order on WhatsApp so .* can confirm it\.$/,
    );
    expect(screen.queryByTestId('menu-reminder')).not.toBeInTheDocument();
  });

  it('shows a card for an unconfirmed order, in Indonesian too, and drops it once confirmed', async () => {
    const order = await place();
    renderWithStore(<MenuScreen slug="onde-onde" />);
    const card = await screen.findByTestId('menu-reminder');
    expect(card).toHaveTextContent("isn't confirmed yet. Send it to");
    expect(within(card).getByRole('button', { name: 'Send on WhatsApp' })).toBeVisible();
    await setOrderStatus(order.code, 'confirmed');
    const fresh = await fetch(`/api/orders/${order.token}`);
    rememberStatus(((await fresh.json()) as { order: CustomerOrder }).order);
    await waitFor(() => expect(screen.queryByTestId('menu-reminder')).not.toBeInTheDocument());
  });

  it('drops the card when the seller ticks WhatsApp received', async () => {
    const order = await place();
    renderWithStore(<MenuScreen slug="onde-onde" />);
    await screen.findByTestId('menu-reminder');
    await setOrderWaReceived(order.code, true);
    const fresh = await fetch(`/api/orders/${order.token}`);
    rememberStatus(((await fresh.json()) as { order: CustomerOrder }).order);
    await waitFor(() => expect(screen.queryByTestId('menu-reminder')).not.toBeInTheDocument());
  });

  it('is in Indonesian', async () => {
    await place();
    await i18n.changeLanguage('id');
    renderWithStore(<MenuScreen slug="onde-onde" />);
    expect(await screen.findByTestId('menu-reminder')).toHaveTextContent('belum dikonfirmasi');
    expect(screen.getByTestId('after-ordering')).toHaveTextContent('Setelah memesan');
  });
});
