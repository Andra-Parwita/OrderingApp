// Safety net for plans 101/102 (docs/plans/102-route-safety-checklist.md): every order link the app
// sends parses back to its token with today's parser, and My orders entries keep loading.
import type { i18n as I18n, TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerOrder, Order } from '../../shared/domain';
import { orderPath, orderStartPath, parseOrderPath } from '../../shared/orderPath';
import { manifestTarget } from '../components/install/manifestLinks';
import { MY_ORDERS_KEY, activeOrders, readMyOrders, saveMyOrder } from '../api/device/myOrders';
import { buildWhatsAppText } from '../api/device/whatsapp';
import { tokenOfOrderUrl } from '../features/customer-orders/liveConnection';
import { setSessionSeller } from '../api/device/sellerContext';
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
  it('tokenOfOrderUrl reads the push URL shape /<slug>/o/<token> and its sub-pages', () => {
    expect(tokenOfOrderUrl(`/onde-onde/o/${TOKEN}`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/onde-onde/o/${TOKEN}/qr`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/onde-onde/o/${TOKEN}?source=homescreen`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/onde-onde/o/${TOKEN}#x`)).toBe(TOKEN);
  });

  it('tokenOfOrderUrl still reads the old /o/<token> (notifications sent before 1.0.44)', () => {
    expect(tokenOfOrderUrl(`/o/${TOKEN}`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}/qr`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}?source=homescreen`)).toBe(TOKEN);
    expect(tokenOfOrderUrl(`/o/${TOKEN}#x`)).toBe(TOKEN);
  });

  it('tokenOfOrderUrl ignores things that are not order links (menu notice, junk)', () => {
    expect(tokenOfOrderUrl('/onde-onde')).toBeNull();
    expect(tokenOfOrderUrl('/onde-onde/my-orders')).toBeNull();
    expect(tokenOfOrderUrl('/my-orders')).toBeNull();
    expect(tokenOfOrderUrl('/my-orders/o/tok')).toBeNull();
    expect(tokenOfOrderUrl('/')).toBeNull();
    expect(tokenOfOrderUrl(undefined)).toBeNull();
    expect(tokenOfOrderUrl(42)).toBeNull();
  });

  it('the customer WhatsApp text carries /<slug>/o/<token>', () => {
    const link = linkIn(buildWhatsAppText(customerOrder(), echo, null));
    expect(new URL(link).pathname).toBe(`/onde-onde/o/${TOKEN}`);
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

    it('the seller "send link" WhatsApp text carries /<slug>/o/<token> of the signed-in kitchen', () => {
      const fake = { getFixedT: () => echo } as unknown as I18n;
      setSessionSeller('onde-onde');
      openOrderLink(fake, { ...customerOrder(), audit: [] } as unknown as Order, null);
      const text = decodeURIComponent(new URL(opened).searchParams.get('text') ?? '');
      const link = linkIn(text);
      expect(new URL(link).pathname).toBe(`/onde-onde/o/${TOKEN}`);
      expect(tokenOfOrderUrl(new URL(link).pathname)).toBe(TOKEN);
      expect(parseOrderPath(new URL(link).pathname)).toEqual({
        slug: 'onde-onde',
        token: TOKEN,
        sub: '',
      });
    });
  });

  // The seller's edit and status messages build the same link through orderPath with the signed-in
  // kitchen (see seller-orders/links.test.ts). shared/routeSafety.test.ts pins which files mention `/o/`.

  it('the order start for a home-screen install is /<slug>/o/<token>?source=homescreen', () => {
    const start = { slug: 'onde-onde', start: `/onde-onde/o/${TOKEN}?source=homescreen` };
    // under the kitchen: the path's slug is enough, the loaded order's seller wins
    expect(manifestTarget(`/onde-onde/o/${TOKEN}`)).toEqual(start);
    expect(manifestTarget(`/onde-onde/o/${TOKEN}/qr`, { orderSlug: 'onde-onde' })).toEqual(start);
    expect(manifestTarget(`/dapur-demo/o/${TOKEN}`, { orderSlug: 'onde-onde' })).toEqual(start);
    // the old address, once the order's seller is known
    expect(manifestTarget(`/o/${TOKEN}`, { orderSlug: 'onde-onde' })).toEqual(start);
    expect(manifestTarget(`/o/${TOKEN}`)).toBeNull();
  });

  it('My orders and Settings pages link no manifest; under a kitchen they install its menu', () => {
    expect(manifestTarget('/my-orders', { lastSlug: 'onde-onde' })).toBeNull();
    expect(manifestTarget('/settings', { lastSlug: 'onde-onde' })).toBeNull();
    expect(manifestTarget('/onde-onde/my-orders')).toEqual({
      slug: 'onde-onde',
      start: '/onde-onde',
    });
    expect(manifestTarget('/onde-onde/settings')).toEqual({
      slug: 'onde-onde',
      start: '/onde-onde',
    });
  });

  it('every link the customer app sends is /<slug>/o/<token> (WhatsApp text, copy link, push, start)', () => {
    const wa = linkIn(buildWhatsAppText(customerOrder(), echo, null));
    expect(parseOrderPath(new URL(wa).pathname)?.slug).toBe('onde-onde');
    expect(orderPath('onde-onde', TOKEN)).toBe(`/onde-onde/o/${TOKEN}`);
    expect(orderStartPath('onde-onde', TOKEN)).toBe(`/onde-onde/o/${TOKEN}?source=homescreen`);
  });
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
