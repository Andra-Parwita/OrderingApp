import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SATURDAY_NS = 'sellerSaturday';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerSaturdayI18n(): void {
  i18n.addResourceBundle('en', SATURDAY_NS, en, true, true);
  i18n.addResourceBundle('id', SATURDAY_NS, id, true, true);
}
