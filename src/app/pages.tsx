import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { styled } from 'styled-components';
import { isValidSlug } from '../../shared/seller';
import { LAST_KITCHEN_KEY, lastKitchen } from '../api/device/lastKitchen';
import { readMyOrders } from '../api/device/myOrders';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { heroArt } from '../features/seller-about/aboutTokens';
import { readEnvironment } from '../components/install/detect';
import { useMediaQuery } from '../components/useMediaQuery';
import { BrandLogo } from './BrandLogo';
import { DESKTOP_QUERY } from './layout';
import { SCREEN_HEIGHT, screenHeightMinus } from '../theme/screen';

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  min-height: ${SCREEN_HEIGHT};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Bar = styled.div`
  display: flex;
  justify-content: flex-end;
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Text = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Home = styled(Link)`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <Bar>
        <LanguageSwitch />
      </Bar>
      <Title>{t('notFound.title')}</Title>
      <Text>{t('notFound.body')}</Text>
      <Home to="/">{t('notFound.home')}</Home>
    </Page>
  );
}

// The customer pages below sit inside the tab bar shell, so they leave room for it.
const ShellPage = styled(Page)`
  min-height: ${screenHeightMinus('var(--customer-tabbar-height, 0rem)')};
`;

/** Set to true to send a phone that knows a kitchen straight to it. Off: "/" is the same for everyone. */
export const REDIRECT_RETURNING_CUSTOMERS = false;
/** Set to true to show "Run something on ShaggyBobo? Sign in" under the welcome. Off while private. */
export const SHOW_SELLER_LINK = false;

// The About hero (scene, drone Lottie, mascot fallback) is loaded only when "/" shows.
const AboutHero = lazy(() =>
  import('../features/seller-about/AboutHero').then((m) => ({ default: m.AboutHero })),
);
// Set when a kitchen was not found, so "/" does not send the phone straight back to it.
const SKIP_REDIRECT_KEY = 'skipHomeRedirect';

const Welcome = styled.main`
  min-height: ${screenHeightMinus('var(--customer-tabbar-height, 0rem)')};
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.lg};
`;
const WelcomeBody = styled.div<{ $wide: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  max-width: ${({ $wide }) => ($wide ? '42rem' : '32rem')};
  margin: 0 auto;
  text-align: center;
`;
// The hero's box is reserved before it loads (same shape as the hero), so nothing moves when it arrives.
const HeroBox = styled.div<{ $wide: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: ${({ $wide }) => ($wide ? heroArt.aspectTablet : heroArt.aspectPhone)};
`;
const HeroStill = styled.div`
  position: absolute;
  inset: 10% 3%; /* the hero's card */
  border-radius: 0.875rem;
  background: ${heroArt.beige};
  ${({ theme }) => (theme.mode === 'dark' ? `filter: ${heroArt.darkFilter};` : '')}
`;
const Foot = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.minTapTarget};
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const FootLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const WelcomeTitle = styled(Title)`
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

/** The kitchen this phone knows: the last one visited, else the newest saved order's. Storage only. */
function knownKitchen(): string | null {
  try {
    if (sessionStorage.getItem(SKIP_REDIRECT_KEY)) return null;
  } catch {
    // no session storage: carry on
  }
  const last = lastKitchen();
  if (last) return last;
  const newest = readMyOrders()
    .filter((order) => isValidSlug(order.sellerSlug))
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))[0];
  return newest?.sellerSlug ?? null;
}

/**
 * `/`: the logo and a welcome. Inside an installed home-screen app (no address bar) it always jumps to the known kitchen.
 *  A phone that knows a kitchen goes straight to it (history replaced,
 * so Back does not loop); nothing is fetched.
 */
export function HomePage({
  redirect = REDIRECT_RETURNING_CUSTOMERS || readEnvironment().installed,
}: Readonly<{ redirect?: boolean }>) {
  const { t } = useTranslation();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const slug = redirect ? knownKitchen() : null;
  if (slug) return <Navigate to={`/${slug}`} replace />;
  return (
    <Welcome>
      <WelcomeBody $wide={wide}>
        <HeroBox $wide={wide} data-testid="home-hero-box">
          <Suspense fallback={<HeroStill data-testid="home-hero-placeholder" />}>
            <AboutHero wideQuery={DESKTOP_QUERY} />
          </Suspense>
        </HeroBox>
        <BrandLogo />
        <WelcomeTitle>{t('home.welcome')}</WelcomeTitle>
        <Text>{t('home.hint')}</Text>
      </WelcomeBody>
      {SHOW_SELLER_LINK ? (
        <Foot>
          {t('home.sellerPrompt')}
          <FootLink to="/seller/sign-in">{t('home.signIn')}</FootLink>
        </Foot>
      ) : null}
    </Welcome>
  );
}

/** `/<slug>` with a mistyped, old or reserved slug. */
export function KitchenNotFoundPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  // Forget this kitchen so "/" does not bounce back to it.
  useEffect(() => {
    try {
      if (localStorage.getItem(LAST_KITCHEN_KEY) === slug)
        localStorage.removeItem(LAST_KITCHEN_KEY);
      sessionStorage.setItem(SKIP_REDIRECT_KEY, '1');
    } catch {
      // storage unavailable: nothing was remembered
    }
  }, [slug]);
  return (
    <ShellPage>
      <Bar>
        <LanguageSwitch />
      </Bar>
      <Title>{t('kitchenNotFound.title')}</Title>
      <Text>{t('kitchenNotFound.body')}</Text>
      <Home to="/">{t('kitchenNotFound.home')}</Home>
    </ShellPage>
  );
}
