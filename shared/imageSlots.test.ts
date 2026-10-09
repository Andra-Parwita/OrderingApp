import { describe, expect, it } from 'vitest';
import { fakeJpeg, fakePng, fakeWebp, pngFor } from '../mocks/images';
import { checkImageUpload, IMAGE_SLOTS, isImageSlot, readImageSize, slotSpec } from './imageSlots';

describe('slotSpec', () => {
  it('gives the D-038 / D-040 sizes, ratios and 600 KB cap', () => {
    expect(slotSpec('desktopBanner')).toEqual({ width: 2000, height: 400, ratio: 5, maxKB: 600 });
    expect(slotSpec('phoneBanner')).toMatchObject({ width: 1200, height: 400, ratio: 3 });
    expect(slotSpec('railImage')).toMatchObject({ width: 1200, height: 600, ratio: 2 });
    expect(slotSpec('railIcon')).toMatchObject({ width: 512, height: 512, ratio: 1 });
    expect(slotSpec('bannerBackgroundImage')).toMatchObject({ width: 1280, height: 256, ratio: 5 });
    expect(IMAGE_SLOTS).toHaveLength(5);
  });

  it('knows its slots', () => {
    expect(isImageSlot('railIcon')).toBe(true);
    expect(isImageSlot('logo')).toBe(false);
    expect(isImageSlot(3)).toBe(false);
  });
});

describe('readImageSize', () => {
  const bytes = (dataUrl: string) => {
    const [head, base64] = dataUrl.split(',') as [string, string];
    const mime = head.slice(5, head.indexOf(';'));
    return { mime, data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) };
  };

  it('reads png, jpeg and the three webp kinds from the header', () => {
    for (const [url, size] of [
      [fakePng(1600, 320), { width: 1600, height: 320 }],
      [fakeJpeg(1080, 540), { width: 1080, height: 540 }],
      [fakeWebp(448, 224, 'vp8x'), { width: 448, height: 224 }],
      [fakeWebp(128, 128, 'vp8l'), { width: 128, height: 128 }],
      [fakeWebp(2560, 512, 'vp8'), { width: 2560, height: 512 }],
    ] as const) {
      const { mime, data } = bytes(url);
      expect(readImageSize(data, mime)).toEqual(size);
    }
  });

  it('returns null for bytes that are not the declared type', () => {
    const { data } = bytes(fakePng(10, 10));
    expect(readImageSize(data, 'image/jpeg')).toBeNull();
    expect(readImageSize(data, 'image/webp')).toBeNull();
    expect(readImageSize(new Uint8Array([1, 2, 3]), 'image/png')).toBeNull();
  });
});

describe('checkImageUpload', () => {
  it('accepts an exact-size image of each type', () => {
    expect(checkImageUpload('desktopBanner', pngFor('desktopBanner'))).toMatchObject({ ok: true });
    expect(checkImageUpload('phoneBanner', fakeJpeg(1200, 400))).toMatchObject({ ok: true });
    expect(checkImageUpload('railIcon', fakeWebp(128, 128))).toMatchObject({ ok: true });
  });

  it('accepts a ratio within 5% and refuses one beyond it', () => {
    expect(checkImageUpload('desktopBanner', fakePng(1600, 335))).toMatchObject({ ok: true });
    expect(checkImageUpload('desktopBanner', fakePng(1600, 350))).toEqual({
      ok: false,
      error: 'image_ratio',
    });
    expect(checkImageUpload('railIcon', fakePng(128, 100))).toEqual({
      ok: false,
      error: 'image_ratio',
    });
    expect(checkImageUpload('phoneBanner', pngFor('desktopBanner'))).toEqual({
      ok: false,
      error: 'image_ratio',
    });
  });

  it('refuses the wrong type, a bad data URL, and an image that is not what it says', () => {
    const wrong = { ok: false, error: 'image_type' };
    expect(checkImageUpload('railIcon', 'data:image/gif;base64,R0lGODlh')).toEqual(wrong);
    expect(checkImageUpload('railIcon', 'data:image/svg+xml;base64,PHN2Zz4=')).toEqual(wrong);
    expect(checkImageUpload('railIcon', 'https://example.com/a.png')).toEqual(wrong);
    expect(checkImageUpload('railIcon', 42)).toEqual(wrong);
    expect(checkImageUpload('railIcon', 'data:image/png;base64,AAAA')).toEqual(wrong);
    expect(
      checkImageUpload('railIcon', fakePng(128, 128).replace('image/png', 'image/jpeg')),
    ).toEqual(wrong);
  });

  it('refuses more than 600 KB and accepts just under', () => {
    const limit = 600 * 1024;
    const header = 24;
    expect(checkImageUpload('railIcon', fakePng(128, 128, limit - header + 1))).toEqual({
      ok: false,
      error: 'image_too_big',
    });
    expect(checkImageUpload('railIcon', fakePng(128, 128, limit - header))).toMatchObject({
      ok: true,
      bytes: limit,
    });
    expect(checkImageUpload('railIcon', fakePng(128, 128, limit * 3))).toEqual({
      ok: false,
      error: 'image_too_big',
    });
  });
});
