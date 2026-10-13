import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { DeliveryAddress } from '../../../shared/address';
import type { MenuResponse } from '../../../shared/menuContract';
import { ADDRESS_KEY } from '../../api/device/address';
import i18n from 'i18next';
import { menuLoaded, quantitySet } from './customerSlice';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 071 stage 2: the delivery address at checkout (form, saved card, privacy line, blocking).

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  cleanup();
  localStorage.removeItem(ADDRESS_KEY);
  await i18n.changeLanguage('en');
});
beforeEach(() => localStorage.removeItem(ADDRESS_KEY));

const SAVED: DeliveryAddress = {
  street: '12 Jetty Road',
  suburb: 'Glenelg',
  postcode: '5045',
  notes: 'blue gate',
  lat: -34.98,
  lng: 138.51,
};

async function checkout(
  options: { addresses?: boolean; delivery?: 'both' | 'only'; mapsKey?: string } = {},
) {
  const { addresses = true, delivery = 'both', mapsKey } = options;
  const store = createTestStore();
  renderWithStore(<CheckoutFlow slug="onde-onde" onPlaced={vi.fn()} />, store);
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  const menu = store.getState().customer.menu;
  if (menu.status !== 'ready') throw new Error('menu');
  const data: MenuResponse = {
    ...menu.data,
    ...(addresses ? { addresses: true as const } : {}),
    ...(mapsKey ? { mapsEmbedKey: mapsKey } : {}),
    week: {
      ...menu.data.week,
      pickupPoints: delivery === 'only' ? [] : menu.data.week.pickupPoints,
      delivery: { ...menu.data.week.delivery, available: true },
    },
  };
  store.dispatch(menuLoaded(data));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
  await screen.findByRole('radiogroup');
  return store;
}
const next = () => screen.getByRole('button', { name: /^Next: your name/ });

