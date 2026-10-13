import { currentSellerSlug } from './device/sellerContext';
import { fetchCurrentMenu, fetchSettings } from './client';
import { fetchPreferences } from './menus';
import {
  cachedRead,
  MENU_PREFIX as MENU_KEY,
  PREFERENCES_PREFIX as PREFERENCES_KEY,
  setCached,
  SETTINGS_PREFIX as SETTINGS_KEY,
} from './shortCache';
import type { MenuView } from '../../shared/menusContract';

// Plan 073: the small seller reads that many screens repeat, kept for a minute. `saveSettings`
// and `updatePreferences` clear their keys (see client.ts / settings.ts). The Settings forms
// themselves read fresh.

const worked = (result: { ok: boolean }) => result.ok;

export function fetchSettingsCached() {
  return cachedRead(`${SETTINGS_KEY}${currentSellerSlug()}`, () => fetchSettings(), worked);
}

export function fetchPreferencesCached(slug = currentSellerSlug()) {
  return cachedRead(`${PREFERENCES_KEY}${slug}`, () => fetchPreferences(undefined, slug), worked);
}

/** The kitchen's current menu, for the "not published" badge: asked at most every 2 minutes. */
export function fetchCurrentMenuCached() {
  const slug = currentSellerSlug();
  return cachedRead(`${MENU_KEY}${slug}`, () => fetchCurrentMenu(undefined, slug), worked, 120_000);
}

/** The menu screens just got the new menu in an answer: the badge can use it without asking. */
export function noteCurrentMenu(view: MenuView): void {
  setCached(`${MENU_KEY}${currentSellerSlug()}`, { ok: true, data: { menu: view } });
}
