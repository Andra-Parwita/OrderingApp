import { keyframes, styled } from 'styled-components';
import { brandColour, brandPill, brandSize } from '../theme/brandTokens';

// The ShaggyBobo logo (plan 044): the happy-face icon and the wordmark in a pill, light and dark
// (public/brand/logo-icon.webp, values from the mascot pack's IMPLEMENTATION.md). The icon tilts
// gently and the letters hop; both stop for anyone who asks for reduced motion.

const ICON_SRC = '/brand/logo-icon.webp';

const tilt = keyframes`
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg); }
  75% { transform: rotate(6deg); }
`;
const hop = keyframes`
  0%, 70%, 100% { transform: translateY(0); }
  78% { transform: translateY(${brandSize.hop}); }
  86% { transform: translateY(0); }
`;

const Mark = styled.span<{ $light: boolean }>`
  --brand-bg: ${({ theme, $light }) => brandPill[$light ? 'light' : theme.mode].bg};
  --brand-border: ${({ theme, $light }) => brandPill[$light ? 'light' : theme.mode].border};
  --brand-word: ${({ theme, $light }) => brandPill[$light ? 'light' : theme.mode].word};
  --brand-shadow: ${({ theme, $light }) => brandPill[$light ? 'light' : theme.mode].shadow};
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: ${brandSize.logoGap};
  padding: ${brandSize.logoBoxPadding};
  border: ${brandSize.hairline} solid var(--brand-border);
  border-radius: ${brandSize.pillRadius};
  background: var(--brand-bg);
  box-shadow: var(--brand-shadow);
  color: var(--brand-word);
  font-family: Arial, sans-serif;
  font-size: ${brandSize.logoFontSize};
  font-weight: 900;
  letter-spacing: ${brandSize.logoLetterSpacing};
  line-height: 1;
  white-space: nowrap;
`;
const Icon = styled.img`
  width: ${brandSize.logoHeight};
  height: ${brandSize.logoHeight};
  flex: none;
  transform-origin: 50% 85%;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${tilt} 4s ease-in-out infinite;
  }
`;
const Letter = styled.span<{ $i: number }>`
  display: inline-block;
  @media (prefers-reduced-motion: no-preference) {
    animation: ${hop} 6s ease-in-out infinite;
    animation-delay: ${({ $i }) => $i * 0.06}s;
  }
`;
const Bobo = styled.span`
  color: ${brandColour.bobo};
`;

function Letters({ word, from }: Readonly<{ word: string; from: number }>) {
  return word.split('').map((letter, i) => (
    <Letter key={i} $i={from + i}>
      {letter}
    </Letter>
  ));
}

/** The ShaggyBobo pill: icon and wordmark; "Shaggy" takes `--brand-word`. */
/** `onBeige`: the beige brand bar is beige in both themes, so its pill always uses the light values. */
export function BrandLogo({ onBeige = false }: Readonly<{ onBeige?: boolean }>) {
  return (
    <Mark $light={onBeige} role="img" aria-label="ShaggyBobo">
      <Icon src={ICON_SRC} alt="" aria-hidden="true" />
      <span aria-hidden="true">
        <Letters word="Shaggy" from={0} />
        <Bobo>
          <Letters word="Bobo" from={6} />
        </Bobo>
      </span>
    </Mark>
  );
}
