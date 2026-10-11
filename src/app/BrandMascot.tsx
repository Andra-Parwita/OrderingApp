import { keyframes, styled } from 'styled-components';
import { brandColour, brandShadow, brandSize } from '../theme/brandTokens';
import { LEAF_COLOUR } from './BrandLogo';

// Plan 028 stage 5: the walking mascot (the owner's WalkingMascot.png, 900 x 635) in layers, so
// parts can move with CSS alone: the body (`-body.webp`), the spoon arm cut out of it
// (`-spoon.webp`, the same canvas, so at rest the two line up exactly), the leaves (`-leaves.webp`,
// shading only; the colour is CSS), and two eyelids drawn over the eyes. The whole figure bounces; the arm swings from the shoulder; the eyes blink. Every motion
// stops for reduced motion. Positions below are in the 900 x 635 picture.

const BODY_SRC = '/brand/shaggybobo-walking-body.webp';
const ARM_SRC = '/brand/shaggybobo-walking-spoon.webp';
/** The two leaves on the head as greyscale shading: the colour itself comes from CSS. */
const LEAVES_SRC = '/brand/shaggybobo-walking-leaves.webp';
const SKIN = brandColour.skin;
const OUTLINE = brandColour.eyeOutline;

// A bounce straight up and down (owner: "for now bouncing up and down instead").
const bounce = keyframes`
  0%, 100% { transform: translateX(-50%); }
  50% { transform: translate(-50%, ${brandSize.bounce}); }
`;
// The spoon arm waves from the shoulder, twice per three bounces.
const wave = keyframes`
  0%, 100% { transform: rotate(0deg); }
  30% { transform: rotate(-9deg); }
  60% { transform: rotate(4deg); }
`;
const blink = keyframes`
  0%, 90%, 100% { transform: scaleY(0); }
  94% { transform: scaleY(1); }
`;

// Feet 50 px above the footer, right of centre, whatever the scene's crop (owner: "like 50px from
// footer top", "so it does not matter how the background would be"). The bounce only lifts it.
const Figure = styled.div`
  position: absolute;
  left: 60%;
  bottom: ${brandSize.mascotBottom};
  width: min(62%, ${brandSize.mascotMaxWidth});
  aspect-ratio: 900 / 635;
  transform: translateX(-50%);
  filter: ${brandShadow.mascot};
  pointer-events: none;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${bounce} 1.2s ease-in-out infinite;
  }
`;
const Layer = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;
// The leaves: a block of `--mascot-leaf` cut to the leaves' shape, with their shading multiplied on
// top, so the colour can be tried live in DevTools (set --mascot-leaf on :root).
const LeafColour = styled.div`
  position: absolute;
  inset: 0;
  background: ${LEAF_COLOUR};
  mask: url(${LEAVES_SRC}) center / 100% 100% no-repeat;
`;
const LeafShade = styled(Layer)`
  mix-blend-mode: multiply;
`;
// The shoulder, where the arm meets the body: (201, 380).
const Arm = styled(Layer)`
  transform-origin: 22.3% 59.8%;
  @media (prefers-reduced-motion: no-preference) {
    animation: ${wave} 1.8s ease-in-out infinite;
  }
`;
const Lids = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;

  & g {
    transform: scaleY(0);
    transform-box: fill-box;
    transform-origin: 50% 0%;
  }
  @media (prefers-reduced-motion: no-preference) {
    & g {
      animation: ${blink} 4.5s ease-in-out infinite;
    }
  }
`;

/** One eyelid: skin over the whole eye (outline included), with a closed eye's curved line. */
function Lid({ cx, cy, rx, ry }: Readonly<{ cx: number; cy: number; rx: number; ry: number }>) {
  const r = rx * 0.75;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx + 11} ry={ry + 10} fill={SKIN} />
      <path
        d={`M ${cx - r} ${cy} Q ${cx} ${cy + ry * 0.55} ${cx + r} ${cy}`}
        fill="none"
        stroke={OUTLINE}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </g>
  );
}

/** The walking mascot, standing on the footer line of the brand column (decorative). */
export function WalkingMascot() {
  return (
    <Figure aria-hidden="true">
      <Layer src={BODY_SRC} alt="" />
      <LeafColour />
      <LeafShade src={LEAVES_SRC} alt="" />
      <Arm src={ARM_SRC} alt="" />
      <Lids viewBox="0 0 900 635">
        <Lid cx={390} cy={276} rx={56} ry={55} />
        <Lid cx={531} cy={241} rx={52} ry={50} />
      </Lids>
    </Figure>
  );
}
