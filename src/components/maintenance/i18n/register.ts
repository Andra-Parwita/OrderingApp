import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const MAINTENANCE_NS = 'appMaintenance';

/** Adds the maintenance notice and "Updating" screen strings to the app's i18n instance. */
export function registerMaintenanceI18n(): void {
  i18n.addResourceBundle('en', MAINTENANCE_NS, en, true, true);
  i18n.addResourceBundle('id', MAINTENANCE_NS, id, true, true);
}
