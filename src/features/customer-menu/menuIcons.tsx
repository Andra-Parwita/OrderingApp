import { memo } from 'react';
import { styled } from 'styled-components';

// Outline icons for the customer menu screens (the shared Icon set has no clock, pin or pause).
// Decoration only: a word always sits beside each one (status is icon plus word).
const PATHS = {
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
  help: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 114 2c-.8.6-1.5 1-1.5 2M12 17h.01',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  pause: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 9v6M14 9v6',
  ban: 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 016 0',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  chat: 'M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  bin: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  navigate: 'M4 11l16-7-7 16-2-7z',
} as const;

export type MenuIconName = keyof typeof PATHS;

const Svg = styled.svg<{ $size: string }>`
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

export const MenuIcon = memo(function MenuIcon({
  name,
  size = '1.25rem',
}: Readonly<{ name: MenuIconName; size?: string }>) {
  return (
    <Svg viewBox="0 0 24 24" $size={size} aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </Svg>
  );
});
