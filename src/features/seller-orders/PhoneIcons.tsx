import { styled } from 'styled-components';

// Two glyphs the shared icon set does not have (search, a down chevron). Local to the phone views.

const Svg = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

export function SearchIcon() {
  return (
    <Svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" />
    </Svg>
  );
}

export function ChevronDownIcon() {
  return (
    <Svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
