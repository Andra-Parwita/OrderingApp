import { DEFAULT_SELLER_SLUG, isValidSlug } from '../../../shared/seller';

// Which seller the seller screens act for. Signed in, it is the session's seller (set by the
// app's session provider). Without a session it is the dev picker's choice (dev builds only),
// stored per device and sent as the `X-Seller` header on every seller call.
export const SELLER_KEY = 'devSeller';
const LAST_KEY = 'lastSignedIn';

let sessionSlug: string | null = null;

/** The signed-in session's seller (null when signed out); set by the session provider. */
export function setSessionSeller(slug: string | null): void {
  sessionSlug = slug;
}

/** Plan 013: the signed-in kitchen is a demo one; set by the session provider with the seller. */
let sessionDemo = false;
export function setSessionDemo(demo: boolean): void {
  sessionDemo = demo;
}
export const sessionIsDemo = (): boolean => sessionDemo;

/** The session's seller when signed in; else the dev choice, or the dev default. */
export function currentSellerSlug(): string {
  if (sessionSlug !== null && isValidSlug(sessionSlug)) return sessionSlug;
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

/** Who last signed in on this device: where `/seller/sign-in` leads when nothing else says. */
export type LastSignedIn = Readonly<{ slug: string; kitchenName?: string; chefId?: string }>;

export function rememberSignedIn(last: LastSignedIn): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    // storage unavailable: the device just forgets
  }
}

export function lastSignedIn(): LastSignedIn | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { slug, kitchenName, chefId } = value as Record<string, unknown>;
    if (typeof slug !== 'string' || !isValidSlug(slug)) return null;
    return {
      slug,
      ...(typeof kitchenName === 'string' ? { kitchenName } : {}),
      ...(typeof chefId === 'string' ? { chefId } : {}),
    };
  } catch {
    return null;
  }
}
