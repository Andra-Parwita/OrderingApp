import { describe, expect, it } from 'vitest';
import { parseUpdatePickupPlaceRequest, parsePickupPlace } from './menusContract';
import {
  parsePickupLocation,
  pickupDirectionsUrl,
  pickupEmbedUrl,
  pickupMapQuery,
} from './pickupAddress';
import { parsePickupPointInput } from './setupContract';

const base = {
  place: 'Jetty',
  directions: { en: 'Blue gate', id: 'Gerbang biru' },
  window: { start: '10:00', end: '11:00' },
};

describe('parsePickupLocation', () => {
  it('treats absent, null and empty as no location', () => {
    expect(parsePickupLocation({})).toEqual({});
    expect(parsePickupLocation({ address: null })).toEqual({});
    expect(parsePickupLocation({ address: '   ' })).toEqual({});
  });

  it('trims the address and keeps a pin that comes as a pair', () => {
    expect(parsePickupLocation({ address: ' 12 Jetty Road ' })).toEqual({
      address: '12 Jetty Road',
    });
    expect(parsePickupLocation({ address: 'x', lat: -90, lng: 180 })).toEqual({
      address: 'x',
      lat: -90,
      lng: 180,
    });
  });

  it('refuses a long address, a lone coordinate, a pin without an address and bad bounds', () => {
    expect(parsePickupLocation({ address: 'x'.repeat(201) })).toBeNull();
    expect(parsePickupLocation({ address: 'x'.repeat(200) })).not.toBeNull();
    expect(parsePickupLocation({ address: 'x', lat: 1 })).toBeNull();
    expect(parsePickupLocation({ lat: 1, lng: 2 })).toBeNull();
    expect(parsePickupLocation({ address: 'x', lat: 90.1, lng: 0 })).toBeNull();
    expect(parsePickupLocation({ address: 'x', lat: 0, lng: -180.1 })).toBeNull();
    expect(parsePickupLocation({ address: 'x', lat: '1', lng: 2 })).toBeNull();
    expect(parsePickupLocation({ address: 5 })).toBeNull();
  });
});

describe('pickup place contracts', () => {
  it('the create request accepts none or a location, and refuses a bad one', () => {
    expect(parsePickupPointInput(base)).toEqual(base);
    expect(parsePickupPointInput({ ...base, address: ' A ', lat: 1, lng: 2 })).toEqual({
      ...base,
      address: 'A',
      lat: 1,
      lng: 2,
    });
    expect(parsePickupPointInput({ ...base, address: 'A', lat: 99, lng: 2 })).toBeNull();
  });

  it('the update replaces the whole location when address is sent; null removes it', () => {
    expect(parseUpdatePickupPlaceRequest({ address: null })).toEqual({
      address: null,
      lat: null,
      lng: null,
    });
    expect(parseUpdatePickupPlaceRequest({ address: 'A', lat: 1, lng: 2 })).toEqual({
      address: 'A',
      lat: 1,
      lng: 2,
    });
    expect(parseUpdatePickupPlaceRequest({ address: 'A' })).toEqual({
      address: 'A',
      lat: null,
      lng: null,
    });
    expect(parseUpdatePickupPlaceRequest({ lat: 1, lng: 2 })).toBeNull();
    expect(parseUpdatePickupPlaceRequest({ address: 'A', lat: 1 })).toBeNull();
  });

  it('a stored place reads with or without the fields', () => {
    expect(parsePickupPlace({ id: 'p', ...base })).toEqual({ id: 'p', ...base });
    expect(parsePickupPlace({ id: 'p', ...base, address: 'A', lat: 1, lng: 2 })).toMatchObject({
      address: 'A',
      lat: 1,
      lng: 2,
    });
  });
});

describe('Maps links', () => {
  it('uses the pin when there is one, else the encoded address', () => {
    const address = '12 Jetty Road, Glenelg 5045';
    expect(pickupDirectionsUrl({ address })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=12%20Jetty%20Road%2C%20Glenelg%205045',
    );
    expect(pickupDirectionsUrl({ address, lat: -34.98, lng: 138.51 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-34.98,138.51',
    );
    expect(pickupMapQuery({ address, lat: 1, lng: 2 })).toBe('1,2');
    expect(pickupEmbedUrl({ address, lat: 1, lng: 2 }, 'KEY')).toBe(
      'https://www.google.com/maps/embed/v1/place?key=KEY&q=1%2C2',
    );
    expect(pickupEmbedUrl({ address }, 'KEY')).toContain('q=12%20Jetty');
  });
});
