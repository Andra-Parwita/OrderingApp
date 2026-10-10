import { render } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import type { OrderLine, SellerOrder } from '../../../shared/domain';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerLabelsI18n } from './i18n/register';

/** Test-only helpers for this feature's tests. */
export async function setupI18n(): Promise<void> {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerLabelsI18n();
  await i18n.changeLanguage('en');
}

export function renderThemed(ui: ReactNode) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

export function line(itemId: string, en: string, id: string, qty: number): OrderLine {
  return {
    itemId,
    name: { en, id },
    size: { en: '1 portion', id: '1 porsi' },
    priceCents: 1000,
    qty,
  };
}

export function makeOrder(overrides: Partial<SellerOrder> = {}): SellerOrder {
  return {
    id: 'o1',
    sellerId: 's1',
    code: 'K7F2QX',
    token: 'tok-k7f2qx',
    firstName: 'Rina',
    language: 'en',
    lines: [line('lemper', 'Chicken lemper', 'Lemper ayam', 2)],
    fulfilment: 'pickup',
    status: 'confirmed',
    paid: false,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    createdAt: '2026-10-07T08:12:00Z',
    updatedAt: '2026-10-07T08:12:00Z',
    ...overrides,
  };
}

export const LONG_NOTE =
  'Please no peanuts at all, my daughter is severely allergic and also no sesame oil or shrimp paste thanks';

/** Rina (confirmed, long note), Tom (ordered, delivery), Dewi (cancelled), Sari (confirmed). */
export function sampleOrders(): Array<SellerOrder> {
  return [
    makeOrder({
      id: 'o1',
      code: 'K7F2QX',
      firstName: 'Rina',
      lines: [line('lemper', 'Chicken lemper', 'Lemper ayam', 2)],
      note: LONG_NOTE,
    }),
    makeOrder({
      id: 'o2',
      code: 'M3H9TD',
      firstName: 'Tom',
      status: 'ordered',
      fulfilment: 'delivery',
      lines: [line('tempe', 'Tempeh mendoan', 'Tempe mendoan', 3)],
    }),
    makeOrder({
      id: 'o3',
      code: 'H9D7RV',
      firstName: 'Dewi',
      status: 'cancelled',
      lines: [line('nasi', 'Mixed rice', 'Nasi campur', 1)],
    }),
    makeOrder({
      id: 'o4',
      code: 'R8P4WB',
      firstName: 'Sari',
      lines: [line('pesmol', 'Tilapia pesmol', 'Tilapia pesmol', 1)],
      note: 'Short note',
    }),
  ];
}
