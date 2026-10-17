import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const CHANGE_FULFILMENT_NS = 'changeFulfilment';

/** Adds the strings to the app's i18n instance (after i18n is initialised). */
export function registerChangeFulfilmentI18n(): void {
  i18n.addResourceBundle('en', CHANGE_FULFILMENT_NS, en, true, true);
  i18n.addResourceBundle('id', CHANGE_FULFILMENT_NS, id, true, true);
}
