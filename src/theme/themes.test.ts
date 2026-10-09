import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { brands, type Brand, type Mode } from './designTokens';
import { statusTones } from './tokens';
import { colorsFor, makeTheme } from './themes';

const brandNames = Object.keys(brands) as Array<Brand>;
const modes: Array<Mode> = ['dark', 'light'];

/** Composites `#rrggbb` or `rgba(r,g,b,a)` over an opaque `#rrggbb` backdrop. */
function flatten(colour: string, over: string): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(colour);
  if (!m) return colour;
  const alpha = Number(m[4]);
  const back = Number.parseInt(over.slice(1), 16);
  const parts = [Number(m[1]), Number(m[2]), Number(m[3])].map((v, i) => {
    const b = (back >> (16 - 8 * i)) & 255;
    return Math.round(v * alpha + b * (1 - alpha));
  });
  return `#${parts.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe.each(brandNames.flatMap((brand) => modes.map((mode) => [brand, mode] as const)))(
  '%s %s contrast (WCAG AA)',
  (brand, mode) => {
    const c = colorsFor(brand, mode);
    const textPairs: Array<[string, string, string]> = [
      ['text on bg', c.text, c.bg],
      ['text on surf', c.text, c.surf],
      ['text on surf2', c.text, c.surf2],
      ['muted on bg', c.muted, c.bg],
      ['muted on surf', c.muted, c.surf],
      ['atext on surf', c.atext, c.surf],
      ['danger on surf', c.danger, c.surf],
      ['fill vs on', c.on, c.fill],
    ];
    it.each(textPairs)('%s is at least 4.5:1', (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it('control edge is at least 3:1 on surf', () => {
      expect(contrastRatio(c.ctrl, c.surf)).toBeGreaterThanOrEqual(3);
    });

    it.each(statusTones)('status %s text on its tint is at least 4.5:1', (tone) => {
      const { status } = makeTheme(brand, mode);
      const bg = flatten(status[tone].bg, c.surf);
      expect(contrastRatio(status[tone].fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  },
);

describe('Sumatra danger', () => {
  it.each(modes)('is AA on bg, surf and surf2 in %s', (mode) => {
    const c = colorsFor('sumatra', mode);
    for (const back of [c.bg, c.surf, c.surf2]) {
      expect(contrastRatio(c.danger, back)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(modes)('differs from the other brands in %s', (mode) => {
    expect(colorsFor('sumatra', mode).danger).not.toBe(colorsFor('onde', mode).danger);
  });
});
