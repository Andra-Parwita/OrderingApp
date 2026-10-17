// Plan 071 (D-099): the customer's delivery address stays on this phone so the next checkout is
// prefilled. It leaves the phone only inside an order the customer places. Never logged.
import { parseDeliveryAddress, type DeliveryAddress } from '../../../shared/address';

export const ADDRESS_KEY = 'deliveryAddress';
/** Fired on `window` after the address is saved (plan 087: Remember me seals a copy). */
export const ADDRESS_SAVED = 'address:saved';

export function rememberAddress(address: DeliveryAddress): void {
  try {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
  } catch {
    // storage unavailable: checkout just asks again
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADDRESS_SAVED));
}

export function savedAddress(): DeliveryAddress | null {
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    return raw === null ? null : parseDeliveryAddress(JSON.parse(raw));
  } catch {
    return null;
  }
}
