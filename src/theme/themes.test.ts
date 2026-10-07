import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { darkTheme, lightTheme } from './themes';

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme contrast (WCAG AA)', (_name, theme) => {
  const { colour } = theme;
  const textPairs: Array<[string, string, string]> = [
    ['text on bg', colour.text, colour.bg],
    ['text on surface', colour.text, colour.surface],
    ['muted text on bg', colour.textMuted, colour.bg],
    ['muted text on surface', colour.textMuted, colour.surface],
    ['accent text on bg', colour.accent, colour.bg],
    ['onAccent on accent', colour.onAccent, colour.accent],
  ];
  const uiPairs: Array<[string, string, string]> = [
    ['outline on bg', colour.outline, colour.bg],
    ['outline on surface', colour.outline, colour.surface],
    ['focus ring on bg', colour.focus, colour.bg],
    ['focus ring on surface', colour.focus, colour.surface],
  ];

  it.each(textPairs)('%s is at least 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)('%s is at least 3:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
