import type { Language } from './domain';

// Both languages show AUD with a "$" and "." decimals (owner ruling).
const locales: Record<Language, string> = { en: 'en-AU', id: 'en-AU' };

/** Integer cents to "$12.50". */
export function formatMoney(cents: number, lang: Language): string {
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString(locales[lang]);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${whole}.${fraction}`;
}
