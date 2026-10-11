import { describe, expect, it } from 'vitest';
import { THEME_BAR_COLOUR } from '../../shared/themeColours';
import { brands } from './designTokens';

describe('THEME_BAR_COLOUR', () => {
  it('equals each theme light background in designTokens', () => {
    for (const [name, colours] of Object.entries(brands)) {
      expect(THEME_BAR_COLOUR[name as keyof typeof THEME_BAR_COLOUR]).toBe(colours.light.bg);
    }
    expect(Object.keys(THEME_BAR_COLOUR)).toEqual(Object.keys(brands));
  });
});
