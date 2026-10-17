import { screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CustomerOrder } from '../../../shared/domain';
import { OrderPageView } from './OrderPageView';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 081: the customer's page of a private (Khusus) order: read-only, with what is still to pay.

const noop = () => undefined;

function privateOrder(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: 'o1',
    code: 'K7M42XQ9',
    token: 'tok',
    firstName: 'Rina',
    language: 'en',
    lines: [
      {
        itemId: 'rice',
        name: { en: 'Nasi kuning set', id: 'Paket nasi kuning' },
        size: { en: '', id: '' },
        priceCents: 1400,
        qty: 6,
      },
    ],
    fulfilment: 'delivery',
    status: 'confirmed',
    locked: false,
    paid: false,
    inbox: [],
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-10T08:00:00Z',
    private: { eventDate: '2026-10-17', eventTime: '12:00', depositCents: 3000, toPayCents: 5400 },
    seller: { slug: 'onde-onde', name: 'Maria' },
    ...overrides,
  };
}

function show(order: CustomerOrder) {
  return renderWithStore(
    <OrderPageView
      order={order}
      menu={undefined}
      lang={order.language}
      paid={order.paid}
      cancelOpen={false}
      cancelling={false}
      collecting={false}
      onBack={noop}
      onShowQr={noop}
      onChange={noop}
      onAskCancel={noop}
      onKeepOrder={noop}
      onCancel={noop}
      onCollect={noop}
      onWhatsApp={noop}
    />,
  );
}

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('OrderPageView, private order', () => {
  it('shows the event, the deposit and what is still to pay, and cannot be changed', () => {
    show(privateOrder());
    expect(screen.getByText('Private order')).toBeVisible();
    expect(screen.getByText('Sat 17 Oct, 12 pm')).toBeVisible();
    expect(screen.getByText('Deposit paid')).toBeVisible();
    expect(screen.getByText('$30.00')).toBeVisible();
    expect(screen.getByText('Still to pay')).toBeVisible();
    expect(screen.getByText('$54.00')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
    expect(screen.getByText('Need a change? Message Maria on WhatsApp.')).toBeVisible();
  });

  it('says paid in full when nothing is left to pay', () => {
    show(privateOrder({ private: { eventDate: '2026-10-17', toPayCents: 0 } }));
    expect(screen.getByText('Paid in full')).toBeVisible();
    expect(screen.queryByText('Still to pay')).toBeNull();
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    show(privateOrder({ language: 'id' }));
    expect(screen.getByText('Pesanan khusus')).toBeVisible();
    expect(screen.getByText('Masih harus dibayar')).toBeVisible();
    expect(screen.getByText('Mau ubah? Kabari Maria lewat WhatsApp.')).toBeVisible();
  });
});
