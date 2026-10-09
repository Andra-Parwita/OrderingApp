import { memo } from 'react';
import { styled } from 'styled-components';

// Outline icons for the order page (spec §4.4). Decoration only: a word always sits beside each
// one (status is never icon alone).
const PATHS = {
  check: 'M5 12l5 5L20 6',
  checkCircle: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  truck: 'M2 6h12v10H2zM14 10h5l3 3v3h-8M6 19.5h.01M18 19.5h.01',
  ban: 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8',
  bell: 'M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4',
  bellOff: 'M6 17V11a6 6 0 019-5.2M18 11v6l2 2H4M10 21h4M3 3l18 18',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 018 0v3',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  chat: 'M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z',
} as const;

export type OrderIconName = keyof typeof PATHS;

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

export const OrderIcon = memo(function OrderIcon({
  name,
  size = '1.25rem',
}: Readonly<{ name: OrderIconName; size?: string }>) {
  return (
    <Svg viewBox="0 0 24 24" $size={size} aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </Svg>
  );
});
