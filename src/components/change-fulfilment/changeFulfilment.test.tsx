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

// Plan 083: the sheet where the seller moves an order between pickup and delivery.

const PLACES = [
  {
    id: 'clayton',
    place: 'Clayton',
    directions: { en: '', id: '' },
    window: { start: '10:00', end: '12:00' },
  },
  {
    id: 'oakleigh',
    place: 'Oakleigh',
    directions: { en: '', id: '' },
    window: { start: '15:00', end: '16:00' },
  },
];

const ORDER: Pick<
  Order,
  'code' | 'firstName' | 'language' | 'fulfilment' | 'pickupPlaceId' | 'address'
> = {
  code: 'R5HT8WBC',
  firstName: 'Rina',
  language: 'en',
  fulfilment: 'delivery',
};

const SAVED = {
  id: 'o1',
  sellerId: 's1',
  code: 'R5HT8WBC',
  token: 'tok',
  firstName: 'Rina',
  language: 'en',
  lines: [
    {
      itemId: 'rice',
      name: { en: 'Nasi kuning set', id: 'Paket nasi kuning' },
      size: { en: '', id: '' },
      priceCents: 1400,
      qty: 1,
    },
  ],
  fulfilment: 'pickup',
  pickupPlaceId: 'clayton',
  status: 'confirmed',
  paid: false,
  locked: false,
  waReceived: false,
  returning: false,
  changed: false,
  inbox: [],
  audit: [],
  createdAt: '2026-10-10T08:00:00Z',
  updatedAt: '2026-10-10T08:00:00Z',
};

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

function open(order = ORDER, onChanged = vi.fn()) {
  server.use(http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places: PLACES })));
  render(
    <AppThemeProvider>
      <ChangeFulfilment order={order} onChanged={onChanged} />
    </AppThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change pickup or delivery' }));
  return onChanged;
}

describe('ChangeFulfilment', () => {
  it('preselects the first place when switching from delivery and previews the message', async () => {
    open();
    fireEvent.click(await screen.findByRole('radio', { name: 'Pickup' }));
    const first = await screen.findByRole('radio', { name: /Clayton/ });
    expect(first).toBeChecked();
    expect(screen.getByText('Your order is now for pickup at Clayton, 10:00–12:00')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /Oakleigh/ }));
    expect(screen.getByText('Your order is now for pickup at Oakleigh, 15:00–16:00')).toBeVisible();
  });

  it('has "Tell Rina" ticked by default and hides the preview when it is unticked', async () => {
    open();
    const tick = await screen.findByRole('checkbox', { name: /Tell Rina about this change/ });
    expect(tick).toBeChecked();
    expect(screen.getByText('What Rina will see')).toBeVisible();
    fireEvent.click(tick);
    expect(screen.queryByText('What Rina will see')).toBeNull();
  });

  it('offers Check on map for a typed street and previews the delivery message in the order language', async () => {
    open({ ...ORDER, language: 'id' });
    const street = await screen.findByLabelText('Street');
    expect(screen.queryByRole('link', { name: /Check on map/ })).toBeNull();
    fireEvent.change(street, { target: { value: '12 King William St' } });
    fireEvent.change(screen.getByLabelText('Suburb'), { target: { value: 'Adelaide' } });
    const link = screen.getByRole('link', { name: /Check on map/ });
    expect(link.getAttribute('href')).toContain('12%20King%20William%20St');
    expect(screen.getByText('Pesananmu sekarang diantar.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('saves with notify true, closes and says the customer was told', async () => {
    let body: unknown = null;
    server.use(
      http.patch('*/api/seller/orders/:code/fulfilment', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ order: SAVED });
      }),
    );
    const onChanged = open();
    fireEvent.click(await screen.findByRole('radio', { name: 'Pickup' }));
    await screen.findByRole('radio', { name: /Clayton/ });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Saved. Rina was told.'),
    );
    expect(body).toEqual({ fulfilment: 'pickup', pickupPlaceId: 'clayton', notify: true });
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
