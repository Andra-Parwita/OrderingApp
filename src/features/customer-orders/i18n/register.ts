import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const ORDERS_NS = 'customerOrders';

/** Adds this feature's strings to the app's i18n instance; call after i18n is initialised. */
export function registerCustomerOrdersI18n(): void {
  i18n.addResourceBundle('en', ORDERS_NS, en, true, true);
  i18n.addResourceBundle('id', ORDERS_NS, id, true, true);
}
