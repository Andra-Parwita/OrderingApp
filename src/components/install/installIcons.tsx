import { memo } from 'react';
import { styled } from 'styled-components';

// Outline icons for the install and notification screens. Decoration only: a word sits beside each.
const PATHS = {
  bell: 'M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4',
  bellOff: 'M6 17V11a6 6 0 019-5.2M18 11v6l2 2H4M10 21h4M3 3l18 18',
  checkCircle: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  compass: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
} as const;

export type InstallIconName = keyof typeof PATHS;

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

export const InstallIcon = memo(function InstallIcon({
  name,
  size = '1.25rem',
}: Readonly<{ name: InstallIconName; size?: string }>) {
  return (
    <Svg viewBox="0 0 24 24" $size={size} aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </Svg>
  );
});
