// Plan 106: small display helpers shared by the link window and the customer list.

/** "…678" for a saved number, or ''. */
export const lastDigits = (phone: string | undefined): string =>
  phone ? `…${phone.slice(-3)}` : '';

/** A local date YYYY-MM-DD as "4 Oct" / "4 Okt" (no year, no weekday). */
export function shortDay(date: string, lang: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const at = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));
  return at.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Digits (61412345678) as the seller types them (0412 345 678); anything else unchanged. */
export function localPhone(digits: string | undefined): string {
  if (!digits) return '';
  const match = /^61(\d{3})(\d{3})(\d{3})$/.exec(digits);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : digits;
}
