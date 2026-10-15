import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const PICKUP_MAP_NS = 'pickupMap';

/** Adds the pickup map strings to the app's i18n instance (after i18n is initialised). */
export function registerPickupMapI18n(): void {
  i18n.addResourceBundle('en', PICKUP_MAP_NS, en, true, true);
  i18n.addResourceBundle('id', PICKUP_MAP_NS, id, true, true);
}
