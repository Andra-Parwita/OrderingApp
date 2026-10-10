// WebCrypto helpers for sign-in (D-011): SHA-256 for keys, codes and session tokens, PBKDF2 for
// passwords. Keys, codes and tokens are only ever stored as hashes.
import { ORDER_CODE_ALPHABET } from '../../shared/orderCode';

/** 100 000 is the most iterations the Workers runtime allows. */
export const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();

export function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fromHex(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

export async function pbkdf2Hex(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    256,
  );
  return hex(bits);
}

/** Characters from the order-code alphabet (32 symbols, so a byte maps without bias). */
export function randomChars(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => ORDER_CODE_ALPHABET.charAt(byte % 32)).join('');
}

export function randomDigits(length: number): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return [...bytes].map((value) => String(value % 10)).join('');
}

/** "dlv 7kq4-m9xp-2htr-w3nc" and "7KQ4M9XP2HTRW3NC" both become "DLV7KQ4M9XP2HTRW3NC". */
export function normaliseKey(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 16 ? `DLV${clean}` : clean;
}

export function formatKey(body: string): string {
  return `DLV-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12)}`;
}
