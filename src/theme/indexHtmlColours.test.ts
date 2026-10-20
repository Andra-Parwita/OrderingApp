import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brands, neutral } from './designTokens';

// Plan 115: index.html carries copies of the page background and text colours for the loading
// splash. They must equal the design tokens, or the splash colour jumps when the app takes over.
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

describe('index.html splash colours', () => {
  it('page background equals designTokens for every theme and mode', () => {
    for (const [name, colours] of Object.entries(brands)) {
      for (const mode of ['light', 'dark'] as const) {
        for (const selector of rules(name, mode)) {
          expect(valueIn(selector, '--bg'), `${name} ${mode}`).toBe(colours[mode].bg.toLowerCase());
        }
      }
    }
  });

  it('text colour equals the neutral text token in both modes', () => {
    expect(valueIn(':root', '--ink')).toBe(neutral.light.text.toLowerCase());
    expect(valueIn("html:not([data-theme='light'])", '--ink')).toBe(
      neutral.dark.text.toLowerCase(),
    );
    expect(valueIn("html[data-theme='dark']", '--ink')).toBe(neutral.dark.text.toLowerCase());
  });
});
