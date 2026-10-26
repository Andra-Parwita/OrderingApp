import { whatsAppUrl } from '../../api/device/whatsapp';

/** Hands the text to the phone's share sheet, or to WhatsApp's own link where there is none. */
export function shareToWhatsApp(text: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    // Closing the sheet rejects the promise; that is not an error.
    return navigator.share({ text }).catch(() => undefined);
  }
  window.open(whatsAppUrl(text), '_blank', 'noopener');
  return Promise.resolve();
}
