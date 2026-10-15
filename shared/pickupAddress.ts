// Plan 076: a saved pickup place may carry an address and a map pin. Public on purpose (the seller's
// own place, shown to customers on the menu), so it is not encrypted like a customer address (D-099).
// Pure helpers: the shape, its parser and the Maps links.
import { isRecord, type Json } from './parse';

export const PICKUP_ADDRESS_MAX = 200;

/** The optional location of a pickup place: lat and lng come together and only with an address. */
export type PickupLocation = { address?: string; lat?: number; lng?: number };

function coordinate(value: unknown, min: number, max: number): number | null | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/**
 * Reads `address`, `lat` and `lng` of a record. Absent, null or empty means no location ({}).
 * Null when malformed: too long, a pin without an address, one coordinate alone, or out of bounds.
 */
export function parsePickupLocation(input: Json): PickupLocation | null {
  const rawAddress = input['address'];
  if (rawAddress !== undefined && rawAddress !== null && typeof rawAddress !== 'string') {
    return null;
  }
  const address = (rawAddress ?? '').trim();
  const lat = coordinate(input['lat'], -90, 90);
  const lng = coordinate(input['lng'], -180, 180);
  if (lat === null || lng === null) return null;
  if ((lat === undefined) !== (lng === undefined)) return null;
  if (address === '') return lat === undefined ? {} : null;
  if (address.length > PICKUP_ADDRESS_MAX) return null;
  return { address, ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}) };
}

/** Keeps only a usable location of a record (the public menu: an old row never breaks a menu). */
export function locationOf(input: unknown): PickupLocation {
  return isRecord(input) ? (parsePickupLocation(input) ?? {}) : {};
}

type Located = { address?: string | undefined; lat?: number | undefined; lng?: number | undefined };

function hasPin(place: Located): boolean {
  return place.lat !== undefined && place.lng !== undefined;
}

/** What the map shows: the pin when there is one, else the address. */
export function pickupMapQuery(place: Located): string {
  return hasPin(place) ? `${String(place.lat)},${String(place.lng)}` : (place.address ?? '');
}

/** Google Maps Embed URL for the panel (only built when the page has a key). */
export function pickupEmbedUrl(place: Located, key: string): string {
  return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(pickupMapQuery(place))}`;
}

/** Directions: the coordinates when present, else the encoded address. */
export function pickupDirectionsUrl(place: Located): string {
  const destination = hasPin(place)
    ? pickupMapQuery(place)
    : encodeURIComponent(place.address ?? '');
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
