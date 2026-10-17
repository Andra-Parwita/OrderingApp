// Plan 071 (D-099): the anonymous customer code. The customer's phone makes a random code per
// kitchen and sends it with each order, so the seller's device can link repeat orders to a saved
// customer. It holds no name, phone or email, and differs per kitchen.

/** Lower-case hex, 24 characters (12 random bytes). */
export const CUSTOMER_CODE_RE = /^[a-f0-9]{24}$/;

/** The code if well-formed, else null. */
export function parseCustomerCode(input: unknown): string | null {
  return typeof input === 'string' && CUSTOMER_CODE_RE.test(input) ? input : null;
}

/** Crockford base32: no I, L, O or U, so a code read aloud is not ambiguous. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Plan 087: how a seller sees a customer code, "C-7K3M": the first 20 bits of the 24-character
 * code as 4 Crockford base32 characters. Null when the code is not well-formed.
 */
export function shortCustomerCode(code: string): string | null {
  if (parseCustomerCode(code) === null) return null;
  const bits = parseInt(code.slice(0, 5), 16);
  let out = 'C-';
  for (let shift = 15; shift >= 0; shift -= 5) out += CROCKFORD.charAt((bits >> shift) & 31);
  return out;
}
