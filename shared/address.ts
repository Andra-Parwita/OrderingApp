// Plan 071 (D-099): a delivery address as guided fields, the one thing about a customer that may live
// in the cloud (encrypted, team-only, deleted a day after the menu). Pure helpers: the shape, its
// parser and the Maps links. The notes for the driver never go into a Maps link.
import {
  ADDRESS_NOTES_MAX,
  ADDRESS_POSTCODE_MAX,
  ADDRESS_STREET_MAX,
  ADDRESS_SUBURB_MAX,
} from './limits';
import { isRecord } from './parse';

export type DeliveryAddress = {
  street: string;
  suburb: string;
  postcode: string;
  /** Unit, gate, "call when here": shown to the team, never sent to Maps. */
  notes?: string;
  /** Map coordinates from "Use my location" (both or neither). */
  lat?: number;
  lng?: number;
};

function text(input: unknown, max: number): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return value.length <= max ? value : null;
}

/**
 * Trimmed address, or null if malformed. At least a street is needed (the rest may be empty).
 * Coordinates must be a real pair.
 */
export function parseDeliveryAddress(input: unknown): DeliveryAddress | null {
  if (!isRecord(input)) return null;
  const street = text(input['street'], ADDRESS_STREET_MAX);
  const suburb = text(input['suburb'] ?? '', ADDRESS_SUBURB_MAX);
  const postcode = text(input['postcode'] ?? '', ADDRESS_POSTCODE_MAX);
  const notes = text(input['notes'] ?? '', ADDRESS_NOTES_MAX);
  if (street === null || street === '' || suburb === null || postcode === null || notes === null) {
    return null;
  }
  const { lat, lng } = input;
  if ((lat === undefined) !== (lng === undefined)) return null;
  if (lat !== undefined) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return null;
  }
  return {
    street,
    suburb,
    postcode,
    ...(notes !== '' ? { notes } : {}),
    ...(typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}),
  };
}

/** The typed address on one line, for Maps (no notes). */
export function addressLine(
  address: Pick<DeliveryAddress, 'street' | 'suburb' | 'postcode'>,
): string {
  return [address.street, [address.suburb, address.postcode].filter((p) => p !== '').join(' ')]
    .filter((part) => part !== '')
    .join(', ');
}

/** "Check on map": the customer sees the pin for the typed address. */
export function checkOnMapUrl(address: DeliveryAddress, apple = false): string {
  const query = encodeURIComponent(addressLine(address));
  return apple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Directions for the driver: the coordinates when present, else the address. Never the notes. */
export function directionsUrl(address: DeliveryAddress, apple = false): string {
  const hasCoords = address.lat !== undefined && address.lng !== undefined;
  if (apple) {
    return hasCoords
      ? `https://maps.apple.com/?daddr=${String(address.lat)},${String(address.lng)}`
      : `https://maps.apple.com/?daddr=${encodeURIComponent(addressLine(address))}`;
  }
  const destination = hasCoords
    ? `${String(address.lat)},${String(address.lng)}`
    : encodeURIComponent(addressLine(address));
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/** Directions to a free-text address (a menu order's address kept on the phone). Plan 081. */
export function textDirectionsUrl(text: string, apple = false): string {
  const query = encodeURIComponent(text.trim());
  return apple
    ? `https://maps.apple.com/?daddr=${query}`
    : `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

/** A map search for a free-text address. */
export function textMapUrl(text: string, apple = false): string {
  const query = encodeURIComponent(text.trim());
  return apple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Street, suburb and postcode are all filled (the checkout needs them before it goes on). */
export function isAddressComplete(address: DeliveryAddress | null | undefined): boolean {
  return (
    !!address &&
    address.street.trim() !== '' &&
    address.suburb.trim() !== '' &&
    address.postcode.trim() !== ''
  );
}

/** A private order's address can be read and put on a map: a street is enough (suburb and postcode are optional). */
export function isAddressReadable(address: DeliveryAddress | null | undefined): boolean {
  return !!address && address.street.trim() !== '';
}

/** What the checkout sends: trimmed, no empty notes; null when it is not complete or not valid. */
export function addressForRequest(
  address: DeliveryAddress | null | undefined,
): DeliveryAddress | null {
  return isAddressComplete(address) ? parseDeliveryAddress(address) : null;
}
