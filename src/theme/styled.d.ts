import 'styled-components';
import type { minTapTarget, motion, radius, spacing, type } from './tokens';

declare module 'styled-components' {
  export interface DefaultTheme {
    mode: 'light' | 'dark';
    colour: {
      bg: string;
      surface: string;
      text: string;
      textMuted: string;
      hairline: string;
      outline: string;
      accent: string;
      onAccent: string;
      focus: string;
    };
    spacing: typeof spacing;
    type: typeof type;
    radius: typeof radius;
    motion: typeof motion;
    minTapTarget: typeof minTapTarget;
  }
}
