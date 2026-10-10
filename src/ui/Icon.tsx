import { memo } from 'react';
import { styled } from 'styled-components';

// Small outline icons. They are decoration only: a text label always sits beside them.
const PATHS = {
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  pencil: 'M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z',
  note: 'M5 4h14v12l-5 5H5zM14 21v-5h5',
  check: 'M5 12l5 5L20 6',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 018 0v3',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5C9.5 8 14.5 8 14.5 10s-5 2-5 4 5 2 5 .5',
  chat: 'M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z',
  bell: 'M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pot: 'M4 11h16v5a4 4 0 01-4 4H8a4 4 0 01-4-4zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4',
  box: 'M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 016 0',
  truck: 'M2 6h12v10H2zM14 10h5l3 3v3h-8M6 19.5h.01M18 19.5h.01',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5a4 4 0 008 0h5',
  tablet: 'M6 2h12a1 1 0 011 1v18a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1zM12 18h.01',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  history: 'M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4M12 8v5l3 2',
} as const;

export type IconName = keyof typeof PATHS;

const Svg = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

export const Icon = memo(function Icon({ name }: Readonly<{ name: IconName }>) {
  return (
    <Svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </Svg>
  );
});
