import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const TRANSLATE_NS = 'translate';

/** Adds the translate-button strings to the app's i18n instance (after i18n is initialised). */
export function registerTranslateI18n(): void {
  i18n.addResourceBundle('en', TRANSLATE_NS, en, true, true);
  i18n.addResourceBundle('id', TRANSLATE_NS, id, true, true);
}
