import type { KitchenSettings, LocalText } from '../../../shared/domain';
import { formatPhone, normaliseAuMobile } from '../../../shared/phone';

// Branding, images and devices come in batches 3 and 4; this is the minimal settings page.

export type Draft = {
  orderingOpen: boolean;
  phone: string;
  greeting: LocalText;
  closing: LocalText;
};

export function toDraft(settings: KitchenSettings): Draft {
  return {
    orderingOpen: settings.orderingOpen,
    phone: settings.whatsappNumber ? formatPhone(settings.whatsappNumber) : '',
    greeting: settings.postGreeting,
    closing: settings.postClosing,
  };
}

/** The same check the server makes; an empty number is allowed (it removes the number). */
export function phoneIsValid(phone: string): boolean {
  return phone.trim() === '' || normaliseAuMobile(phone) !== null;
}

export function toSettings(draft: Draft): KitchenSettings {
  const phone = draft.phone.trim();
  return {
    ...(phone !== '' ? { whatsappNumber: phone } : {}),
    postGreeting: draft.greeting,
    postClosing: draft.closing,
    orderingOpen: draft.orderingOpen,
  };
}
