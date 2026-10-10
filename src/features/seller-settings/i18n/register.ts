import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SETTINGS_NS = 'sellerSettings';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSettingsI18n(): void {
  i18n.addResourceBundle('en', SETTINGS_NS, en, true, true);
  i18n.addResourceBundle('id', SETTINGS_NS, id, true, true);
}
