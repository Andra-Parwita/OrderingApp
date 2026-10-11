import { keyframes, styled } from 'styled-components';
import { brandColour, brandSize } from '../theme/brandTokens';

// Plan 028 stage 4: the ShaggyBobo logo drawn inline (the owner's shaggybobo-header.svg, 145 x 32),
// so "Shaggy" takes the text colour around it (dark brown on the beige panel, the theme's text in
// dark mode) and the head and the word can move. The motion is gentle and stops for anyone who asks
// for reduced motion.

/** The leaf colour, for the logo and the walking mascot alike: `--mascot-leaf`, declared on :root in
 *  GlobalStyle, so DevTools shows it there to edit live. */
export const LEAF_COLOUR = `var(--mascot-leaf, ${brandColour.leaf})`;
const LINE = brandColour.ink;

const tilt = keyframes`
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg); }
  75% { transform: rotate(6deg); }
`;
const sway = keyframes`
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(14deg); }
`;
const blink = keyframes`
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
`;
const hop = keyframes`
  0%, 70%, 100% { transform: translateY(0); }
  78% { transform: translateY(${brandSize.hop}); }
  86% { transform: translateY(0); }
`;

const Mark = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${brandSize.logoGap};
  height: ${brandSize.logoHeight};
  font-family: Arial, sans-serif;
  font-size: ${brandSize.logoFontSize};
  font-weight: 900;
  letter-spacing: ${brandSize.logoLetterSpacing};
  line-height: 1;
  white-space: nowrap;
`;
const Icon = styled.svg`
  width: ${brandSize.logoHeight};
  height: ${brandSize.logoHeight};
  flex: none;
  overflow: visible;

  @media (prefers-reduced-motion: no-preference) {
    .head {
      transform-box: fill-box;
      transform-origin: 50% 90%;
      animation: ${tilt} 4s ease-in-out infinite;
    }
    .leaf {
      transform-box: fill-box;
      transform-origin: 0% 100%;
      animation: ${sway} 2.4s ease-in-out infinite;
    }
    .eyes {
      transform-box: fill-box;
      transform-origin: center;
      animation: ${blink} 5s linear infinite;
    }
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

/** The ShaggyBobo icon and wordmark; "Shaggy" uses the surrounding text colour. */
export function BrandLogo() {
  return (
    <Mark role="img" aria-label="ShaggyBobo">
      <Icon viewBox="40 30 240 280" aria-hidden="true">
        <ellipse cx="160" cy="296" rx="96" ry="12" fill={LINE} opacity="0.14" />
        <g className="head">
          <path
            d="M160 70 C 228 66 262 128 256 190 C 250 258 210 292 158 290 C 100 288 62 252 64 186 C 66 120 98 74 160 70 Z"
            fill="#C98F52"
            stroke={LINE}
            strokeWidth="5"
          />
          <ellipse cx="214" cy="236" rx="7" ry="5" fill="#A8723C" />
          <ellipse cx="98" cy="226" rx="5" ry="4" fill="#A8723C" />
          <ellipse cx="232" cy="170" rx="4" ry="3" fill="#A8723C" />
          <ellipse cx="120" cy="262" rx="4" ry="3" fill="#A8723C" />
          <path
            d="M70 140 C 64 110 76 92 92 98 C 86 70 108 56 124 72 C 124 44 152 40 160 62 C 170 36 200 42 200 68 C 216 52 240 64 232 92 C 252 88 262 112 252 138 C 240 118 226 112 214 120 C 210 100 190 96 182 110 C 174 92 150 92 144 110 C 134 96 112 100 110 120 C 98 110 80 118 70 140 Z"
            fill="#3A2414"
            stroke={LINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M118 112 L112 134 M150 106 L148 130 M186 108 L190 130 M218 120 L226 140"
            stroke="#3A2414"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <g className="eyes">
            <circle cx="132" cy="174" r="20" fill="#FFFDF7" stroke={LINE} strokeWidth="4" />
            <circle cx="192" cy="174" r="20" fill="#FFFDF7" stroke={LINE} strokeWidth="4" />
            <circle cx="137" cy="178" r="8" fill={LINE} />
            <circle cx="197" cy="178" r="8" fill={LINE} />
            <circle cx="140" cy="175" r="2.5" fill="#FFFDF7" />
            <circle cx="200" cy="175" r="2.5" fill="#FFFDF7" />
          </g>
          <path
            d="M160 190 C 150 206 156 216 166 212"
            fill="none"
            stroke={LINE}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <ellipse cx="112" cy="214" rx="12" ry="7" fill="#E08A6A" opacity="0.6" />
          <ellipse cx="212" cy="214" rx="12" ry="7" fill="#E08A6A" opacity="0.6" />
          <path
            d="M134 232 Q162 258 190 232"
            fill={LINE}
            stroke={LINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M150 240 L150 246 L162 246 L162 241" fill="#FFFDF7" />
          <path
            className="leaf"
            d="M226 84 C 232 66 246 60 258 62 C 254 76 242 84 226 84 Z"
            style={{ fill: LEAF_COLOUR }}
            stroke={LINE}
            strokeWidth="3"
          />
        </g>
      </Icon>
      <span aria-hidden="true">
        <Letters word="Shaggy" from={0} />
        <Bobo>
          <Letters word="Bobo" from={6} />
        </Bobo>
      </span>
    </Mark>
  );
}
