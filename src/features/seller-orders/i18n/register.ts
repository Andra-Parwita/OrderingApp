import i18n from 'i18next';
import en from './en.json';
import id from './id.json';
import { registerChangeFulfilmentI18n } from '../../../components/change-fulfilment/i18n/register';
import { registerDraftI18n } from '../../../components/draft/i18n/register';
import { registerScanI18n } from '../../../components/scan/i18n/register';

export const SELLER_NS = 'seller';

/** Call once after i18n is initialised (feature strings stay out of src/i18n). */
export function registerSellerI18n(): void {
  registerScanI18n();
  registerChangeFulfilmentI18n();
  registerDraftI18n();
  i18n.addResourceBundle('en', SELLER_NS, en, true, true);
  i18n.addResourceBundle('id', SELLER_NS, id, true, true);
}
