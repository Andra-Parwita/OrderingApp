import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../shared/appName';
import type { Kitchen } from '../../shared/domain';
import { bannerAlt } from '../../shared/kitchenImages';
import { fetchMenu } from '../api/client';
import { lastKitchen } from '../api/device/lastKitchen';
import { cssUrl } from '../components/cssUrl';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useMediaQuery } from '../components/useMediaQuery';
import { useTallPicture, type PictureShape } from '../ui';
import { BrandLogo } from './BrandLogo';
import { BrandColumn, BrandFootLine, type BrandPage } from './BrandPanel';
import { SPLIT_QUERY } from './layout';
import { SCREEN_HEIGHT, TOP_BARS } from '../theme/screen';

// D-051: sign-in and set-up pages show the phone banner of the last kitchen this device used,
// whole (never cropped) on that kitchen's colour or background picture. Without a last kitchen or
// a phone banner: a plain tinted panel with the app name, never a sample picture. The picture
// comes from the same public menu the customer app reads. Plan 001 stage 5: the banner sits left
// of the form on a tablet and on top of it on a phone; the EN / ID switch is top right, and the
// kitchen's logo and name sit above the form (the app name when there is no last kitchen).

// Plan 036: the admin pages and the seller's first set-up carry ShaggyBobo's branding instead,
// and so does seller sign-in when this device has no kitchen to show.

/**
 * The last kitchen this device used, from the public menu; `kitchen` is null if none, it cannot be
 * read, or off. `none` is true once we know there is no kitchen to show (nothing remembered, or the
 * remembered one failed to load).
 */
