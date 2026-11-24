import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const PACK_NS = 'sellerPack';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerPackI18n(): void {
  i18n.addResourceBundle('en', PACK_NS, en, true, true);
  i18n.addResourceBundle('id', PACK_NS, id, true, true);
}
