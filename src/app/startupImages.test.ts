import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// iOS launch pictures: every <link> in index.html must point at a PNG of the right pixel size (docs/guide/launch-pictures.md).
const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');
const script = readFileSync(join(root, 'scripts/make-startup-images.mjs'), 'utf8');

const links = [...html.matchAll(/<link\s+rel="apple-touch-startup-image"[^>]*?>/gs)].map((m) => {
  const tag = m[0];
  const num = (name: string) => Number(new RegExp(`${name}: ([0-9]+)px`).exec(tag)?.[1]);
  const ratio = Number(/-webkit-device-pixel-ratio: (\d+)/.exec(tag)?.[1]);
  return {
    href: /href="([^"]+)"/.exec(tag)?.[1] ?? '',
    w: num('device-width'),
    h: num('device-height'),
    ratio,
  };
});

const sizeList = [
  ...(/export const sizes = \[([\s\S]*?)\];/.exec(script)?.[1] ?? '').matchAll(
    /\[(\d+),\s*(\d+)\]/g,
  ),
].map((m) => [Number(m[1]), Number(m[2])] as const);

describe('iOS launch pictures', () => {
  it('has links and a size list', () => {
    expect(links.length).toBeGreaterThan(0);
    expect(sizeList.length).toBeGreaterThan(0);
  });

  it('every link points to an existing file under public/', () => {
    for (const l of links) expect(existsSync(join(root, 'public', l.href)), l.href).toBe(true);
  });

  it('every PNG has the width and height of its link (CSS size x pixel ratio)', () => {
    for (const l of links) {
      const png = readFileSync(join(root, 'public', l.href));
      expect(png.toString('latin1', 1, 4), l.href).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], l.href).toEqual([
        l.w * l.ratio,
        l.h * l.ratio,
      ]);
    }
  });

  it('every size in the size list has a link', () => {
    for (const [w, h] of sizeList)
      expect(
        links.some((l) => l.w === w && l.h === h),
        `${w}x${h}`,
      ).toBe(true);
  });
});
