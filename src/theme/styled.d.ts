import 'styled-components';
import type { ThemeColors } from './themes';
import type { StatusTone, border, minTapTarget, motion, radius, spacing, type } from './tokens';
import type { font, size } from './designTokens';

declare module 'styled-components' {
  export interface DefaultTheme {
    mode: 'light' | 'dark';
    /** Every colour, from `makeColors(brand, mode)` (the seller design tokens). */
    c: ThemeColors;
    font: typeof font;
    size: typeof size;
    /**
     * @deprecated: derived aliases until each screen is redone (plan 001). New code reads `c`.
     */
    colour: {
      bg: string;
      surface: string;
      surfaceAlt: string;
      text: string;
      textMuted: string;
      hairline: string;
      outline: string;
      accent: string;
      onAccent: string;
      focus: string;
      indigo: string;
      gold: string;
      sage: string;
      sageText: string;
      danger: string;
      /** The dim layer behind a modal panel. */
      scrim: string;
    };
    /** @deprecated: derived from `c` (plan 001). Text (fg) on tint (bg), always paired with text. */
    status: Record<StatusTone, { fg: string; bg: string }>;
    border: typeof border;
    spacing: typeof spacing;
    type: typeof type;
    radius: typeof radius;
    motion: typeof motion;
    minTapTarget: typeof minTapTarget;
  }
}
