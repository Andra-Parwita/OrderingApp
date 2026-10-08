/**
 * Normalises an Australian mobile number to digits with the country code (61…), or null.
 * Accepts `0412 345 678`, `+61412345678`, `61412345678`, with spaces, dashes or brackets.
 */
export function normaliseAuMobile(input: string): string | null {
  const text = input.trim();
  if (!/^\+?[\d\s\-()]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  let national: string;
  if (digits.startsWith('61')) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else return null;
  // A leading + or 61 prefix means no trunk 0 is expected; an 0 prefix is only valid without it.
  return /^4\d{8}$/.test(national) ? `61${national}` : null;
}

/** "61412345678" as "+61 412 345 678"; anything else as "+digits". */
export function formatPhone(digits: string): string {
  const match = /^61(\d{3})(\d{3})(\d{3})$/.exec(digits);
  return match ? `+61 ${match[1]} ${match[2]} ${match[3]}` : `+${digits}`;
}
