import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { joinAddress, splitAddress } from './addressParts';
import { registerPickupMapI18n } from './i18n/register';
import { PickupMapLine } from './PickupMapLine';
import { pickupMapInfo } from './pickupMapInfo';

const POINT = {
  id: 'p',
  place: 'Jetty',
  directions: { en: 'Blue gate', id: 'Gerbang biru' },
  window: { start: '10:00', end: '11:00' },
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
  registerPickupMapI18n();
  await i18n.changeLanguage('en');
});

function show(info: ReturnType<typeof pickupMapInfo>) {
  return render(
    <AppThemeProvider>
      <PickupMapLine info={info} />
    </AppThemeProvider>,
  );
}

describe('PickupMapLine', () => {
  it('draws nothing for a place without an address', () => {
    const { container } = show(pickupMapInfo(POINT, 'en'));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the address, Directions to Google Maps, and opens the panel only when asked', () => {
    show(pickupMapInfo({ ...POINT, address: '12 Jetty Road, Glenelg 5045' }, 'en'));
    expect(screen.getByText(/12 Jetty Road, Glenelg 5045/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Directions/ });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=12%20Jetty%20Road%2C%20Glenelg%205045',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View on map/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // No key: the panel has the address and Directions, no map.
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('loads the map in the panel when the page has a key', () => {
    show(pickupMapInfo({ ...POINT, address: 'A', lat: 1, lng: 2 }, 'en', 'KEY'));
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /View on map/ }));
    expect(document.querySelector('iframe')).toHaveAttribute(
      'src',
      'https://www.google.com/maps/embed/v1/place?key=KEY&q=1%2C2',
    );
  });
});

describe('address parts', () => {
  it('joins and splits the saved line', () => {
    const parts = {
      street: '12 Jetty Road',
      suburb: 'Glenelg',
      postcode: '5045',
      lat: null,
      lng: null,
    };
    expect(joinAddress(parts)).toBe('12 Jetty Road, Glenelg 5045');
    expect(splitAddress('12 Jetty Road, Glenelg 5045')).toEqual(parts);
    expect(splitAddress('Behind the church').street).toBe('Behind the church');
    expect(joinAddress({ ...parts, street: ' ' })).toBe('');
  });
});
