import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const NETWORK_NS = 'appNetwork';

/** Adds the offline banner strings to the app's i18n instance (after i18n is initialised). */
export function registerNetworkI18n(): void {
  i18n.addResourceBundle('en', NETWORK_NS, en, true, true);
  i18n.addResourceBundle('id', NETWORK_NS, id, true, true);
}
