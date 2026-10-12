import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const DRAFT_NS = 'draft';

/** Adds the draft strings to the app's i18n instance (after i18n is initialised). */
export function registerDraftI18n(): void {
  i18n.addResourceBundle('en', DRAFT_NS, en, true, true);
  i18n.addResourceBundle('id', DRAFT_NS, id, true, true);
}
