// Plan 071 (D-099): the anonymous customer code. The customer's phone makes a random code per
// kitchen and sends it with each order, so the seller's device can link repeat orders to a saved
// customer. It holds no name, phone or email, and differs per kitchen.

/** Lower-case hex, 24 characters (12 random bytes). */
export const CUSTOMER_CODE_RE = /^[a-f0-9]{24}$/;

/** The code if well-formed, else null. */
export function parseCustomerCode(input: unknown): string | null {
  return typeof input === 'string' && CUSTOMER_CODE_RE.test(input) ? input : null;
}
