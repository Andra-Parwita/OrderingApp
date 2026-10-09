import type { ApiErrorCode } from './apiError';
import { IMAGE_MAX_KB } from './limits';

/** The five picture slots of a seller (D-038, D-040). */
export const IMAGE_SLOTS = [
  'desktopBanner',
  'phoneBanner',
  'railImage',
  'railIcon',
  'bannerBackgroundImage',
] as const;

export type ImageSlot = (typeof IMAGE_SLOTS)[number];

/** The per-menu picture (3:2, D-060) is uploaded like a slot but kept on the menu, not on the kitchen. */
export type UploadSlot = ImageSlot | 'menuPicture';

export type SlotSpec = {
  width: number;
  height: number;
  /** width / height */
  ratio: number;
  maxKB: number;
};

const SIZES: Record<UploadSlot, { width: number; height: number }> = {
  // Stage 10 sizes (handoff, Picture slots): wide banner 5:1, phone banner 3:1, kitchen menu
  // picture 2:1, small icon square, background 5:1.
  desktopBanner: { width: 2000, height: 400 },
  phoneBanner: { width: 1200, height: 400 },
  railImage: { width: 1200, height: 600 },
  railIcon: { width: 512, height: 512 },
  bannerBackgroundImage: { width: 1280, height: 256 },
  menuPicture: { width: 1200, height: 800 },
};

/** Target size of a slot, so the screen can resize before uploading. */
export function slotSpec(slot: UploadSlot): SlotSpec {
  const { width, height } = SIZES[slot];
  return { width, height, ratio: width / height, maxKB: IMAGE_MAX_KB };
}

/** The ratio may be off by this much (5%). */
export const RATIO_TOLERANCE = 0.05;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function isImageSlot(value: unknown): value is ImageSlot {
  return typeof value === 'string' && (IMAGE_SLOTS as ReadonlyArray<string>).includes(value);
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Size = { width: number; height: number };

function readPng(b: Uint8Array): Size | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || signature.some((byte, i) => b[i] !== byte)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(b: Uint8Array): Size | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0xff) {
      i++;
      continue;
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    const length = ((b[i + 2] as number) << 8) | (b[i + 3] as number);
    if (isFrame) {
      return {
        height: ((b[i + 5] as number) << 8) | (b[i + 6] as number),
        width: ((b[i + 7] as number) << 8) | (b[i + 8] as number),
      };
    }
    i += 2 + length;
  }
  return null;
}

function readWebp(b: Uint8Array): Size | null {
  const ascii = (at: number, text: string) =>
    [...text].every((c, k) => b[at + k] === c.charCodeAt(0));
  if (b.length < 30 || !ascii(0, 'RIFF') || !ascii(8, 'WEBP')) return null;
  const u24 = (at: number) =>
    (b[at] as number) | ((b[at + 1] as number) << 8) | ((b[at + 2] as number) << 16);
  if (ascii(12, 'VP8X')) return { width: u24(24) + 1, height: u24(27) + 1 };
  if (ascii(12, 'VP8L') && b[20] === 0x2f) {
    const bits =
      (b[21] as number) |
      ((b[22] as number) << 8) |
      ((b[23] as number) << 16) |
      ((b[24] as number) << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(12, 'VP8 ') && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return {
      width: ((b[26] as number) | ((b[27] as number) << 8)) & 0x3fff,
      height: ((b[28] as number) | ((b[29] as number) << 8)) & 0x3fff,
    };
  }
  return null;
}

/** Pixel size read from the image's own header; null when it is not a valid image of that type. */
export function readImageSize(bytes: Uint8Array, mime: string): Size | null {
  const size =
    mime === 'image/png'
      ? readPng(bytes)
      : mime === 'image/jpeg'
        ? readJpeg(bytes)
        : readWebp(bytes);
  return size && size.width > 0 && size.height > 0 ? size : null;
}

export type ImageCheck =
  | { ok: true; mime: string; bytes: number; width: number; height: number }
  | { ok: false; error: Extract<ApiErrorCode, 'image_type' | 'image_too_big' | 'image_ratio'> };

/**
 * Checks an upload for a slot: a base64 data URL of jpeg, png or webp, at most 600 KB, whose
 * header size has the slot's aspect ratio within 5%. The client resizes first (slotSpec).
 */
export function checkImageUpload(slot: UploadSlot, dataUrl: unknown): ImageCheck {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'image_type' };
  // Cheap size guard before the regex and the decode (base64 is 4/3 of the bytes).
  if (dataUrl.length > Math.ceil(((IMAGE_MAX_KB * 1024) / 3) * 4) + 64) {
    return { ok: false, error: 'image_too_big' };
  }
  const match = DATA_URL.exec(dataUrl);
  const mime = match?.[1];
  const base64 = match?.[2];
  if (!mime || !base64 || base64.length % 4 !== 0) return { ok: false, error: 'image_type' };
  let bytes: Uint8Array;
  try {
    bytes = decode(base64);
  } catch {
    return { ok: false, error: 'image_type' };
  }
  if (bytes.length > IMAGE_MAX_KB * 1024) return { ok: false, error: 'image_too_big' };
  const size = readImageSize(bytes, mime);
  if (!size) return { ok: false, error: 'image_type' };
  const { ratio } = slotSpec(slot);
  if (Math.abs(size.width / size.height - ratio) / ratio > RATIO_TOLERANCE) {
    return { ok: false, error: 'image_ratio' };
  }
  return { ok: true, mime, bytes: bytes.length, ...size };
}
