import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const MENU_NS = 'sellerMenu';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerMenuI18n(): void {
  i18n.addResourceBundle('en', MENU_NS, en, true, true);
  i18n.addResourceBundle('id', MENU_NS, id, true, true);
}
