import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const HOME_NS = 'sellerHome';

/**
 * Adds this feature's strings. Call once after i18n is initialised (src/main.tsx may call it like
 * the other features); the screens also call it themselves, so they never show bare keys.
 */
export function registerSellerHomeI18n(): void {
  if (i18n.hasResourceBundle('en', HOME_NS) && i18n.hasResourceBundle('id', HOME_NS)) return;
  i18n.addResourceBundle('en', HOME_NS, en, true, true);
  i18n.addResourceBundle('id', HOME_NS, id, true, true);
}
