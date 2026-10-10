import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const COOK_NS = 'sellerCook';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerCookI18n(): void {
  i18n.addResourceBundle('en', COOK_NS, en, true, true);
  i18n.addResourceBundle('id', COOK_NS, id, true, true);
}