describe('delivery address at checkout', () => {
  it('no saved address: choosing Delivery opens the form, and Next waits for street, suburb and postcode', async () => {
    await checkout();
    expect(screen.getByTestId('address-section')).toHaveAttribute('data-open', 'false');
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByTestId('address-section')).toHaveAttribute('data-open', 'true');
    const street = screen.getByLabelText('Street number and name');
    await waitFor(() => expect(street).toHaveFocus());
    expect(next()).toBeDisabled();
    fireEvent.change(street, { target: { value: '5 Hay St' } });
    fireEvent.change(screen.getByLabelText('Suburb'), { target: { value: 'Perth' } });
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '6000' } });
    expect(next()).toBeEnabled();
  });

  it('shows the kitchen-named privacy line and the how-we-use-this text', async () => {
    await checkout({ delivery: 'only' });
    expect(screen.getByText('Your address is kept safe.', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(/keeps it encrypted and uses it only to deliver this order/),
    ).toHaveTextContent(/Only .+'s team can see it\. It is deleted automatically one day after/);
    expect(screen.getByText('How we use this')).toBeInTheDocument();
    // delivery-only: open straight away
    expect(screen.getByTestId('address-section')).toHaveAttribute('data-open', 'true');
  });

  it('the privacy line is in Indonesian too', async () => {
    await i18n.changeLanguage('id');
    await checkout({ delivery: 'only' });
    expect(screen.getByText('Alamat Anda aman.', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/Hanya tim .+ yang bisa melihatnya/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Nomor dan nama jalan')).toBeInTheDocument();
  });

  it('a saved address shows as a card; Change opens the form prefilled; See my address on the map has no notes', async () => {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(SAVED));
    await checkout({ delivery: 'only' });
    expect(screen.getByText('12 Jetty Road, Glenelg 5045')).toBeInTheDocument();
    expect(screen.getByText(/blue gate/)).toBeInTheDocument();
    expect(screen.getByText(/Map pin saved/)).toBeInTheDocument();
    expect(next()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Street number and name')).toHaveValue('12 Jetty Road');
    expect(screen.getByLabelText('Notes for the driver (optional)')).toHaveValue('blue gate');
    const map = screen.getByRole('link', { name: '🗺 See my address on the map' });
    expect(map).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=12%20Jetty%20Road%2C%20Glenelg%205045',
    );
    expect(map.getAttribute('href')).not.toContain('gate');
  });

  it('"Use a different address" keeps the saved one until a new one is placed', async () => {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(SAVED));
    await checkout({ delivery: 'only' });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use a different address' }));
    expect(screen.getByLabelText('Street number and name')).toHaveValue('');
    expect(next()).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(ADDRESS_KEY) ?? '{}')).toMatchObject({
      street: '12 Jetty Road',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use the saved address' }));
    expect(screen.getByText('12 Jetty Road, Glenelg 5045')).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('switching back to Pickup hides it and keeps what was typed', async () => {
    await checkout();
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    fireEvent.change(screen.getByLabelText('Street number and name'), {
      target: { value: '5 Hay St' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Pickup' }));
    expect(screen.getByTestId('address-section')).toHaveAttribute('data-open', 'false');
    expect(next()).toBeEnabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByLabelText('Street number and name')).toHaveValue('5 Hay St');
  });

  it('places the order with the address, and remembers it on this phone', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post('*/api/s/onde-onde/orders', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ error: 'invalid_request', message: 'x' }, { status: 400 });
      }),
    );
    await checkout({ delivery: 'only' });
    fireEvent.change(screen.getByLabelText('Street number and name'), {
      target: { value: ' 5 Hay St ' },
    });
    fireEvent.change(screen.getByLabelText('Suburb'), { target: { value: 'Perth' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '6000' } });
    fireEvent.change(screen.getByLabelText('Notes for the driver (optional)'), {
      target: { value: 'ring twice' },
    });
    fireEvent.click(next());
    expect(await screen.findByText('Delivery to 5 Hay St, Perth 6000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(body['address']).toBeDefined());
    expect(body['address']).toEqual({
      street: '5 Hay St',
      suburb: 'Perth',
      postcode: '6000',
      notes: 'ring twice',
    });
  });

  const LOCATE = { name: /Add my exact location/ };
  const fillStreet = () =>
    fireEvent.change(screen.getByLabelText('Street number and name'), {
      target: { value: '5 Hay St' },
    });
  const setGeo = (value: unknown) =>
    Object.defineProperty(navigator, 'geolocation', { value, configurable: true });

  it('with a Maps key, "View on map" opens the in-app panel centred on lat,lng', async () => {
    setGeo({
      getCurrentPosition: vi.fn((ok: (p: unknown) => void) =>
        ok({ coords: { latitude: -31.9, longitude: 115.8 } }),
      ),
    });
    await checkout({ delivery: 'only', mapsKey: 'KEY1' });
    fillStreet();
    fireEvent.click(screen.getByRole('button', LOCATE));
    await screen.findByText('📍 Exact location added');
    expect(screen.queryByRole('link', { name: 'View on map' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View on map' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('q=-31.9%2C115.8');
    setGeo(undefined);
  });

  it('"Add my exact location" shows a chip with View on map and Remove; editing the street drops the pin', async () => {
    setGeo({
      getCurrentPosition: vi.fn((ok: (p: unknown) => void) =>
        ok({ coords: { latitude: -31.9, longitude: 115.8 } }),
      ),
    });
    const store = await checkout({ delivery: 'only' });
    expect(screen.getByText(/Your phone will ask permission/)).toBeInTheDocument();
    fillStreet();
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(await screen.findByText('📍 Exact location added')).toBeInTheDocument();
    expect(store.getState().customer.checkout.address).toMatchObject({ lat: -31.9, lng: 115.8 });
    expect(screen.getByRole('link', { name: 'View on map' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-31.9,115.8',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(store.getState().customer.checkout.address?.lat).toBeUndefined();
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(await screen.findByText('📍 Exact location added')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Street number and name'), {
      target: { value: '7 Hay St' },
    });
    expect(store.getState().customer.checkout.address?.lat).toBeUndefined();
    setGeo(undefined);
  });

  it('a refusal gets a calm visible message', async () => {
    setGeo({ getCurrentPosition: vi.fn((_ok: unknown, fail?: () => void) => fail?.()) });
    await checkout({ delivery: 'only' });
    fillStreet();
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(await screen.findByText(/Couldn't get your location/)).toBeInTheDocument();
    setGeo(undefined);
  });

  it('shows "Finding your location…" while it waits', async () => {
    setGeo({ getCurrentPosition: vi.fn() });
    await checkout({ delivery: 'only' });
    fillStreet();
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(screen.getByRole('button', { name: 'Finding your location…' })).toBeDisabled();
    setGeo(undefined);
  });

  it('says so when location is not available on this page (no geolocation, or not https)', async () => {
    await checkout({ delivery: 'only' });
    fillStreet();
    setGeo(undefined);
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(await screen.findByText(/Location isn't available on this page/)).toBeInTheDocument();
    cleanup();
    setGeo({ getCurrentPosition: vi.fn() });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    await checkout({ delivery: 'only' });
    fillStreet();
    fireEvent.click(screen.getByRole('button', LOCATE));
    expect(await screen.findByText(/Location isn't available on this page/)).toBeInTheDocument();
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    setGeo(undefined);
  });

  it('"How we use this" opens a dialog with the full text, closes with Escape and returns focus', async () => {
    await checkout({ delivery: 'only' });
    const opener = screen.getByRole('button', { name: 'How we use this' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'How we use this' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(/Only .*'s team can see it/);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  const KEY = 'AIzaFakeKeyForTests_1234567890';
  const fillAddress = () => {
    fireEvent.change(screen.getByLabelText('Street number and name'), {
      target: { value: '5 Hay St' },
    });
    fireEvent.change(screen.getByLabelText('Suburb'), { target: { value: 'Perth' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '6000' } });
  };

  it('with a Maps key, "See my address on the map" opens a panel with the embedded map; Yes closes it', async () => {
    await checkout({ delivery: 'only', mapsKey: KEY });
    fillAddress();
    expect(screen.queryByRole('link', { name: /See my address/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '🗺 See my address on the map' }));
    const dialog = await screen.findByRole('dialog', { name: 'Check your address' });
    const frame = dialog.querySelector('iframe');
    expect(frame).toHaveAttribute(
      'src',
      `https://www.google.com/maps/embed/v1/place?key=${KEY}&q=5%20Hay%20St%2C%20Perth%206000`,
    );
    expect(frame).toHaveAttribute('title', 'Map showing your address');
    expect(frame).toHaveAttribute('loading', 'lazy');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, looks right' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the panel uses the exact location when one was added; Fix address closes it and focuses Street', async () => {
    setGeo({
      getCurrentPosition: vi.fn((ok: (p: unknown) => void) =>
        ok({ coords: { latitude: -31.9, longitude: 115.8 } }),
      ),
    });
    await checkout({ delivery: 'only', mapsKey: KEY });
    fillAddress();
    fireEvent.click(screen.getByRole('button', LOCATE));
    await screen.findByText('📍 Exact location added');
    fireEvent.click(screen.getByRole('button', { name: '🗺 See my address on the map' }));
    const dialog = await screen.findByRole('dialog', { name: 'Check your address' });
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toContain('&q=-31.9%2C115.8');
    fireEvent.click(screen.getByRole('button', { name: 'Fix address' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByLabelText('Street number and name')).toHaveFocus());
    setGeo(undefined);
  });

  it('without the server key there is no field and nothing is blocked', async () => {
    await checkout({ addresses: false, delivery: 'only' });
    expect(screen.queryByTestId('address-section')).toBeNull();
    expect(next()).toBeEnabled();
    expect(screen.getByText(/send your address to the seller on WhatsApp/)).toBeInTheDocument();
  });
});

describe('texts that used to say the address goes on WhatsApp', () => {
  it('the note helper points to the address box when addresses are on', async () => {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(SAVED));
    await checkout({ delivery: 'only' });
    fireEvent.click(next());
    expect(
      await screen.findByText(/Put your address in Delivery address above/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Don't write your phone number here|don't write your phone number/),
    ).toBeInTheDocument();
    expect(screen.getByText('Delivery to 12 Jetty Road, Glenelg 5045')).toBeInTheDocument();
    expect(screen.queryByText(/Address on WhatsApp/)).toBeNull();
  });
});
