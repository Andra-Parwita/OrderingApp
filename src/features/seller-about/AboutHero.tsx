import { useEffect, useRef, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { useMediaQuery } from '../../components/useMediaQuery';
import { heroArt, LOTTIE_SRC, WIDE_ASPECT } from './aboutTokens';

// Plan 075: the hero of the About page. The Nusantara market scene, faded and drifting slowly, with
// the owner's calm Lottie on top (phone file or tablet file, by the hero's shape). The lottie-web
// light player is loaded only when this mounts. If the player or the file fails, or for anyone who
// asks for less motion, the CSS mascot (earlier approved fallback) stands in; reduced motion shows
// a still frame and no drift.

const SCENE = '/brand/nusantara-market.webp';
const BRAND = '/brand';

const drift = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1.08); }
  50% { transform: translate(-47%, -50.5%) scale(1.08); }
`;
const blink = keyframes`
  0%, 93%, 100% { opacity: 0; }
  94%, 99% { opacity: 1; }
`;
const wave = keyframes`
  0% { transform: rotate(0); }
  4%, 16%, 28% { transform: rotate(-14deg); }
  10%, 22% { transform: rotate(10deg); }
  36%, 100% { transform: rotate(0); }
`;
const stepLeft = keyframes`
  0%, 100% { transform: rotate(-5deg) translateY(0); }
  50% { transform: rotate(5deg) translateY(-0.125rem); }
`;
const stepRight = keyframes`
  0%, 100% { transform: rotate(5deg) translateY(-0.125rem); }
  50% { transform: rotate(-5deg) translateY(0); }
`;
const bob = keyframes`
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -0.1875rem; }
`;

const Box = styled.div<{ $wide: boolean }>`
  position: relative;
  height: ${({ $wide }) => ($wide ? heroArt.heightTablet : heroArt.heightPhone)};
  border-radius: ${({ $wide }) => ($wide ? '0.875rem' : '0')};
  background: ${heroArt.beige};
  overflow: hidden;
  ${({ theme }) => (theme.mode === 'dark' ? `filter: ${heroArt.darkFilter};` : '')}

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: ${({ theme }) => heroArt.wash[theme.mode]};
  }
`;
const Stage = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100%, 26.25rem);
  aspect-ratio: 3 / 5;
  transform: translate(-50%, -50%) scale(1.08);

  img {
    display: block;
    width: 100%;
    height: 100%;
    opacity: ${heroArt.sceneOpacity};
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${drift} 18s ease-in-out infinite;
  }
`;
const Player = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;

  svg {
    display: block;
  }
`;
const Mascot = styled.div<{ $wide: boolean }>`
  position: absolute;
  left: 50%;
  bottom: -0.875rem;
  z-index: 2;
  width: ${({ $wide }) => ($wide ? '11.875rem' : '9.375rem')};
  margin-left: ${({ $wide }) => ($wide ? '-5.9375rem' : '-4.6875rem')};
  aspect-ratio: 900 / 635;
  pointer-events: none;

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .lids {
    opacity: 0;
  }
  .arm {
    transform-origin: 7.9% 18.2%;
  }
  .legl,
  .legr {
    transform-origin: 50% 55%;
  }
  /* The legs sit a little right on the canvas (owner, 15 Oct): left 10 px, right 5 px of 150. */
  .legl {
    left: 6.7%;
    right: -6.7%;
  }
  .legr {
    left: 3.3%;
    right: -3.3%;
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${bob} 0.9s ease-in-out infinite;
    .lids {
      animation: ${blink} 2s steps(1, end) infinite;
    }
    .arm {
      animation: ${wave} 5s ease-in-out infinite;
    }
    .legl {
      animation: ${stepLeft} 0.9s ease-in-out infinite;
    }
    .legr {
      animation: ${stepRight} 0.9s ease-in-out infinite;
    }
  }
`;

type Kind = 'phone' | 'tablet';

export function AboutHero({ wideQuery }: Readonly<{ wideQuery: string }>) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const tabletScreen = useMediaQuery(wideQuery);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLDivElement>(null);
  // Which file: by the hero's own shape once measured (a wide hero takes the tablet file).
  const [aspect, setAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const kind: Kind = (aspect ?? (tabletScreen ? 6 : 3)) > WIDE_ASPECT ? 'tablet' : 'phone';
  const wide = kind === 'tablet';

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => {
      if (el.clientHeight > 0) setAspect(el.clientWidth / el.clientHeight);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const host = player.current;
    if (!host) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    import('lottie-web/build/player/lottie_light')
      .then((module) => {
        if (cancelled) return;
        const animation = module.default.loadAnimation({
          container: host,
          renderer: 'svg',
          loop: true,
          autoplay: !reduced,
          path: LOTTIE_SRC[kind],
          rendererSettings: { preserveAspectRatio: 'xMidYMid slice' },
        });
        destroy = () => animation.destroy();
        animation.addEventListener('data_failed', () => setFailed(true));
        if (reduced) animation.addEventListener('DOMLoaded', () => animation.goToAndStop(0, true));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [kind, reduced]);

  return (
    <Box ref={box} $wide={wide} aria-hidden="true">
      <Stage aria-hidden="true">
        <img src={SCENE} alt="" />
      </Stage>
      <Player ref={player} aria-hidden="true" data-testid="about-lottie" />
      {failed ? (
        <Mascot $wide={wide} aria-hidden="true" data-testid="about-mascot">
          <img className="legr" src={`${BRAND}/mascot-leg-right.webp`} alt="" />
          <img className="legl" src={`${BRAND}/mascot-leg-left.webp`} alt="" />
          <img src={`${BRAND}/mascot-body.webp`} alt="" />
          <img className="lids" src={`${BRAND}/mascot-eyes-closed.webp`} alt="" />
          <img className="arm" src={`${BRAND}/mascot-arm-spoon.webp`} alt="" />
        </Mascot>
      ) : null}
    </Box>
  );
}
