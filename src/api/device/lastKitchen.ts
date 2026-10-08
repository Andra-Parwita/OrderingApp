import { isValidSlug } from '../../../shared/seller';

// The customer app's Menu tab opens the last seller menu this phone visited (D-037).
export const LAST_KITCHEN_KEY = 'lastKitchen';

export function rememberKitchen(slug: string): void {
  try {
    localStorage.setItem(LAST_KITCHEN_KEY, slug);
  } catch {
    // storage unavailable: the Menu tab just opens the home page
  }
}

/** The slug of the last seller menu visited on this phone, or null. */
export function lastKitchen(): string | null {
  try {
    const stored = localStorage.getItem(LAST_KITCHEN_KEY);
    return isValidSlug(stored) ? stored : null;
  } catch {
    return null;
  }
}
