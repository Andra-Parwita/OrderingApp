import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const HISTORY_NS = 'sellerHistory';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerHistoryI18n(): void {
  i18n.addResourceBundle('en', HISTORY_NS, en, true, true);
  i18n.addResourceBundle('id', HISTORY_NS, id, true, true);
}
