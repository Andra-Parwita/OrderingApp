import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { Order } from '../../../shared/domain';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { ChangeFulfilment } from './ChangeFulfilment';
import { registerChangeFulfilmentI18n } from './i18n/register';

// Plan 126: the seller sets one order's delivery day in the Change pickup / delivery sheet.

type OrderLike = Pick<
  Order,
  'code' | 'firstName' | 'language' | 'fulfilment' | 'pickupPlaceId' | 'address' | 'handoverDate'
>;
const ORDER: OrderLike = {
  code: 'R5HT8WBC',
  firstName: 'Rina',
  language: 'en',
  fulfilment: 'delivery',
  address: { address: { street: '1 Jetty Rd', suburb: 'Glenelg', postcode: '5045' } },
};
const NOTE = { en: '', id: '' };

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerChangeFulfilmentI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

function open(order: OrderLike, delivery: { days?: Array<string>; defaultDay?: string }) {
  server.use(http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places: [] })));
  render(
    <AppThemeProvider>
      <ChangeFulfilment
        order={order}
        days={{ cookingDate: '2026-11-15', delivery: { available: true, note: NOTE, ...delivery } }}
        onChanged={vi.fn()}
      />
    </AppThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change pickup or delivery' }));
}
const chips = () => screen.queryAllByRole('radio').filter((el) => /\d/.test(el.textContent ?? ''));

describe('Change sheet: Delivery day (plan 126)', () => {
  it('no row for a menu with only the event day and an order on it', async () => {
    open(ORDER, {});
    await screen.findByLabelText('Street');
    expect(chips()).toHaveLength(0);
  });

  it('pre-selects the order day, offers the menu days and its own removed day, and sends the pick', async () => {
    let body: unknown = null;
    server.use(
      http.patch('*/api/seller/orders/:code/fulfilment', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ order: {} });
      }),
    );
    // The order is on Mon 16, which the menu no longer offers.
    open({ ...ORDER, handoverDate: '2026-11-16' }, { days: ['2026-11-14', '2026-11-15'] });
    await screen.findByLabelText('Street');
    expect(chips().map((el) => el.textContent)).toEqual(['Sat 14 Nov', 'Sun 15 Nov', 'Mon 16 Nov']);
    expect(chips()[2]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(chips()[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ fulfilment: 'delivery', handoverDate: '2026-11-14' });
  });

  it('a pickup order switched to delivery starts on the menu default', async () => {
    open(
      { ...ORDER, fulfilment: 'pickup', pickupPlaceId: 'x', address: undefined },
      { days: ['2026-11-14', '2026-11-15'], defaultDay: '2026-11-14' },
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'Delivery' }));
    await screen.findByLabelText('Street');
    expect(chips()[0]).toHaveAttribute('aria-checked', 'true');
  });
});
