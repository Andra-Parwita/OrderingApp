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

/** Speech bubbles (maintenance bar, short message): one step lighter than the bar in dark mode. */
const bubbleDark = { bg: '#2E332B', line: '#434A3F' };

/** Notice pills (plan 095, option E2): new version = solid green, announcement and maintenance = soft amber; tip (plan 096, N1) = soft stone. */
const noticeLight = {
  update: { bg: '#1F6B5C', fg: '#FFFFFF', xc: '#E3EFEA' },
  announce: { bg: '#FBF1D9', fg: '#3A2A00', xc: '#6B5A33' },
  maint: { bg: '#F7E3B0', fg: '#3A2A00', xc: '#5E4A1F' },
  tip: { bg: '#ECE8DF', fg: '#1C1F1A', xc: '#5D6358' },
};
const noticeDark = {
  update: { bg: '#93C590', fg: '#10200F', xc: '#10200F' },
  announce: { bg: '#3A3220', fg: '#F3E6C4', xc: '#CDBF98' },
  maint: { bg: '#4A3C1C', fg: '#F6EBD7', xc: '#DCCCA0' },
  tip: { bg: '#2A2C27', fg: '#F1EEE6', xc: '#A9AFA3' },
};

export function makeTheme(brand: Brand, mode: Mode): DefaultTheme {
  const c = colorsFor(brand, mode);
  return {
    mode,
    c,
    font,
    size,
    noticeShadow: mode === 'dark' ? 'rgb(0 0 0 / 45%)' : 'rgb(40 30 15 / 22%)',
    notice: mode === 'dark' ? noticeDark : noticeLight,
    bubble: mode === 'dark' ? bubbleDark : { bg: c.surf, line: c.line },
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
