import i18n from 'i18next';
import { registerPickupMapI18n } from '../../../components/pickup-map/i18n/register';
import en from './en.json';
import id from './id.json';

export const CUSTOMER_NS = 'customer';

/** Adds this feature's strings to the app's i18n instance; call after i18n is initialised. */
export function registerCustomerI18n(): void {
  i18n.addResourceBundle('en', CUSTOMER_NS, en, true, true);
  i18n.addResourceBundle('id', CUSTOMER_NS, id, true, true);
  registerPickupMapI18n();
}
