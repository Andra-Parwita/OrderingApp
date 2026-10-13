import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const INCOME_NS = 'chefIncome';

/** Idempotent: the components call it, so tests and screens need no start-up wiring. */
export function registerChefIncomeI18n(): void {
  i18n.addResourceBundle('en', INCOME_NS, en, true, true);
  i18n.addResourceBundle('id', INCOME_NS, id, true, true);
}
