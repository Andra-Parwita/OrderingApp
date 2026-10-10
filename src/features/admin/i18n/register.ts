import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const ADMIN_NS = 'admin';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerAdminI18n(): void {
  i18n.addResourceBundle('en', ADMIN_NS, en, true, true);
  i18n.addResourceBundle('id', ADMIN_NS, id, true, true);
}
