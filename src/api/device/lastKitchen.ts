import { isValidSlug } from '../../../shared/seller';
import { THEMES, type ThemeName } from '../../../shared/themes';

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

// The kitchen a home-screen app was launched on (plan 068): kept for the session, so its Menu tab
// does not follow the last kitchen opened elsewhere.
const APP_KITCHEN_KEY = 'appKitchen';

export function appKitchen(): string | null {
  try {
    const stored = sessionStorage.getItem(APP_KITCHEN_KEY);
    return isValidSlug(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function rememberAppKitchen(slug: string): void {
  try {
    sessionStorage.setItem(APP_KITCHEN_KEY, slug);
  } catch {
    // no session storage: the Menu tab follows the last kitchen
  }
}

// The colour theme of that kitchen (plan 024), for pages with no kitchen in the URL (My orders,
// Settings). It is only a first guess: the server's value replaces it whenever a menu or order loads.
export const LAST_KITCHEN_THEME_KEY = 'lastKitchenTheme';

export function rememberKitchenTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(LAST_KITCHEN_THEME_KEY, theme);
  } catch {
    // storage unavailable: those pages just use the default theme
  }
}

/** The theme of the last kitchen visited on this phone, or null. */
export function lastKitchenTheme(): ThemeName | null {
  try {
    const stored = localStorage.getItem(LAST_KITCHEN_THEME_KEY);
    return THEMES.find((theme) => theme === stored) ?? null;
  } catch {
    return null;
  }
}
