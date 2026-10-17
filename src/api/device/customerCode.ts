// Plan 071 (D-099): this phone's anonymous customer code for one kitchen. Random (no name, phone or
// email in it), different for every kitchen so kitchens cannot link a customer across each other,
// kept on the phone and sent with each order. A cleared phone makes a new one.
import { CUSTOMER_CODE_RE, parseCustomerCode } from '../../../shared/customerCode';

const prefix = 'customerCode:';

function makeCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return CUSTOMER_CODE_RE.test(code) ? code : '';
}

/** The code for this kitchen (made and stored the first time), or null if the phone cannot make one. */
export function customerCodeFor(slug: string): string | null {
  const key = `${prefix}${slug}`;
  let stored: string | null;
  try {
    stored = parseCustomerCode(localStorage.getItem(key));
  } catch {
    // storage unavailable: a code that is not kept would only fragment the seller's links
    return null;
  }
  if (stored !== null) return stored;
  const code = makeCode();
  if (code === '') return null;
  try {
    localStorage.setItem(key, code);
  } catch {
    return null;
  }
  return code;
}

/** The code this phone already holds for the kitchen, or null (never makes one). */
export function storedCustomerCode(slug: string): string | null {
  try {
    return parseCustomerCode(localStorage.getItem(`${prefix}${slug}`));
  } catch {
    return null;
  }
}

/** Plan 087: Remember me gives every phone the same code for a kitchen; this phone adopts it. */
export function setCustomerCode(slug: string, code: string): void {
  if (parseCustomerCode(code) === null) return;
  try {
    localStorage.setItem(`${prefix}${slug}`, code);
  } catch {
    // storage unavailable: the phone keeps using what it has
  }
}