function useLastKitchen(enabled: boolean): { kitchen: Kitchen | null; none: boolean } {
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [failed, setFailed] = useState(false);
  const remembered = enabled && lastKitchen() !== null;
  useEffect(() => {
    if (!enabled) return;
    const slug = lastKitchen();
    if (slug === null) return;
    let live = true;
    void fetchMenu(slug).then((result) => {
      if (!live) return;
      if (result.ok) setKitchen(result.data.kitchen);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return { kitchen, none: enabled && (!remembered || failed) };
}

const Split = styled.div<{ $split: boolean }>`
  display: ${({ $split }) => ($split ? 'grid' : 'flex')};
  grid-template-columns: 46fr 54fr;
  flex-direction: column;
  min-height: ${SCREEN_HEIGHT};
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
const Panel = styled.div<{
  $split: boolean;
  $background?: string | undefined;
  $image?: string | undefined;
  $tall: boolean;
}>`
  box-sizing: border-box;
  ${({ $tall }) => ($tall ? 'container-type: size;' : '')}
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  ${({ $split }) => ($split ? `position: sticky; top: ${TOP_BARS}; height: ${SCREEN_HEIGHT};` : 'height: 24dvh;')}
  padding-top: env(safe-area-inset-top);
  background-color: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${({ $image }) =>
    $image
      ? `background-image: ${cssUrl($image)}; background-size: cover; background-position: center;`
      : ''}
`;
// A tall (2:1, plan 123) banner shows only its bottom 3:1, as large as fits the panel (like `contain` does for a
// 3:1 one): the frame is a 3:1 box of at most the panel's width and height (container units), the picture
// cover-fitted to it from the bottom. The picture stays invisible until its shape is known.
const PictureFrame = styled.div<{ $tall: boolean }>`
  position: relative;
  ${({ $tall }) =>
    $tall
      ? 'width: min(100cqw, 300cqh); aspect-ratio: 3 / 1; overflow: hidden;'
      : 'width: 100%; height: 100%;'}
`;
const Picture = styled.img<{ $shape: PictureShape }>`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: ${({ $shape }) => ($shape === 'tall' ? 'cover' : 'contain')};
  ${({ $shape }) => ($shape === 'tall' ? 'object-position: center bottom;' : '')}
  ${({ $shape }) => ($shape === 'unknown' ? 'opacity: 0;' : '')}
`;
const Name = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.type.size.xxl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  text-align: center;
  color: ${({ theme }) => theme.c.text};
`;
const BrandSide = styled.div`
  position: sticky;
  top: ${TOP_BARS};
  height: ${SCREEN_HEIGHT};
`;
const FormSide = styled.div<{ $split: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${({ $split }) => ($split ? `min-height: ${SCREEN_HEIGHT};` : '')}
`;
const TopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.size.pagePadTablet / 16}rem;
`;
// The screens inside keep their own widths; here they only sit in the middle of the free space.
const FormArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xl};
  padding-bottom: ${({ theme }) => theme.spacing.xxl};

  & > main {
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
  }
`;
// The admin pages' content is 32rem wide with 24px padding, so their logo lines up with the heading.
const Head = styled.div<{ $admin?: boolean }>`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  max-width: ${({ $admin }) => ($admin ? '32rem' : '28rem')};
  margin: 0 auto;
  padding: 0
    ${({ theme, $admin }) => ($admin ? theme.spacing.xl : `${theme.size.pagePadTablet / 16}rem`)};
`;
const Logo = styled.img`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${({ theme }) => theme.size.radiusControl / 16}rem;
  object-fit: cover;
`;
const Initial = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${({ theme }) => theme.size.radiusControl / 16}rem;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
  font-weight: 700;
`;
const KitchenTitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

/** The frame of the seller and admin sign-in and set-up pages. */
export function SignInFrame({
  children,
  kitchenName,
  brand,
}: Readonly<{
  children: ReactNode;
  /** The kitchen's name from this device's memory, shown until the public menu has loaded. */
  kitchenName?: string | undefined;
  /** Admin pages and the seller's first set-up: ShaggyBobo branding, no kitchen (plan 036). */
  brand?: BrandPage | undefined;
}>) {
  const { i18n } = useTranslation();
  const split = useMediaQuery(SPLIT_QUERY);
  const last = useLastKitchen(brand === undefined);
  const kitchen = last.kitchen;
  // No kitchen known on this device: the developer's branding, like the first set-up.
  const shown: BrandPage | undefined =
    brand ?? (last.none && !kitchenName ? 'sellerSignIn' : undefined);
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const picture = kitchen?.images?.phoneBanner;
  const background = picture ? kitchen?.images?.bannerBackground : undefined;
  const backgroundImage = picture ? kitchen?.images?.bannerBackgroundImage : undefined;
  const name = kitchen?.name ?? kitchenName ?? '';
  const logo = kitchen?.images?.railIcon;
  const { ref: pictureRef, shape: pictureShape, read: readShape } = useTallPicture();
  const tall = pictureShape === 'tall';
  return (
    <Split $split={split}>
      {shown ? (
        split ? (
          <BrandSide>
            <BrandColumn page={shown} />
          </BrandSide>
        ) : null
      ) : (
        <Panel $split={split} $background={background} $image={backgroundImage} $tall={tall}>
          {picture && kitchen ? (
            <PictureFrame $tall={tall}>
              <Picture
                key={picture}
                ref={pictureRef}
                src={picture}
                alt={bannerAlt(kitchen, lang)}
                $shape={pictureShape}
                onLoad={readShape}
              />
            </PictureFrame>
          ) : (
            <Name>{APP_NAME}</Name>
          )}
        </Panel>
      )}
      <FormSide $split={split}>
        <TopBar>
          <LanguageSwitch compact />
        </TopBar>
        <FormArea>
          {shown ? (
            <Head $admin={shown === 'admin'}>
              <BrandLogo />
            </Head>
          ) : kitchen || kitchenName ? (
            <Head>
              {logo ? <Logo src={logo} alt="" /> : <Initial>{name.slice(0, 1)}</Initial>}
              <KitchenTitle>{name}</KitchenTitle>
            </Head>
          ) : null}
          {children}
        </FormArea>
      </FormSide>
      {shown && !split ? <BrandFootLine /> : null}
    </Split>
  );
}
