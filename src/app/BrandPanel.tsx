import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { RELEASE_VERSION } from '../../shared/release';
import { brandColour, brandSize } from '../theme/brandTokens';
import { BrandLogo } from './BrandLogo';
import { WalkingMascot } from './BrandMascot';

// Plan 036: the developer (ShaggyBobo) branding on the admin pages and the seller's first set-up
// from an invitation. Its colours and sizes are the brand's own (src/theme/brandTokens.ts).

export type BrandPage = 'admin' | 'sellerSetup' | 'sellerSignIn';

/** The Nusantara market scene behind the mascot (1200 x 2000, shown with cover). */
const SCENE_SRC = '/brand/nusantara-market.webp';
const BEIGE = brandColour.beige;
const INK = brandColour.ink;
const LEAF = brandColour.dot;
// The header and footer always have the same height (owner: "always have fixed height of footer
// and header and the middle image can just fill"); only the middle grows or shrinks.
const BAR_HEIGHT = brandSize.bar;
const PHONE_BAR_HEIGHT = brandSize.phoneBar;

const Column = styled.div`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${BEIGE};
  color: ${INK};
`;
const Bar = styled.div`
  box-sizing: border-box;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  height: ${BAR_HEIGHT};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet / 16}rem;
`;
// Tablet and desktop: the header floats over the scene, which runs to the top of the column.
const OverlayBar = styled(Bar)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;
const PhoneBar = styled(Bar)`
  height: calc(${PHONE_BAR_HEIGHT} + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) ${({ theme }) => theme.spacing.lg} 0;
  background: ${BEIGE};
  color: ${INK};
`;
const Pill = styled.span`
  padding: 0.3em 0.9em;
  border: ${brandSize.hairline} solid ${INK};
  border-radius: ${({ theme }) => theme.radius.pill};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
`;
// The scene fills the middle edge to edge like `cover`: the Stage keeps the picture's 3:5 shape and
// is always at least as wide and as tall as the middle (container units), centred, so the edges are
// cropped. Scaled 1.04 to hide the scene's soft, rounded edges. The mascot is its own layer on
// top, placed from the footer rather than on the picture.
const Body = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  container-type: size;
`;
const Stage = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100cqw, 60cqh);
  aspect-ratio: 3 / 5;
  transform: translate(-50%, -50%) scale(1.04);
`;
const Scene = styled.img`
  display: block;
  width: 100%;
  height: 100%;
`;
// On a narrow column the two parts wrap onto a second line inside the same fixed height.
const Foot = styled.div`
  box-sizing: border-box;
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: center;
  justify-content: space-between;
  gap: ${brandSize.footerRowGap} ${({ theme }) => theme.spacing.sm};
  height: ${BAR_HEIGHT};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet / 16}rem;
  overflow: hidden;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.75rem;
`;
const FootBar = styled(Foot)`
  justify-content: center;
  height: calc(${PHONE_BAR_HEIGHT} + env(safe-area-inset-bottom));
  padding: 0 ${({ theme }) => theme.spacing.lg} env(safe-area-inset-bottom);
  background: ${BEIGE};
  color: ${INK};
`;
const Build = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Version = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.2em 0.7em;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${INK};
  color: ${BEIGE};
  font-weight: 600;
  &::before {
    content: '';
    width: 0.45em;
    height: 0.45em;
    border-radius: 50%;
    background: ${LEAF};
  }
`;

function BrandHeaderParts({ page }: Readonly<{ page: BrandPage }>) {
  const { t } = useTranslation();
  return (
    <>
      <BrandLogo onBeige />
      {page === 'sellerSetup' ? <Pill>{t('app.brand.sellerSetup')}</Pill> : null}
      {page === 'sellerSignIn' ? <Pill>{t('app.brand.sellerSignIn')}</Pill> : null}
    </>
  );
}

function BrandFooterParts() {
  const { t } = useTranslation();
  const env = t(import.meta.env.PROD ? 'app.brand.production' : 'app.brand.development');
  return (
    <>
      <Build>
        <Version>v{RELEASE_VERSION}</Version>
        <span>{env}</span>
      </Build>
      <span>{t('app.brand.copyright', { year: new Date().getFullYear() })}</span>
    </>
  );
}

/** Tablet and desktop: the whole left column (header, mascot, footer). */
export function BrandColumn({ page }: Readonly<{ page: BrandPage }>) {
  return (
    <Column>
      <OverlayBar data-testid="brand-header">
        <BrandHeaderParts page={page} />
      </OverlayBar>
      <Body>
        <Stage>
          <Scene src={SCENE_SRC} alt="" />
        </Stage>
        <WalkingMascot />
      </Body>
      <Foot>
        <BrandFooterParts />
      </Foot>
    </Column>
  );
}

/** Phone: the header as a bar on top (no mascot). */
export function BrandTopBar({
  page,
  children,
}: Readonly<{ page: BrandPage; children?: ReactNode }>) {
  return (
    <PhoneBar as="header">
      <BrandHeaderParts page={page} />
      {children}
    </PhoneBar>
  );
}

/** Phone: the footer as a bar at the bottom of the page. */
export function BrandBottomBar() {
  return (
    <FootBar as="footer">
      <BrandFooterParts />
    </FootBar>
  );
}

const FootLine = styled.footer`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${brandSize.footerRowGap} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg}
    calc(${({ theme }) => theme.spacing.md} + env(safe-area-inset-bottom));
  color: ${({ theme }) => theme.colour.textMuted};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.6875rem;
`;

/** Phone sign-in pages: the version and copyright as one small muted line at the bottom. */
export function BrandFootLine() {
  return (
    <FootLine>
      <BrandFooterParts />
    </FootLine>
  );
}
