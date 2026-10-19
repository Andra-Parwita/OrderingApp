import type { KitchenSettings, Language, Languages, LocalText } from '../../../shared/domain';
import { formatPhone, normalisePhone } from '../../../shared/phone';

// Branding, images and devices come in batches 3 and 4; this is the minimal settings page.

export type Draft = {
  orderingOpen: boolean;
  phone: string;
  greeting: LocalText;
  closing: LocalText;
  /** Plan 056; undefined = leave the kitchen's choice as it is. */
  languages?: Languages;
  /** Plan 060; undefined = leave it as it is. */
  firstLanguage?: Language | null;
};

export function toDraft(settings: KitchenSettings): Draft {
  return {
    orderingOpen: settings.orderingOpen,
    phone: settings.whatsappNumber ? formatPhone(settings.whatsappNumber) : '',
    greeting: settings.postGreeting,
    closing: settings.postClosing,
    ...(settings.languages !== undefined ? { languages: settings.languages } : {}),
    ...(settings.firstLanguage !== undefined ? { firstLanguage: settings.firstLanguage } : {}),
  };
}

/** The same check the server makes; an empty number is allowed (it removes the number). */
export function phoneIsValid(phone: string): boolean {
  return phone.trim() === '' || normalisePhone(phone) !== null;
}

export function toSettings(draft: Draft): KitchenSettings {
  const phone = draft.phone.trim();
  return {
    ...(draft.languages !== undefined ? { languages: draft.languages } : {}),
    ...(draft.firstLanguage !== undefined ? { firstLanguage: draft.firstLanguage } : {}),
    ...(phone !== '' ? { whatsappNumber: phone } : {}),
    postGreeting: draft.greeting,
    postClosing: draft.closing,
    orderingOpen: draft.orderingOpen,
  };
}
