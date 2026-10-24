import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageReadError, resizeImage } from './imageResize';

// jsdom has no canvas: a fake Image and canvas, where the JPEG gets smaller as the quality drops.

/** Size in KB of the fake JPEG for a quality, for the test to choose its own curve. */
let sizeAtQuality: (quality: number) => number;
const asked: Array<number> = [];

class FakeImage {
  naturalWidth = 1200;
  naturalHeight = 400;
  onload: () => void = () => undefined;
  onerror: () => void = () => undefined;
  set src(_value: string) {
    queueMicrotask(() => this.onload());
  }
}

const dataUrlOfKB = (kb: number) =>
  `data:image/jpeg;base64,${'A'.repeat(Math.ceil((kb * 1024 * 4) / 3))}`;

beforeEach(() => {
  asked.length = 0;
  vi.stubGlobal('Image', FakeImage);
  URL.createObjectURL = () => 'blob:x';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: () => undefined,
    fillRect: () => undefined,
    drawImage: () => undefined,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((_type, quality) => {
    asked.push(quality as number);
    return dataUrlOfKB(sizeAtQuality(quality as number));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
const kbOf = (dataUrl: string) => ((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024;

describe('resizeImage keeps the phone banner shape (plan 123)', () => {
  const sizes: Array<number> = [];
  beforeEach(() => {
    sizes.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      sizes.push(this.width, this.height);
      return dataUrlOfKB(50);
    });
  });
  const pictureOf = (width: number, height: number) => {
    vi.stubGlobal(
      'Image',
      class extends FakeImage {
        override naturalWidth = width;
        override naturalHeight = height;
      },
    );
  };

  it('a 3:1 picture becomes 1200 x 400, a 2:1 one 1200 x 600, neither is "a different shape"', async () => {
    pictureOf(2400, 800);
    const wide = await resizeImage(photo, 'phoneBanner', '#ffffff');
    expect(wide.offRatio).toBe(false);
    expect(sizes.slice(0, 2)).toEqual([1200, 400]);
    sizes.length = 0;
    pictureOf(2400, 1200);
    const tall = await resizeImage(photo, 'phoneBanner', '#ffffff');
    expect(tall.offRatio).toBe(false);
    expect(sizes.slice(0, 2)).toEqual([1200, 600]);
  });

  it('another shape is still fitted into 1200 x 400 and flagged', async () => {
    pictureOf(1200, 800);
    const result = await resizeImage(photo, 'phoneBanner', '#ffffff');
    expect(result.offRatio).toBe(true);
    expect(sizes.slice(0, 2)).toEqual([1200, 400]);
  });
});

describe('resizeImage targets', () => {
  it('steps the phone banner down until it is about 100 KB, not the 600 KB cap', async () => {
    sizeAtQuality = (quality) => quality * 247.5; // 0.92 -> 227 KB (DellaVee), 0.4 -> 99 KB
    const result = await resizeImage(photo, 'phoneBanner', '#ffffff');
    expect(kbOf(result.dataUrl)).toBeLessThanOrEqual(100);
    expect(asked).toEqual([0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4]);
  });

  it('keeps another slot at the 600 KB cap: the first quality that fits is used', async () => {
    sizeAtQuality = (quality) => quality * 247.5;
    const result = await resizeImage(photo, 'railImage', '#ffffff');
    expect(asked).toEqual([0.92]);
    expect(kbOf(result.dataUrl)).toBeGreaterThan(100);
  });

  it('keeps the dish picture at 100 KB', async () => {
    sizeAtQuality = (quality) => quality * 247.5;
    await resizeImage(photo, 'dishPicture', '#ffffff');
    expect(asked).toEqual([0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4]);
  });

  it('refuses a phone banner that is still over 100 KB at the lowest quality', async () => {
    sizeAtQuality = () => 150;
    await expect(resizeImage(photo, 'phoneBanner', '#ffffff')).rejects.toBeInstanceOf(
      ImageReadError,
    );
  });
});
