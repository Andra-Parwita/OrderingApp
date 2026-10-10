import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const SCAN_NS = 'scan';

/** Adds the scan strings to the app's i18n instance (after i18n is initialised). */
export function registerScanI18n(): void {
  i18n.addResourceBundle('en', SCAN_NS, en, true, true);
  i18n.addResourceBundle('id', SCAN_NS, id, true, true);
}
