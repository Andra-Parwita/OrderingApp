const AU_MOBILE = /^4\d{8}$/;

/**
 * Normalises a WhatsApp number to digits with the country code, or null (D-111).
 * `0412 345 678`, `61412345678` and `+61 412 345 678` are Australian mobiles (61 + 4xxxxxxxx, so
 * landlines stay refused). A leading `+` or `00` means another country: country code + number,
 * 8 to 15 digits, e.g. `+62 812 3456 7890`. Spaces, dashes and brackets are ignored.
 */
export function normalisePhone(input: string): string | null {
  const text = input.trim();
  if (!/^\+?[\d\s\-()]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  const international = text.startsWith('+') || digits.startsWith('00');
  if (international || digits.startsWith('61')) {
    const full = text.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : digits;
    if (full.startsWith('61')) return AU_MOBILE.test(full.slice(2)) ? full : null;
    return international && /^[1-9]\d{7,14}$/.test(full) ? full : null;
  }
  if (!digits.startsWith('0')) return null;
  const national = digits.slice(1);
  return AU_MOBILE.test(national) ? `61${national}` : null;
}

/** "61412345678" as "+61 412 345 678"; others as "+", two digits, then blocks of four. */
export function formatPhone(digits: string): string {
  const match = /^61(\d{3})(\d{3})(\d{3})$/.exec(digits);
  if (match) return `+61 ${match[1]} ${match[2]} ${match[3]}`;
  // shortcut: the country code length is unknown, so grouping is cosmetic only; upgrade with a code table if it matters.
  return `+${digits.replace(/^(\d{2})/, '$1 ').replace(/(\d{4})(?=\d)/g, '$1 ')}`;
}
