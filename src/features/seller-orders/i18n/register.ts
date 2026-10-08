import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SELLER_NS = 'seller';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerI18n(): void {
  i18n.addResourceBundle('en', SELLER_NS, en, true, true);
  i18n.addResourceBundle('id', SELLER_NS, id, true, true);
}
