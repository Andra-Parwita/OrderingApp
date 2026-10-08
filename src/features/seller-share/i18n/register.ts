import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SHARE_NS = 'sellerShare';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerShareI18n(): void {
  i18n.addResourceBundle('en', SHARE_NS, en, true, true);
  i18n.addResourceBundle('id', SHARE_NS, id, true, true);
}
