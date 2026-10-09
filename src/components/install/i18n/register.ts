import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const INSTALL_NS = 'customerInstall';

/** Adds the install and notification strings to the app's i18n instance (after i18n is initialised). */
export function registerInstallI18n(): void {
  i18n.addResourceBundle('en', INSTALL_NS, en, true, true);
  i18n.addResourceBundle('id', INSTALL_NS, id, true, true);
}
