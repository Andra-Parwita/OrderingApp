// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): every order link the app
// sends parses back to its token with today's parser, and My orders entries keep loading.
import type { i18n as I18n, TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerOrder, Order } from '../../shared/domain';
import { manifestTarget } from '../components/install/manifestLinks';
import { MY_ORDERS_KEY, activeOrders, readMyOrders, saveMyOrder } from '../api/device/myOrders';
import { buildWhatsAppText } from '../api/device/whatsapp';
import { tokenOfOrderUrl } from '../features/customer-orders/liveConnection';
import { openOrderLink } from '../features/seller-orders/whatsappLink';

const TOKEN = 'tok-AbC123_xyz';

/** Every {{param}} is written out, so the link the code builds ends up in the text. */
const echo = ((key: string, params?: Record<string, unknown>) =>
  `${key} ${Object.values(params ?? {})
    .map(String)
    .join(' ')}`) as unknown as TFunction;

const linkIn = (text: string): string => {
  const found = /https?:\/\/\S+/.exec(text);
  if (!found) throw new Error(`no link in: ${text}`);
  return found[0];
};

const customerOrder = (patch: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: 'o1',
  seller: { slug: 'onde-onde', name: 'Onde Onde' },
  code: 'K7F2QX',
  token: TOKEN,
  firstName: 'Rina',
  language: 'en',
  lines: [
    {
      itemId: 'lemper',
      name: { en: 'Chicken lemper', id: 'Lemper ayam' },
      size: { en: 'box', id: 'kotak' },
      priceCents: 1000,
      qty: 2,
    },
  ],
  fulfilment: 'pickup',
  status: 'ordered',
  locked: false,
  paid: false,
  inbox: [{ at: '2026-10-07T10:00:00.000Z', kind: 'status', status: 'ordered' }],
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
  ...patch,
});

describe('route safety: order links parse back to the token (risks 1, 3, 7)', () => {
  it('tokenOfOrderUrl reads the push URL shape /o/<token> and its sub-pages', () => {
    expect(tokenOfOrderUrl(`/o/${TOKEN}`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}/qr`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}?source=homescreen`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}#x`)).toBe(TOKEN);
  });

  it('tokenOfOrderUrl ignores things that are not order links (menu notice, junk)', () => {
    expect(tokenOfOrderUrl('/onde-onde')).toBeNull();
    expect(tokenOfOrderUrl('/my-orders')).toBeNull();
    expect(tokenOfOrderUrl('/')).toBeNull();
    expect(tokenOfOrderUrl(undefined)).toBeNull();
    expect(tokenOfOrderUrl(42)).toBeNull();
  });

  it('the customer WhatsApp text carries /o/<token>', () => {
    const link = linkIn(buildWhatsAppText(customerOrder(), echo, null));
    expect(new URL(link).pathname).toBe(`/o/${TOKEN}`);
    expect(tokenOfOrderUrl(new URL(link).pathname)).toBe(TOKEN);
  });

  describe('seller side', () => {
    let opened: string;
    beforeEach(() => {
      opened = '';
      vi.spyOn(window, 'open').mockImplementation((url) => {
        opened = String(url);
        return null;
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('the seller "send link" WhatsApp text carries /o/<token>', () => {
      const fake = { getFixedT: () => echo } as unknown as I18n;
      openOrderLink(fake, { ...customerOrder(), audit: [] } as unknown as Order, null);
      const text = decodeURIComponent(new URL(opened).searchParams.get('text') ?? '');
      const link = linkIn(text);
      expect(new URL(link).pathname).toBe(`/o/${TOKEN}`);
      expect(tokenOfOrderUrl(new URL(link).pathname)).toBe(TOKEN);
    });
  });

  // The edit message (editMessage.ts), the seller status message (useOrderActions.ts) and the
  // install flow (useInstallFlow.ts) build the same `${origin}/o/${token}`; shared/routeSafety.test.ts
  // pins which files do, so a new or changed builder is noticed.

  it('the order start for a home-screen install is /o/<token>?source=homescreen', () => {
    expect(manifestTarget(`/o/${TOKEN}`, { orderSlug: 'onde-onde' })).toEqual({
      slug: 'onde-onde',
      start: `/o/${TOKEN}?source=homescreen`,
    });
  });

  it('My orders and Settings pages install to the last kitchen with their own path', () => {
    expect(manifestTarget('/my-orders', { lastSlug: 'onde-onde' })).toEqual({
      slug: 'onde-onde',
      start: '/my-orders',
    });
    expect(manifestTarget('/settings', { lastSlug: 'onde-onde' })?.start).toBe('/settings');
  });

  it.todo('102: tokenOfOrderUrl accepts /<slug>/o/<token> (push, notificationclick, postMessage)');
  it.todo(
    '102: every sent order link is /<slug>/o/<token> or still redirects (old links keep working)',
  );
  it.todo('102: manifestTarget start for an order page is /<slug>/o/<token>?source=homescreen');
});

describe('route safety: My orders saved entries still load (risk 9)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads entries with and without sellerSlug, and drops junk', () => {
    localStorage.setItem(
      MY_ORDERS_KEY,
      JSON.stringify([
        { code: 'AAAAAA', token: 'old-1', placedAt: '2026-09-01T00:00:00.000Z' },
        {
          code: 'BBBBBB',
          token: 'new-1',
          placedAt: '2026-10-01T00:00:00.000Z',
          sellerSlug: 'onde-onde',
          lastStatus: 'ordered',
        },
        { nope: true },
        'text',
      ]),
    );
    const list = readMyOrders();
    expect(list.map((entry) => entry.token)).toEqual(['old-1', 'new-1']);
    expect(list[0]?.sellerSlug).toBeUndefined();
    expect(list[1]?.sellerSlug).toBe('onde-onde');
  });

  it('broken storage gives an empty list, not an error', () => {
    localStorage.setItem(MY_ORDERS_KEY, '{not json');
    expect(readMyOrders()).toEqual([]);
  });

  it('a saved order is stored with its token and kitchen, and read back', () => {
    saveMyOrder(customerOrder({ createdAt: new Date().toISOString() }));
    const [entry] = readMyOrders();
    expect(entry).toMatchObject({ code: 'K7F2QX', token: TOKEN, sellerSlug: 'onde-onde' });
    expect(Array.isArray(activeOrders())).toBe(true);
  });
});
