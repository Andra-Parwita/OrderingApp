import type { SellerOrder } from '../../../shared/domain';
import type { PrivateState } from './privateSlice';

export const TODAY = '2026-10-17';

export function privateOrder(overrides: Partial<SellerOrder> = {}): SellerOrder {
  return {
    id: 'o1',
    sellerId: 's1',
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
      {
        itemId: 'lemper',
        name: { en: 'Lemper', id: 'Lemper' },
        size: { en: '', id: '' },
        priceCents: 1000,
        qty: 2,
      },
    ],
    fulfilment: 'delivery',
    status: 'confirmed',
    paid: false,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    address: { address: { street: 'Jl. Mawar 12', suburb: 'Sanur', postcode: '80228' } },
    private: { eventDate: TODAY, eventTime: '12:00', depositCents: 6400 },
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-10T08:00:00Z',
    ...overrides,
  };
}

export const readyState = (extra: Partial<PrivateState> = {}): PrivateState => ({
  load: 'ready',
  view: 'upcoming',
  listOpen: false,
  detailCode: null,
  orders: [],
  detail: null,
  due: { today: 0, tomorrow: 0 },
  today: TODAY,
  action: { status: 'idle' },
  ...extra,
});

export const dish = (id: string, name: string, priceCents: number) => ({
  id,
  name: { en: name, id: name },
  description: { en: '', id: '' },
  size: { en: '', id: '' },
  priceCents,
});
