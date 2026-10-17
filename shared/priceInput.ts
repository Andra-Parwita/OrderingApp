export const PRICE_MAX_CENTS = 1_000_000;
/** "10", "10.00", "10,50", "$10" to cents; null when it is not a price. */
export function parsePriceInput(text: string): number | null {
  const match = /^\s*\$?\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  const whole = match?.[1];
  if (whole === undefined) return null;
  const cents = Number(whole) * 100 + Number((match?.[2] ?? '').padEnd(2, '0'));
  return cents <= PRICE_MAX_CENTS ? cents : null;
}

/** Cents to the text of the price field: 1050 becomes "10.50". */
export function priceInputOf(cents: number): string {
  return `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;
}
