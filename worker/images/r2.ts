// Seller images in R2 (stage 8.3, D-046). The bytes live in the bucket under a content-hashed key;
// the repository keeps only the public path in `kitchen_images.ref`:
//
//   key  sellers/<sellerId>/<slot>-<16 hex of sha-256>.<png|jpg|webp>
//   ref  /images/<key>            (what `<img src>` uses; GET /images/* streams it from R2)
//
// The hash is in the key, so a key never changes its bytes and can be cached for a year; a new
// upload is a new key, and the old object is deleted once nothing refers to it.
import { checkImageUpload, type UploadSlot } from '../../shared/imageSlots';

/** The part of an R2 bucket that is used; the real binding fits it. */
export type ImageBucket = {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpEtag: string;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete(key: string): Promise<void>;
};

export const IMAGE_PATH_PREFIX = '/images/';

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const TYPE_OF: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const KEY = /^sellers\/[\w-]{1,80}\/[A-Za-z]{1,40}-[0-9a-f]{16}\.(png|jpg|webp)$/;

export function isImageKey(key: string): boolean {
  return KEY.test(key);
}

/** The Content-Type a key's extension stands for. */
export function contentTypeOfKey(key: string): string | undefined {
  return TYPE_OF[key.slice(key.lastIndexOf('.') + 1)];
}

/** "/images/sellers/x/railIcon-ab12….png" to its R2 key; undefined for any other ref. */
export function keyOfRef(ref: string | undefined): string | undefined {
  if (ref === undefined || !ref.startsWith(IMAGE_PATH_PREFIX)) return undefined;
  const key = ref.slice(IMAGE_PATH_PREFIX.length);
  return isImageKey(key) ? key : undefined;
}

export const refOfKey = (key: string): string => `${IMAGE_PATH_PREFIX}${key}`;

async function shortHash(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeDataUrl(dataUrl: string): Uint8Array<ArrayBuffer> {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Checks an upload (type, size, shape: the same rules the repository applies) and puts its bytes
 * in the bucket. Returns the ref to store, or null when the upload is invalid, so the caller can
 * let the repository produce the normal error.
 */
export async function putUploadedImage(
  bucket: ImageBucket,
  sellerId: string,
  slot: UploadSlot,
  dataUrl: unknown,
): Promise<{ key: string; ref: string } | null> {
  const check = checkImageUpload(slot, dataUrl);
  if (!check.ok) return null;
  const bytes = decodeDataUrl(dataUrl as string);
  const extension = EXTENSION[check.mime];
  if (!extension) return null;
  const key = `sellers/${sellerId}/${slot}-${await shortHash(bytes)}.${extension}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: check.mime } });
  return { key, ref: refOfKey(key) };
}

/** Deletes the objects behind these refs, ignoring refs that are not R2 images. */
export async function deleteImageRefs(
  bucket: ImageBucket,
  refs: ReadonlyArray<string | undefined>,
): Promise<void> {
  for (const ref of new Set(refs)) {
    const key = keyOfRef(ref);
    if (key) await bucket.delete(key);
  }
}
