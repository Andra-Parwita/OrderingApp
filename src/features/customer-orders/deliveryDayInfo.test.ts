import { describe, expect, it } from 'vitest';
import type { CustomerOrder } from '../../../shared/domain';
import { buildWhatsAppText } from '../../api/device/whatsapp';
import { orderInfo } from './orderInfo';

// Plan 126: the customer's order shows the delivery day she chose; nothing changes without one.

const BASE = {
  id: 'o1',
  seller: { slug: 'home', name: 'DellaVee' },
  code: 'K7Q2LBXX',
  token: 'tok',
  firstName: 'Wayan',
  language: 'en',
  lines: [
    {
      itemId: 'a',
      name: { en: 'Rendang', id: 'Rendang' },
      size: { en: '', id: '' },
      priceCents: 1800,
      qty: 1,
    },
  ],
  fulfilment: 'delivery',
  status: 'ordered',
  locked: false,
  paid: false,
  inbox: [],
  createdAt: '2026-11-10T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
  archived: true,
  cookingDate: '2026-11-15',
} as unknown as CustomerOrder;

const t = ((key: string, vars?: Record<string, string>) =>
  key === 'wa.message'
    ? (vars?.['how'] ?? '')
    : `${key}${vars?.['when'] ? `:${vars['when']}` : ''}`) as never;

describe('delivery day on the customer order (plan 126)', () => {
  it('the order page shows the chosen day instead of the cooking day', () => {
    expect(orderInfo({ ...BASE, handoverDate: '2026-11-16' }, undefined, 'en').dateText).toBe(
      'Mon 16 Nov',
    );
  });

  it('without a chosen day it is the cooking day, as before', () => {
    expect(orderInfo(BASE, undefined, 'en').dateText).toBe('Sun 15 Nov');
  });

  it('the WhatsApp message names the day, and is unchanged without one', () => {
    expect(buildWhatsAppText({ ...BASE, handoverDate: '2026-11-16' }, t, null)).toContain(
      'wa.deliveryOn:Mon 16 Nov',
    );
    const plain = buildWhatsAppText(BASE, t, null);
    expect(plain).toContain('wa.delivery');
    expect(plain).not.toContain('wa.deliveryOn');
  });
});
