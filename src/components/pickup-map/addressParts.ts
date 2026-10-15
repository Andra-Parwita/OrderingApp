import { addressLine } from '../../../shared/address';
import { PICKUP_ADDRESS_MAX } from '../../../shared/pickupAddress';

/** The guided fields of a pickup address, with the optional pin. The place keeps one line of text. */
export type AddressParts = {
  street: string;
  suburb: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
};

export const NO_ADDRESS: AddressParts = {
  street: '',
  suburb: '',
  postcode: '',
  lat: null,
  lng: null,
};

/** The saved line "Street, Suburb 1234" back into fields; anything else lands whole in the street. */
export function splitAddress(
  address: string | undefined,
  lat?: number,
  lng?: number,
): AddressParts {
  const pin = { lat: lat ?? null, lng: lng ?? null };
  if (!address) return { ...NO_ADDRESS };
  const comma = address.lastIndexOf(', ');
  if (comma < 0) return { street: address, suburb: '', postcode: '', ...pin };
  const rest = address.slice(comma + 2);
  const match = /^(.*?)\s*(\d{3,10})$/.exec(rest);
  return {
    street: address.slice(0, comma),
    suburb: match ? (match[1] ?? '') : rest,
    postcode: match ? (match[2] ?? '') : '',
    ...pin,
  };
}

/** The one line that is saved; '' when there is no street (that means no address). */
export function joinAddress(parts: AddressParts): string {
  const street = parts.street.trim();
  if (street === '') return '';
  return addressLine({ street, suburb: parts.suburb.trim(), postcode: parts.postcode.trim() });
}

/** No address at all, or a street (with a line short enough to save). */
export function addressValid(parts: AddressParts): boolean {
  const line = joinAddress(parts);
  if (line === '') return parts.suburb.trim() === '' && parts.postcode.trim() === '';
  return line.length <= PICKUP_ADDRESS_MAX;
}
