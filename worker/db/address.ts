// Delivery addresses (plan 071, D-099): AES-GCM (Web Crypto) with a master key from the secret
// ADDRESS_KEY (base64, 32 bytes). Stored as "iv.ciphertext" (base64 each), a fresh random 12-byte
// IV per value. Without a usable key nothing is stored and nothing is readable. The text and the key
// never reach a log.
import type { Db } from './d1';

/** One day after the menu finishes, the address goes. */
export const ADDRESS_KEEP_MS = 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The AES key from the secret, or null when it is missing or is not 32 bytes of base64. */
export async function importAddressKey(secret: string | undefined): Promise<CryptoKey | null> {
  if (secret === undefined || secret.trim() === '') return null;
  try {
    const raw = fromBase64(secret.trim());
    if (raw.length !== 32) return null;
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export async function encryptAddress(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

/** The address, or null when the key is wrong or missing, or the value is damaged. */
export async function decryptAddress(
  key: CryptoKey | null,
  stored: string,
): Promise<string | null> {
  if (key === null) return null;
  try {
    const [iv, cipher] = stored.split('.');
    if (iv === undefined || cipher === undefined) return null;
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(cipher),
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}

/**
 * Hourly: wipes the address of every order whose menu finished more than a day ago. Returns how many
 * went (a count only).
 */
export async function wipeOldAddresses(db: Db, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - ADDRESS_KEEP_MS).toISOString();
  const found = await db.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders o WHERE o.address_enc IS NOT NULL AND o.past_week_id IN
       (SELECT w.id FROM past_weeks w WHERE w.seller_id = o.seller_id AND w.closed_at <= ?)`,
    cutoff,
  );
  const count = found[0]?.n ?? 0;
  if (count === 0) return 0;
  await db.batch([
    db.stmt(
      `UPDATE orders SET address_enc = NULL WHERE address_enc IS NOT NULL AND past_week_id IN
       (SELECT w.id FROM past_weeks w WHERE w.seller_id = orders.seller_id AND w.closed_at <= ?)`,
      cutoff,
    ),
  ]);
  return count;
}
