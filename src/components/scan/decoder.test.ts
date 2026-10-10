import { correction, generate } from 'lean-qr';
import { describe, expect, it } from 'vitest';
import { decodePixels } from './decoder';

/** A QR as RGBA pixels, black on white, the way OrderQr draws it. */
function qrPixels(text: string, scale = 6, quiet = 4) {
  const bitmap = generate(text, { minCorrectionLevel: correction.M });
  const side = (bitmap.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      if (bitmap.get(mx, my)) {
        const at = (y * side + x) * 4;
        data[at] = data[at + 1] = data[at + 2] = 20;
      }
    }
  }
  return { data, side };
}

describe('decodePixels', () => {
  it('reads the order code back from its QR image', async () => {
    const { data, side } = qrPixels('K7F2QX');
    expect(await decodePixels(data, side, side)).toBe('K7F2QX');
  });

  it('returns null for a frame without a code', async () => {
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(await decodePixels(blank, 100, 100)).toBeNull();
  });
});
