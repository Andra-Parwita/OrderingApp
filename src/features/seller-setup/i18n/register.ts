import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SETUP_NS = 'sellerSetup';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerSetupI18n(): void {
  i18n.addResourceBundle('en', SETUP_NS, en, true, true);
  i18n.addResourceBundle('id', SETUP_NS, id, true, true);
}
