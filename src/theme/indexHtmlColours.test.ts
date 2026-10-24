import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brands } from './designTokens';

// Plan 115: index.html carries copies of the page background colours (painted under the splash).
// They must equal the design tokens, or the page colour jumps when the app takes over.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function valueIn(selector: string, property: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(html);
  expect(rule, `rule ${selector}`).not.toBeNull();
  const value = new RegExp(`${property}:\\s*(#[0-9a-fA-F]{6})`).exec(rule?.[1] ?? '');
  expect(value, `${property} in ${selector}`).not.toBeNull();
  return (value?.[1] ?? '').toLowerCase();
}

const rules = (brand: string, mode: 'light' | 'dark'): Array<string> => {
  const attr = brand === 'onde' ? '' : `[data-brand='${brand}']`;
  if (mode === 'light') return brand === 'onde' ? [':root'] : [`html${attr}`];
  return [`html:not([data-theme='light'])${attr}`, `html[data-theme='dark']${attr}`];
};

describe('index.html colours', () => {
  it('page background equals designTokens for every theme and mode', () => {
    for (const [name, colours] of Object.entries(brands)) {
      for (const mode of ['light', 'dark'] as const) {
        for (const selector of rules(name, mode)) {
          expect(valueIn(selector, '--bg'), `${name} ${mode}`).toBe(colours[mode].bg.toLowerCase());
        }
      }
    }
  });

  // Hotfix 1.0.43.3: the splash is the dark spotlight in every mode and kitchen. Its colours are
  // pinned to the iOS launch picture's design, so the picture and the splash cannot drift apart.
  it('splash colours equal scripts/startup-images/kitchen.json', () => {
    const cfg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'scripts/startup-images/kitchen.json'), 'utf8'),
    ) as {
      edgeColor: string;
      centerColor: string;
      nameColor: string;
      iconSize: number;
      gap: string;
      font: { size: string };
      spotlight: { centerYPercent: number; radiusWidthFactor: number };
      cornerDarken: number;
      bottomDarken: number;
    };
    const rule = /#splash\s*\{([^}]*)\}/.exec(html)?.[1] ?? '';
    expect(rule).not.toBe('');
    const lower = rule.toLowerCase();
    expect(lower).toContain(`color: ${cfg.nameColor.toLowerCase()};`);
    expect(lower).toContain(`gap: ${cfg.gap};`);
    expect(lower).toMatch(new RegExp(`\\s${cfg.edgeColor.toLowerCase()};\\s*font-family`));
    expect(lower).toContain(
      `circle ${Math.round(cfg.spotlight.radiusWidthFactor * 100)}vw at 50% ${cfg.spotlight.centerYPercent}%`,
    );
    expect(lower).toContain(`${cfg.centerColor.toLowerCase()} 0%`);
    expect(lower).toContain(`${cfg.edgeColor.toLowerCase()} 100%`);
    expect(lower).toContain(`rgba(0, 0, 0, ${cfg.cornerDarken})`);
    expect(lower).toContain(`rgba(0, 0, 0, ${cfg.bottomDarken})`);
    // Group centred at 44%: padding-bottom = 2 x (50 - 44) vh.
    expect(lower).toContain(`padding-bottom: ${2 * (50 - cfg.spotlight.centerYPercent)}vh;`);
    expect(html).toContain(`width: ${cfg.iconSize}px;`);
    expect(html).toMatch(new RegExp(`#splash-name\\s*\\{[^}]*font-size: ${cfg.font.size};`));
    // The splash never reads the page tokens.
    expect(rule).not.toContain('var(--bg)');
  });
});
