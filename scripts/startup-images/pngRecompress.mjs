// Re-encodes an 8-bit RGB PNG as a small indexed PNG: the most frequent colours (the gradient) stay exact,
// rare ones (icon, text edges) snap to the nearest palette colour; palette sorted by brightness so row filters work;
// per-row best filter + zlib level 9. Deterministic, no dependency.
import { deflateSync, inflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

function unfilter(raw, w, h, bpp) {
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0;
      const b = y ? out[(y - 1) * stride + i] : 0;
      const c = y && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
      out[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + add) & 255;
    }
  }
  return out;
}

function quantise(rgb, size) {
  const n = rgb.length / 3;
  const counts = new Map();
  for (let p = 0; p < n; p++) {
    const k = (rgb[p * 3] << 16) | (rgb[p * 3 + 1] << 8) | rgb[p * 3 + 2];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, size)
    .map(([k]) => k);
  const lum = (k) => ((k >> 16) & 255) * 3 + ((k >> 8) & 255) * 6 + (k & 255);
  top.sort((a, b) => lum(a) - lum(b) || a - b);
  const index = new Map(top.map((k, i) => [k, i]));
  const near = (k) => {
    let best = 0;
    let bd = Infinity;
    top.forEach((q, i) => {
      const d =
        (((k >> 16) & 255) - ((q >> 16) & 255)) ** 2 +
        (((k >> 8) & 255) - ((q >> 8) & 255)) ** 2 +
        ((k & 255) - (q & 255)) ** 2;
      if (d < bd) [best, bd] = [i, d];
    });
    return best;
  };
  for (const k of counts.keys()) if (!index.has(k)) index.set(k, near(k));
  const indices = Buffer.alloc(n);
  for (let p = 0; p < n; p++)
    indices[p] = index.get((rgb[p * 3] << 16) | (rgb[p * 3 + 1] << 8) | rgb[p * 3 + 2]);
  const palette = Buffer.alloc(top.length * 3);
  top.forEach((k, i) => palette.set([(k >> 16) & 255, (k >> 8) & 255, k & 255], i * 3));
  return { palette, indices };
}

export function recompressPng(png, paletteSize = 256) {
  let pos = 8;
  let ihdr;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = data;
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  const src3 = ihdr[9] === 6 ? 4 : 3;
  if (ihdr[8] !== 8 || ![2, 6].includes(ihdr[9])) throw new Error('only 8-bit RGB/RGBA PNG');
  const rgb = unfilter(inflateSync(Buffer.concat(idat)), w, h, src3);
  const { palette, indices } = quantise(rgb, paletteSize);
  const bpp = 1;
  const stride = w;
  const raw = indices;
  const cur = Buffer.alloc(stride); // unfiltered current row
  let prev = Buffer.alloc(stride);
  const out = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw.copy(cur, 0, y * stride, (y + 1) * stride);
    let best = 0;
    let bestSum = Infinity;
    let bestRow;
    for (let t = 0; t < 5; t++) {
      const row = Buffer.alloc(stride);
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const sub = [0, a, b, (a + b) >> 1, paeth(a, b, c)][t];
        const v = (cur[i] - sub) & 255;
        row[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) [best, bestSum, bestRow] = [t, sum, row];
    }
    out[y * (stride + 1)] = best;
    bestRow.copy(out, y * (stride + 1) + 1);
    prev = Buffer.from(cur);
  }
  return Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', Buffer.concat([ihdr.subarray(0, 8), Buffer.from([8, 3, 0, 0, 0])])),
    chunk('PLTE', palette),
    chunk('IDAT', deflateSync(out, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
