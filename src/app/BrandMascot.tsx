import { keyframes, styled } from 'styled-components';
import { brandShadow, brandSize } from '../theme/brandTokens';

// Plan 044: the ShaggyBobo mascot in layers (public/brand/mascot-*.webp, one 900 x 635 canvas with
// the figure in the same place, so every layer is stacked full size). It jumps on the spot with a
// squash, the legs kick, the spoon arm lifts, the ground shadow shrinks and the eyes blink every
// 2 s. The values are the mascot lab's (temp pack IMPLEMENTATION.md); every motion stops for
// reduced motion.

const SRC = '/brand/mascot-';

const jump = keyframes`
  0%, 100% { transform: translateY(0) scale(1, 1); }
  12% { transform: translateY(0) scale(calc(1 + var(--squash)), calc(1 - var(--squash))); }
  22% { transform: translateY(calc(var(--jump) * -0.4)) scale(calc(1 - var(--squash) * 0.6), calc(1 + var(--squash) * 0.6)); }
  50% { transform: translateY(calc(var(--jump) * -1)) scale(1, 1); }
  80% { transform: translateY(0) scale(1, 1); }
  88% { transform: translateY(0) scale(calc(1 + var(--squash)), calc(1 - var(--squash))); }
`;
const tuckLeft = keyframes`
  0%, 15%, 85%, 100% { transform: rotate(0); }
  50% { transform: rotate(var(--leg-tuck)); }
`;
const tuckRight = keyframes`
  0%, 15%, 85%, 100% { transform: rotate(0); }
  50% { transform: rotate(calc(var(--leg-tuck) * -1)); }
`;
const arm = keyframes`
  0%, 15%, 85%, 100% { transform: rotate(0); }
  50% { transform: rotate(calc(var(--arm-swing) * -1)); }
`;
const shadow = keyframes`
  0%, 80%, 100% { scale: 1; opacity: 1; }
  50% { scale: 0.7; opacity: 0.5; }
`;
const blink = keyframes`
  0%, 93%, 100% { opacity: 0; }
  94%, 99% { opacity: 1; }
`;

// Feet 50 px above the footer, right of centre, whatever the scene's crop (owner: "like 50px from
// footer top"). The canvas leaves ~10 px below the feet; the jump only lifts the figure.
const Figure = styled.div`
  --step: 1.3s;
  --jump: 12%;
  --squash: 0.05;
  --leg-tuck: 1deg;
  --arm-swing: 7deg;
  --blink: 2s;
  --shoulder: 7.9% 18.2%;
  --hip-left: 47.6% 26.4%;
  --hip-right: 39.4% 43.7%;
  position: absolute;
  left: 60%;
  bottom: ${brandSize.mascotBottom};
  width: min(62%, ${brandSize.mascotMaxWidth});
  aspect-ratio: 900 / 635;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;

  & img,
  & > div,
  & .upper {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  & .jumper {
    transform-origin: 50% 99%;
  }
  & .leg-l,
  & .leg-r {
    translate: var(--legs-x, ${brandSize.legsX}) 0;
  }
  & .lids {
    opacity: 0;
  }
  & .shadow {
    position: absolute;
    left: calc(50% + var(--legs-x, ${brandSize.legsX}));
    bottom: -4%;
    width: 46%;
    height: 8%;
    translate: -50% 0;
    border-radius: 50%;
    background: ${brandShadow.ground};
    filter: blur(${brandSize.mascotShadowBlur});
  }

  @media (prefers-reduced-motion: no-preference) {
    & .jumper {
      animation: ${jump} var(--step) cubic-bezier(0.45, 0, 0.55, 1) infinite;
    }
    & .leg-l {
      transform-origin: var(--hip-left);
      animation: ${tuckLeft} var(--step) ease-in-out infinite;
    }
    & .leg-r {
      transform-origin: var(--hip-right);
      animation: ${tuckRight} var(--step) ease-in-out infinite;
    }
    & .arm {
      transform-origin: var(--shoulder);
      animation: ${arm} var(--step) ease-in-out infinite;
    }
    & .lids {
      animation: ${blink} var(--blink) steps(1, end) infinite;
    }
    & .shadow {
      animation: ${shadow} var(--step) cubic-bezier(0.45, 0, 0.55, 1) infinite;
    }
  }
`;

/** The mascot, standing on the footer line of the brand column (decorative). */
export function WalkingMascot() {
  return (
    <Figure className="mascot" data-mascot aria-hidden="true" data-testid="mascot">
      <span className="shadow" />
      <div className="jumper">
        <img className="leg-r" src={`${SRC}leg-right.webp`} alt="" />
        <img className="leg-l" src={`${SRC}leg-left.webp`} alt="" />
        <div className="upper">
          <img className="body" src={`${SRC}body.webp`} alt="" />
          <img className="lids" src={`${SRC}eyes-closed.webp`} alt="" />
          <img className="arm" src={`${SRC}arm-spoon.webp`} alt="" />
        </div>
      </div>
    </Figure>
  );
}
