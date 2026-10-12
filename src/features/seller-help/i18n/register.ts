import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const HELP_NS = 'sellerHelp';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerHelpI18n(): void {
  i18n.addResourceBundle('en', HELP_NS, en, true, true);
  i18n.addResourceBundle('id', HELP_NS, id, true, true);
}
