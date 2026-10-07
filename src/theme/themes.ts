import type { DefaultTheme } from 'styled-components';
import { minTapTarget, motion, radius, spacing, type } from './tokens';

export const lightTheme: DefaultTheme = {
  mode: 'light',
  colour: {
    bg: '#fafaf8',
    surface: '#f1f0ec',
    text: '#1f1f1c',
    textMuted: '#5c5b55',
    hairline: '#dcdad3',
    outline: '#85847c',
    accent: '#3d6656',
    onAccent: '#ffffff',
    focus: '#3d6656',
  },
  spacing,
  type,
  radius,
  motion,
  minTapTarget,
};

export const darkTheme: DefaultTheme = {
  mode: 'dark',
  colour: {
    bg: '#161614',
    surface: '#201f1d',
    text: '#ebeae4',
    textMuted: '#a5a39a',
    hairline: '#33322f',
    outline: '#7d7c74',
    accent: '#8cbba5',
    onAccent: '#0f1d17',
    focus: '#8cbba5',
  },
  spacing,
  type,
  radius,
  motion,
  minTapTarget,
};
