import { DEFAULT_SELLER_SLUG, isValidSlug } from '../../../shared/seller';

// Which seller the seller screens act for. Dev only: phase 4 replaces this with the signed-in
// session (the seller then comes from the session, never from the device). The choice is stored
// per device and sent as the `X-Seller` header on every seller call.
export const SELLER_KEY = 'devSeller';

/** The chosen seller's slug; the dev default when none is chosen (or storage is unavailable). */
export function currentSellerSlug(): string {
  try {
    const stored = localStorage.getItem(SELLER_KEY);
    if (isValidSlug(stored)) return stored;
  } catch {
    // storage unavailable: fall back to the default seller
  }
  return DEFAULT_SELLER_SLUG;
}

export function chooseSeller(slug: string): void {
  try {
    localStorage.setItem(SELLER_KEY, slug);
  } catch {
    // storage unavailable: the choice just does not stick
  }
}
