import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { DeliveryAddress } from '../../../shared/address';
import { saveContact } from './contacts';
import { DeliveriesScreen } from './DeliveriesScreen';
import { DeliveryAddressBlock } from './DeliveryAddressBlock';
import { ReadOnlyOrdersProvider } from './orderAccess';
import { createTestStore, makeOrder, renderWithStore, seed, setupI18n } from './testSupport';

// Plan 071 stage 3: the address on the order, Directions, Call / WhatsApp, Delivered, delete now.

beforeAll(setupI18n);
const SLUG = 'onde-onde';
const A: DeliveryAddress = {
  street: '12 Jetty Road',
  suburb: 'Glenelg',
  postcode: '5045',
  notes: 'blue gate, call when here',
};
const store = () => createTestStore({ saga: false });

describe('delivery address on the seller side', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the address, the notes and a Directions link without the notes', () => {
    const order = makeOrder({ fulfilment: 'delivery', address: { address: A } });
    renderWithStore(<DeliveryAddressBlock order={order} />, store());
    expect(screen.getByText('12 Jetty Road, Glenelg 5045')).toBeInTheDocument();
    expect(screen.getByText(/blue gate, call when here/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Directions' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=12%20Jetty%20Road%2C%20Glenelg%205045',
    );
    expect(link.getAttribute('href')).not.toContain('gate');
    // no saved phone: no Call / WhatsApp
    expect(screen.queryByRole('link', { name: 'Call' })).toBeNull();
  });

  it('marks a changed address with Got it; the mark is gone once it is seen', () => {
    const fresh = makeOrder({
      fulfilment: 'delivery',
      address: { address: A },
      addressChanged: 'new',
    });
    const { unmount } = renderWithStore(<DeliveryAddressBlock order={fresh} />, store());
    expect(screen.getByText(/Address changed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/ })).toBeInTheDocument();
    unmount();
    const seen = { ...fresh, addressChanged: 'seen' as const };
    renderWithStore(<DeliveryAddressBlock order={seen} />, store());
    expect(screen.queryByText(/Address changed/)).toBeNull();
  });

  it('uses the coordinates for Directions when the customer shared them', () => {
    const order = makeOrder({
      fulfilment: 'delivery',
      address: { address: { ...A, lat: -34.98, lng: 138.51 } },
    });
    renderWithStore(<DeliveryAddressBlock order={order} />, store());
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=-34.98,138.51',
    );
  });

  it('offers Apple Maps on an iPhone and Call / WhatsApp when the number is saved on this phone', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'iPhone' });
    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '' });
    const order = makeOrder({ code: 'AAA222', fulfilment: 'delivery', address: { address: A } });
    renderWithStore(<DeliveryAddressBlock order={order} />, store());
    expect(screen.getByRole('link', { name: 'Apple Maps' })).toHaveAttribute(
      'href',
      'https://maps.apple.com/?daddr=12%20Jetty%20Road%2C%20Glenelg%205045',
    );
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+61412345678');
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://api.whatsapp.com/send?phone=61412345678',
    );
  });

  it('says the address is not available when it cannot be read', () => {
    const order = makeOrder({ fulfilment: 'delivery', address: { unavailable: true } });
    renderWithStore(<DeliveryAddressBlock order={order} />, store());
    expect(screen.getByText('Address not available. Ask the customer.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directions' })).toBeNull();
  });

  it('a helper does not get "Delete address now"; others do, after a confirmation', () => {
    const order = makeOrder({ fulfilment: 'delivery', address: { address: A } });
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const { unmount } = renderWithStore(
      <ReadOnlyOrdersProvider value>
        <DeliveryAddressBlock order={order} />
      </ReadOnlyOrdersProvider>,
      store(),
    );
    expect(screen.queryByRole('button', { name: 'Delete address now' })).toBeNull();
    unmount();
    renderWithStore(<DeliveryAddressBlock order={order} />, store());
    fireEvent.click(screen.getByRole('button', { name: 'Delete address now' }));
    expect(confirm).toHaveBeenCalled();
  });

  it('Deliveries lists delivery orders (not pickups or cancelled) with a Delivered tick', () => {
    const s = store();
    seed(s, [
      makeOrder({
        id: '1',
        code: 'AAA222',
        firstName: 'Rina',
        fulfilment: 'delivery',
        address: { address: A },
      }),
      makeOrder({ id: '2', code: 'BBB333', firstName: 'Budi', fulfilment: 'pickup' }),
      makeOrder({
        id: '3',
        code: 'CCC444',
        firstName: 'Cici',
        fulfilment: 'delivery',
        status: 'cancelled',
      }),
      makeOrder({ id: '4', code: 'DDD555', firstName: 'Dewi', fulfilment: 'delivery' }),
    ]);
    renderWithStore(<DeliveriesScreen onBack={() => undefined} />, s);
    expect(screen.getByText('Rina')).toBeInTheDocument();
    expect(screen.getByText('Dewi')).toBeInTheDocument();
    expect(screen.queryByText('Budi')).toBeNull();
    expect(screen.queryByText('Cici')).toBeNull();
    expect(screen.getByText(/2 to deliver/)).toBeInTheDocument();
    expect(
      screen.getByText('No address in the app. Ask the customer on WhatsApp.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Delivered/ })).toHaveLength(2);
  });
});

describe('private deliveries (plan 081)', () => {
  it("lists today's private deliveries with View on map and Directions", async () => {
    server.use(
      http.get('*/api/seller/private', () =>
        HttpResponse.json({
          orders: [
            makeOrder({
              id: 'p1',
              code: 'PPPPPP',
              firstName: 'Bu Wayan',
              fulfilment: 'delivery',
              private: { eventDate: '2026-10-10', eventTime: '12:00' },
              address: { address: A },
            }),
          ],
          due: { today: 1, tomorrow: 0 },
          today: '2026-10-10',
        }),
      ),
    );
    const s = store();
    seed(s, []);
    renderWithStore(<DeliveriesScreen onBack={() => undefined} />, s);
    expect(await screen.findByText('Bu Wayan')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View on map' })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search'),
    );
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/dir'),
    );
  });
});
