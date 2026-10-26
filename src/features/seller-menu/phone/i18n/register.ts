import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const PHONE_MENU_NS = 'sellerPhoneMenu';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerPhoneMenuI18n(): void {
  i18n.addResourceBundle('en', PHONE_MENU_NS, en, true, true);
  i18n.addResourceBundle('id', PHONE_MENU_NS, id, true, true);
}
