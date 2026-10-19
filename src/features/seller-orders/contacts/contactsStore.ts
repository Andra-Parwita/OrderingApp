import { normalisePhone } from '../../../../shared/phone';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import {
  addressText,
  findCustomer,
  listCustomers,
  saveForOrder,
  useAddressBook,
} from './addressBook';

// Customer contacts as the order screens use them (D-059): the phone number (so the WhatsApp button
// opens that chat) and a short delivery address, looked up by order. Since plan 071 they are read
// from, and written to, the seller's device address book (addressBook.ts), which also links repeat
// orders by the customer's anonymous code. Nothing here is ever sent to the server.

/** The number as digits with the country code (61...), and the address as typed; either may be empty. */
export type Contact = Readonly<{ phone: string; address: string }>;

/**
 * What is saved for this order on this device, or null. Pass the order's anonymous `customerCode`
 * (seller reads carry it) to find a linked customer's number from an earlier order.
 */
export function getContact(slug: string, code: string, customerCode?: string): Contact | null {
  const customer = findCustomer(slug, code, customerCode);
  const phone = customer?.phone ?? '';
  const address = addressText(customer?.address);
  return phone === '' && address === '' ? null : { phone, address };
}

/** The saved number as `61...` digits for the WhatsApp link, or null (the chat picker opens instead). */
export function getContactDigits(slug: string, code: string, customerCode?: string): string | null {
  const phone = getContact(slug, code, customerCode)?.phone;
  return phone ? phone : null;
}

export type SaveResult = 'saved' | 'invalid_phone' | 'not_persisted';

/**
 * Saves (or, with both fields empty, forgets) a contact. `phone` is typed text and is normalised;
 * an unreadable number is refused and nothing is saved.
 */
export function saveContact(
  slug: string,
  code: string,
  input: Readonly<{
    phone: string;
    address: string;
    /** The customer's first name, remembered with the number. */
    firstName?: string;
    /** The order's anonymous code, so later orders from the same phone find this entry. */
    customerCode?: string;
  }>,
  now: Date = new Date(),
): SaveResult {
  const typed = input.phone.trim();
  const phone = typed === '' ? '' : normalisePhone(typed);
  if (phone === null) return 'invalid_phone';
  const kept = saveForOrder(
    slug,
    code,
    input.customerCode,
    {
      phone,
      addressText: input.address,
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    },
    now,
  );
  return kept ? 'saved' : 'not_persisted';
}

/** How many customers this device holds (re-renders when the book changes). */
export function useContactBook(): number {
  const slug = currentSellerSlug();
  useAddressBook(slug);
  return listCustomers(slug).length;
}
