import i18n from 'i18next';
import en from './en.json';
import id from './id.json';
import { registerChangeFulfilmentI18n } from '../../../components/change-fulfilment/i18n/register';

export const PRIVATE_NS = 'sellerPrivate';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerPrivateI18n(): void {
  registerChangeFulfilmentI18n();
  i18n.addResourceBundle('en', PRIVATE_NS, en, true, true);
  i18n.addResourceBundle('id', PRIVATE_NS, id, true, true);
}
