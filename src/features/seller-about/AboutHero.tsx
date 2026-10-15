import { useEffect, useRef, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { useMediaQuery } from '../../components/useMediaQuery';
import { heroArt, LOTTIE_SRC } from './aboutTokens';

// Plan 075: the hero of the About page. The Nusantara market scene, faded and drifting slowly, with
// the pop-out drone Lottie, owner approved 16 Oct, on top (phone file or tablet file, by screen
// shape); the drone flies out of the picture over the logo row. The lottie-web light player is
// loaded only when this mounts and plays only while visible. If the player or the file fails, or for anyone who
// asks for less motion, the CSS mascot (earlier approved fallback) stands in; reduced motion shows
// a still frame and no drift.

const SCENE = '/brand/nusantara-market.webp';
const BRAND = '/brand';

const drift = keyframes`
  0%, 100% { transform: translate(-3%, 0); }
  50% { transform: translate(3%, -1.5%); }
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

// The slot does not clip, so the drone can fly out over the logo row; the card clips the picture.
const Slot = styled.div<{ $wide: boolean }>`
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: ${({ $wide }) => ($wide ? heroArt.aspectTablet : heroArt.aspectPhone)};
  overflow: visible;
  isolation: isolate;
  pointer-events: none;
  contain: layout style;
  ${({ theme }) => (theme.mode === 'dark' ? `filter: ${heroArt.darkFilter};` : '')}
`;
const Card = styled.div`
  position: absolute;
  inset: 10% 3%; /* must match the Lottie */
  z-index: 0;
  overflow: hidden;
  border-radius: 0.875rem;
  background: ${heroArt.beige};
`;
const Scene = styled.div`
  position: absolute;
  inset: -4%;
  opacity: ${heroArt.sceneOpacity};
  will-change: transform;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${drift} 18s ease-in-out infinite;
  }
`;
const Fade = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => heroArt.fade[theme.mode]};
`;
const Player = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;

  svg {
    display: block;
    overflow: visible;
  }
  svg > g {
    clip-path: none;
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
  const slot = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const kind: Kind = tabletScreen ? 'tablet' : 'phone';
  const wide = kind === 'tablet';

  useEffect(() => {
    const host = player.current;
    if (!host) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    let watch: IntersectionObserver | undefined;
    import('lottie-web/build/player/lottie_light')
      .then((module) => {
        if (cancelled) return;
        const animation = module.default.loadAnimation({
          container: host,
          renderer: 'svg',
          loop: true,
          autoplay: !reduced,
          path: LOTTIE_SRC[kind],
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        destroy = () => animation.destroy();
        const el = slot.current;
        if (!reduced && el && typeof IntersectionObserver !== 'undefined') {
          watch = new IntersectionObserver(([entry]) =>
            entry?.isIntersecting ? animation.play() : animation.pause(),
          );
          watch.observe(el);
        }
        animation.addEventListener('data_failed', () => setFailed(true));
        if (reduced) animation.addEventListener('DOMLoaded', () => animation.goToAndStop(0, true));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      watch?.disconnect();
      destroy?.();
    };
  }, [kind, reduced]);

  return (
    <Slot ref={slot} $wide={wide} aria-hidden="true">
      <Card>
        <Scene>
          <img src={SCENE} alt="" />
        </Scene>
        <Fade />
        {failed ? (
          <Mascot $wide={wide} aria-hidden="true" data-testid="about-mascot">
            <img className="legr" src={`${BRAND}/mascot-leg-right.webp`} alt="" />
            <img className="legl" src={`${BRAND}/mascot-leg-left.webp`} alt="" />
            <img src={`${BRAND}/mascot-body.webp`} alt="" />
            <img className="lids" src={`${BRAND}/mascot-eyes-closed.webp`} alt="" />
            <img className="arm" src={`${BRAND}/mascot-arm-spoon.webp`} alt="" />
          </Mascot>
        ) : null}
      </Card>
      <Player ref={player} aria-hidden="true" data-testid="about-lottie" />
    </Slot>
  );
}
