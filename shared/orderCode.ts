/** No O/0 or I/1, so a code read aloud or by hand is not ambiguous. */
export const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ORDER_CODE_LENGTH = 6;

export type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

const cryptoFill: FillRandom = (bytes) => crypto.getRandomValues(bytes);

/** 6 characters; 256 is a multiple of 32, so a byte maps to the alphabet without bias. */
export function generateOrderCode(fill: FillRandom = cryptoFill): string {
  const bytes = fill(new Uint8Array(ORDER_CODE_LENGTH));
  let code = '';
  for (const byte of bytes) code += ORDER_CODE_ALPHABET.charAt(byte % ORDER_CODE_ALPHABET.length);
  return code;
}

/** "K7F2QX" to "K7F-2QX". */
export function formatOrderCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Forgiving input (lowercase, spaces, missing dash); returns the raw code or null. */
export function parseOrderCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== ORDER_CODE_LENGTH) return null;
  for (const char of code) if (!ORDER_CODE_ALPHABET.includes(char)) return null;
  return code;
}

/** The private order-link token: 24 random bytes (192 bits) as base64url. */
export function generateToken(fill: FillRandom = cryptoFill): string {
  const bytes = fill(new Uint8Array(24));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
