// Plan 087 ("Remember me"): the saved delivery address is sealed on the phone with a key that comes
// from the passkey's PRF output (WebAuthn PRF -> HKDF -> AES-GCM). The server stores ciphertext only.
// The key is non-extractable and lives in this phone's IndexedDB (keyStore.ts); the PRF output itself
// is used once and never stored, logged or sent.
import { parseDeliveryAddress, type DeliveryAddress } from '../../../shared/address';
import type { SealedAddress } from '../../../shared/customerContract';

export const PRF_SALT_LABEL = 'remember-me/address/v1';
const HKDF_INFO = 'address-v1';
const FORMAT_VERSION = 1;

const utf8 = (text: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new TextEncoder().encode(text));

export function toB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function fromB64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** The fixed PRF salt: SHA-256 of the label, the same on every phone. */
export async function prfSalt(): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(PRF_SALT_LABEL)));
}

/** HKDF-SHA256 of the PRF output -> a non-extractable AES-GCM key. */
export async function keyFromPrf(prf: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    prf instanceof Uint8Array ? new Uint8Array(prf) : prf,
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8(HKDF_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Tied to the passkey: a blob moved to another credential does not open. */
const aadOf = (credentialId: string): Uint8Array<ArrayBuffer> => utf8(`v1:${credentialId}`);

export async function sealAddress(
  key: CryptoKey,
  address: DeliveryAddress,
  credentialId: string,
): Promise<SealedAddress> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadOf(credentialId) },
    key,
    utf8(JSON.stringify(address)),
  );
  return { v: FORMAT_VERSION, iv: toB64Url(iv), ct: toB64Url(ct) };
}

/** The address, or null when the blob is not ours, is damaged or the key is wrong. */
export async function openAddress(
  key: CryptoKey,
  sealed: SealedAddress,
  credentialId: string,
): Promise<DeliveryAddress | null> {
  if (sealed.v !== FORMAT_VERSION) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64Url(sealed.iv), additionalData: aadOf(credentialId) },
      key,
      fromB64Url(sealed.ct),
    );
    return parseDeliveryAddress(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    return null;
  }
}
