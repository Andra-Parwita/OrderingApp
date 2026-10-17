import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const REMEMBER_NS = 'rememberMe';

/** Adds the Remember me strings to the app's i18n instance (after i18n is initialised). */
export function registerRememberMeI18n(): void {
  i18n.addResourceBundle('en', REMEMBER_NS, en, true, true);
  i18n.addResourceBundle('id', REMEMBER_NS, id, true, true);
}
