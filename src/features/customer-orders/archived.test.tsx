// D-044: a closed week's orders are read-only; past 4 weeks only a one-line summary is left.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { CustomerOrder } from '../../../shared/domain';
import { toExpiredOrder, type ExpiredOrder } from '../../../shared/orderContract';
import { MY_ORDERS_KEY, readMyOrders } from '../../api/device/myOrders';
import { MyOrdersScreen } from './MyOrdersScreen';
import { OrderScreen } from './OrderScreen';
import { renderWithStore, setupI18n } from './testSupport';

const noop = () => undefined;
const seller = { slug: 'onde-onde', name: 'Onde Onde' };

const archived: CustomerOrder = {
  id: 'o1',
  seller,
  code: 'ABCD23',
  token: 'tok-archived',
  firstName: 'Rina',
  language: 'en',
  lines: [
    {
      itemId: 'i1',
      name: { en: 'Thin battered tempeh', id: 'Tempe mendoan' },
      size: { en: '5 pieces', id: '5 buah' },
      priceCents: 1000,
      qty: 3,
    },
  ],
  fulfilment: 'pickup',
  status: 'collected',
  locked: false,
  paid: false,
  inbox: [],
  createdAt: '2026-10-05T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  archived: true,
  cookingDate: '2026-10-10',
};

const expired: ExpiredOrder = toExpiredOrder('tok-expired', seller, '2026-09-05');

function saveEntry(token: string, code: string) {
  const entries = readMyOrders();
  localStorage.setItem(
    MY_ORDERS_KEY,
    JSON.stringify([...entries, { code, token, placedAt: '2026-09-01T00:00:00Z' }]),
  );
}

function answerOrder(token: string, body: object) {
  server.use(http.get(`*/api/orders/${token}`, () => HttpResponse.json(body)));
}

beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(MY_ORDERS_KEY));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('archived order page', () => {
  it('is read-only in English: status, items, total, seller, date, a closed note', async () => {
    answerOrder(archived.token, { order: archived });
    renderWithStore(<OrderScreen token={archived.token} onBack={noop} onChange={noop} />);
    expect(
      await screen.findByText('This menu is closed. You can still see what you ordered.'),
    ).toBeVisible();
    expect(screen.getByTestId('order-code')).toHaveTextContent(/ABC.?D23/);
    expect(screen.getByText('Collected')).toBeVisible();
    expect(screen.getByText('3 × Thin battered tempeh')).toBeVisible();
    expect(screen.getByText('Details kept until Sat 7 Nov')).toBeVisible();
    expect(screen.getAllByText('$30.00')).toHaveLength(2); // the line and the total
    expect(screen.getByText(/Onde Onde · Sat 10 Oct/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('is read-only in Indonesian', async () => {
    await i18n.changeLanguage('id');
    answerOrder(archived.token, { order: { ...archived, status: 'ordered' } });
    renderWithStore(<OrderScreen token={archived.token} onBack={noop} onChange={noop} />);
    expect(
      await screen.findByText('Menu ini sudah ditutup. Anda masih bisa melihat pesanan Anda.'),
    ).toBeVisible();
    expect(screen.getByText('3 × Tempe mendoan')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ubah pesanan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Batalkan pesanan' })).not.toBeInTheDocument();
  });

  it('loads no menu for a closed week', async () => {
    const menuHit = vi.fn();
    server.use(
      http.get('*/api/s/onde-onde/menu', () => {
        menuHit();
        return HttpResponse.json({});
      }),
    );
    answerOrder(archived.token, { order: archived });
    renderWithStore(<OrderScreen token={archived.token} onBack={noop} onChange={noop} />);
    await screen.findByText('This menu is closed. You can still see what you ordered.');
    expect(menuHit).not.toHaveBeenCalled();
  });
});

describe('expired order page', () => {
  it('says it has been archived, with seller, date and a link to the menu (EN)', async () => {
    answerOrder(expired.token, { expired });
    const onOpenMenu = vi.fn();
    renderWithStore(
      <OrderScreen token={expired.token} onBack={noop} onChange={noop} onOpenMenu={onOpenMenu} />,
    );
    expect(await screen.findByText('This order has been archived')).toBeVisible();
    // The seller's name is in the top bar and in the body.
    expect(screen.getAllByText('Onde Onde').length).toBeGreaterThan(0);
    expect(screen.getByText(/· Sat 5 Sep/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'See the current menu' }));
    expect(onOpenMenu).toHaveBeenCalledWith('onde-onde');
    expect(screen.queryByRole('button', { name: 'Change order' })).not.toBeInTheDocument();
  });

  it('shows the code saved on this phone, read out character by character', async () => {
    saveEntry(expired.token, 'ZZZ222');
    answerOrder(expired.token, { expired });
    renderWithStore(<OrderScreen token={expired.token} onBack={noop} onChange={noop} />);
    expect(await screen.findByTestId('order-code')).toHaveAttribute('aria-label', 'Z Z Z, 2 2 2');
  });

  it('says it in Indonesian too', async () => {
    await i18n.changeLanguage('id');
    answerOrder(expired.token, { expired });
    renderWithStore(<OrderScreen token={expired.token} onBack={noop} onChange={noop} />);
    expect(await screen.findByText('Pesanan ini sudah diarsipkan')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lihat menu saat ini' })).toBeVisible();
  });

  it('keeps the saved order on this phone', async () => {
    saveEntry(expired.token, 'ZZZZ22');
    answerOrder(expired.token, { expired });
    renderWithStore(<OrderScreen token={expired.token} onBack={noop} onChange={noop} />);
    await screen.findByText('This order has been archived');
    expect(readMyOrders().map((entry) => entry.token)).toEqual([expired.token]);
  });
});

describe('a network error never removes anything from this phone', () => {
  it('on the order page', async () => {
    saveEntry(archived.token, archived.code);
    server.use(http.get('*/api/orders/*', () => HttpResponse.error()));
    renderWithStore(<OrderScreen token={archived.token} onBack={noop} onChange={noop} />);
    expect(await screen.findByText('Could not load your order.')).toBeVisible();
    expect(readMyOrders()).toHaveLength(1);
  });

  it('on My orders', async () => {
    saveEntry(archived.token, archived.code);
    server.use(http.get('*/api/orders', () => HttpResponse.error()));
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText(/Could not load your orders/)).toBeVisible();
    expect(readMyOrders()).toHaveLength(1);
  });
});

describe('My orders grouping', () => {
  function answerList() {
    saveEntry(archived.token, archived.code);
    saveEntry(expired.token, 'ZZZZ22');
    server.use(
      http.get('*/api/orders', () => HttpResponse.json({ orders: [archived], expired: [expired] })),
    );
  }

  it('puts archived orders under "Earlier", the expired one as a one-line entry', async () => {
    answerList();
    const onOpenOrder = vi.fn();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={onOpenOrder} />);
    expect(await screen.findByText('Earlier')).toBeVisible();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    const full = screen.getByRole('button', { name: /ABC.*Onde Onde/ });
    expect(full).toHaveTextContent('Sat 10 Oct');
    expect(full).toHaveTextContent('$30.00');
    const line = screen.getByRole('button', { name: /ZZZ.*Onde Onde/ });
    expect(line).toHaveTextContent('Sat 5 Sep');
    expect(line).toHaveTextContent('Archived');
    expect(line).not.toHaveTextContent('$');
    fireEvent.click(line);
    expect(onOpenOrder).toHaveBeenCalledWith('tok-expired');
  });

  it('is not the empty state when only an expired entry is left', async () => {
    saveEntry(expired.token, 'ZZZZ22');
    server.use(
      http.get('*/api/orders', () => HttpResponse.json({ orders: [], expired: [expired] })),
    );
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Earlier')).toBeVisible();
    expect(screen.queryByText(/Your orders will appear here/)).not.toBeInTheDocument();
  });

  it('labels the groups in Indonesian', async () => {
    await i18n.changeLanguage('id');
    answerList();
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Sebelumnya')).toBeVisible();
    await waitFor(() => expect(screen.getByText('Diarsipkan')).toBeVisible());
  });
});
