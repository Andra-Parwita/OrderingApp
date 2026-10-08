import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { statusTones } from './tokens';
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
    ['text on surfaceAlt', colour.text, colour.surfaceAlt],
    ['muted text on surfaceAlt', colour.textMuted, colour.surfaceAlt],
    ['accent text on bg', colour.accent, colour.bg],
    ['accent text on surface', colour.accent, colour.surface],
    ['accent text on surfaceAlt', colour.accent, colour.surfaceAlt],
    ['indigo text on bg', colour.indigo, colour.bg],
    ['indigo text on surface', colour.indigo, colour.surface],
    ['indigo text on surfaceAlt', colour.indigo, colour.surfaceAlt],
    ['sageText on bg', colour.sageText, colour.bg],
    ['sageText on surface', colour.sageText, colour.surface],
    ['sageText on surfaceAlt', colour.sageText, colour.surfaceAlt],
    ['danger text on bg', colour.danger, colour.bg],
    ['danger text on surface', colour.danger, colour.surface],
    ['danger text on surfaceAlt', colour.danger, colour.surfaceAlt],
    ['onAccent on accent', colour.onAccent, colour.accent],
  ];
  for (const tone of statusTones) {
    textPairs.push([`status ${tone} text on tint`, theme.status[tone].fg, theme.status[tone].bg]);
  }
  const uiPairs: Array<[string, string, string]> = [
    ['outline on bg', colour.outline, colour.bg],
    ['outline on surface', colour.outline, colour.surface],
    ['outline on surfaceAlt', colour.outline, colour.surfaceAlt],
    ['focus ring on surfaceAlt', colour.focus, colour.surfaceAlt],
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
