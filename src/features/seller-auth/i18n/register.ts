import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const AUTH_NS = 'sellerAuth';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerAuthI18n(): void {
  i18n.addResourceBundle('en', AUTH_NS, en, true, true);
  i18n.addResourceBundle('id', AUTH_NS, id, true, true);
}
