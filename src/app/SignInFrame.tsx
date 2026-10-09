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
import { SPLIT_QUERY } from './layout';

// D-051: sign-in and set-up pages show the phone banner of the last kitchen this device used,
// whole (never cropped) on that kitchen's colour or background picture. Without a last kitchen or
// a phone banner: a plain tinted panel with the app name, never a sample picture. The picture
// comes from the same public menu the customer app reads. Plan 001 stage 5: the banner sits left
// of the form on a tablet and on top of it on a phone; the EN / ID switch is top right, and the
// kitchen's logo and name sit above the form (the app name when there is no last kitchen).

/** The last kitchen this device used, from the public menu; null if none or it cannot be read. */
function useLastKitchen(): Kitchen | null {
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  useEffect(() => {
    const slug = lastKitchen();
    if (slug === null) return;
    let live = true;
    void fetchMenu(slug).then((result) => {
      if (live && result.ok) setKitchen(result.data.kitchen);
    });
    return () => {
      live = false;
    };
  }, []);
  return kitchen;
}

const Split = styled.div<{ $split: boolean }>`
  display: ${({ $split }) => ($split ? 'grid' : 'flex')};
  grid-template-columns: 46fr 54fr;
  flex-direction: column;
  min-height: 100dvh;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
const Panel = styled.div<{
  $split: boolean;
  $background?: string | undefined;
  $image?: string | undefined;
}>`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  ${({ $split }) => ($split ? 'position: sticky; top: 0; height: 100dvh;' : 'height: 24dvh;')}
  padding-top: env(safe-area-inset-top);
  background-color: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${({ $image }) =>
    $image
      ? `background-image: ${cssUrl($image)}; background-size: cover; background-position: center;`
      : ''}
`;
const Picture = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
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
const FormSide = styled.div<{ $split: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${({ $split }) => ($split ? 'min-height: 100dvh;' : '')}
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
const Head = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.size.pagePadTablet / 16}rem;
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
}: Readonly<{
  children: ReactNode;
  /** The kitchen's name from this device's memory, shown until the public menu has loaded. */
  kitchenName?: string | undefined;
}>) {
  const { i18n } = useTranslation();
  const split = useMediaQuery(SPLIT_QUERY);
  const kitchen = useLastKitchen();
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const picture = kitchen?.images?.phoneBanner;
  const background = picture ? kitchen?.images?.bannerBackground : undefined;
  const backgroundImage = picture ? kitchen?.images?.bannerBackgroundImage : undefined;
  const name = kitchen?.name ?? kitchenName ?? '';
  const logo = kitchen?.images?.railIcon;
  return (
    <Split $split={split}>
      <Panel $split={split} $background={background} $image={backgroundImage}>
        {picture && kitchen ? (
          <Picture src={picture} alt={bannerAlt(kitchen, lang)} />
        ) : (
          <Name>{APP_NAME}</Name>
        )}
      </Panel>
      <FormSide $split={split}>
        <TopBar>
          <LanguageSwitch compact />
        </TopBar>
        <FormArea>
          {kitchen || kitchenName ? (
            <Head>
              {logo ? <Logo src={logo} alt="" /> : <Initial>{name.slice(0, 1)}</Initial>}
              <KitchenTitle>{name}</KitchenTitle>
            </Head>
          ) : null}
          {children}
        </FormArea>
      </FormSide>
    </Split>
  );
}
