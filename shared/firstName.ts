/**
 * Plan 129: a customer's first name must look real: at least 2 letters (any alphabet) and at least
 * one vowel (a e i o u y, accents count). Catches keyboard mashing such as "Bshsh". Only customers
 * are held to it; a seller typing an order for someone keeps the plain "not empty" rule.
 */
export function isPlausibleFirstName(name: string): boolean {
  const trimmed = name.trim();
  const letters = trimmed.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return false;
  // Accented vowels decompose to a base vowel plus a mark.
  return /[aeiouy]/i.test(trimmed.normalize('NFD'));
}
