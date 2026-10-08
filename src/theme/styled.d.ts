import 'styled-components';
import type { StatusTone, border, minTapTarget, motion, radius, spacing, type } from './tokens';

declare module 'styled-components' {
  export interface DefaultTheme {
    mode: 'light' | 'dark';
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
      /** Fills and bars only; never text on light surfaces (D-027). */
      gold: string;
      sage: string;
      /** Sage as text: darker in light mode for AA (D-027). */
      sageText: string;
      danger: string;
    };
    /** Muted status tints: text (fg) on tint (bg). Always paired with text, never colour-only. */
    status: Record<StatusTone, { fg: string; bg: string }>;
    border: typeof border;
    spacing: typeof spacing;
    type: typeof type;
    radius: typeof radius;
    motion: typeof motion;
    minTapTarget: typeof minTapTarget;
  }
}
