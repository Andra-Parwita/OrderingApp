import type { DefaultTheme } from 'styled-components';
import { font, makeColors, size, type Brand, type Colors, type Mode } from './designTokens';
import { border, minTapTarget, motion, radius, spacing, type } from './tokens';

export type ThemeColors = { [K in keyof Colors]: string };

/** Sumatra's accent is red, so its danger moves toward orange-red to stay distinct (AA on surf). */
const sumatraDanger: Record<Mode, string> = { dark: '#FF8A5C', light: '#B33A0C' };

export function colorsFor(brand: Brand, mode: Mode): ThemeColors {
  const c: ThemeColors = makeColors(brand, mode);
  return brand === 'sumatra' ? { ...c, danger: sumatraDanger[mode] } : c;
}

const scrim: Record<Mode, string> = {
  dark: 'rgba(0, 0, 0, 0.55)',
  light: 'rgba(28, 31, 26, 0.42)',
};

export function makeTheme(brand: Brand, mode: Mode): DefaultTheme {
  const c = colorsFor(brand, mode);
  return {
    mode,
    c,
    font,
    size,
    // Deprecated aliases, all derived from `c`.
    colour: {
      bg: c.bg,
      surface: c.surf,
      surfaceAlt: c.surf2,
      text: c.text,
      textMuted: c.muted,
      hairline: c.line,
      outline: c.ctrl,
      accent: c.fill,
      onAccent: c.on,
      focus: c.fill,
      indigo: c.ready,
      gold: c.warn,
      sage: c.conf,
      sageText: c.conf,
      danger: c.danger,
      scrim: scrim[mode],
    },
    status: {
      ordered: { fg: c.atext, bg: c.tint },
      confirmed: { fg: c.conf, bg: c.surf2 },
      ready: { fg: c.warn, bg: c.warnTint },
      outForDelivery: { fg: c.ready, bg: c.surf2 },
      cancelled: { fg: c.danger, bg: c.surf2 },
      done: { fg: c.muted, bg: c.surf2 },
    },
    border,
    spacing,
    type,
    radius,
    motion,
    minTapTarget,
  };
}

export const lightTheme: DefaultTheme = makeTheme('onde', 'light');
export const darkTheme: DefaultTheme = makeTheme('onde', 'dark');
