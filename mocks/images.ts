// Tiny fake images for tests: just enough header for readImageSize, plus optional padding.
import type { UploadSlot } from '../shared/imageSlots';
import { slotSpec } from '../shared/imageSlots';

function toDataUrl(mime: string, bytes: Array<number>, padding: number): string {
  const all = new Uint8Array(bytes.length + padding);
  all.set(bytes);
  let binary = '';
  for (const byte of all) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export function fakePng(width: number, height: number, padding = 0): string {
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32(13), ...ascii('IHDR')];
  return toDataUrl('image/png', [...head, ...u32(width), ...u32(height)], padding);
}

export function fakeJpeg(width: number, height: number, padding = 0): string {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF'), ...new Array<number>(10).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 8, ...u16(height), ...u16(width), 3, 1, 0x22, 0, 2, 0x11, 1];
  return toDataUrl('image/jpeg', [0xff, 0xd8, ...app0, ...sof], padding);
}

export function fakeWebp(width: number, height: number, kind: 'vp8x' | 'vp8l' | 'vp8' = 'vp8x') {
  const riff = [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')];
  if (kind === 'vp8x') {
    const body = [
      ...ascii('VP8X'),
      10,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...le24(width - 1),
      ...le24(height - 1),
    ];
    return toDataUrl('image/webp', [...riff, ...body], 0);
  }
  if (kind === 'vp8l') {
    const bits = (width - 1) | ((height - 1) << 14);
    const packed = [bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255];
    return toDataUrl('image/webp', [...riff, ...ascii('VP8L'), 5, 0, 0, 0, 0x2f, ...packed], 8);
  }
  const body = [
    ...ascii('VP8 '),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    ...le16(width),
    ...le16(height),
  ];
  return toDataUrl('image/webp', [...riff, ...body], 4);
}

/** A png with exactly the slot's size (a correct upload). */
export function pngFor(slot: UploadSlot, padding = 0): string {
  const { width, height } = slotSpec(slot);
  return fakePng(width, height, padding);
}
