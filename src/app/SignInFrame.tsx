import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../shared/appName';
import type { Kitchen } from '../../shared/domain';
import { bannerAlt } from '../../shared/kitchenImages';
import { fetchMenu } from '../api/client';
import { lastKitchen } from '../api/device/lastKitchen';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useMediaQuery } from '../components/useMediaQuery';
import { PageHeader } from '../ui';
import { SPLIT_QUERY } from './layout';

// D-051: sign-in and set-up pages show the phone banner of the last kitchen this device used,
// whole (never cropped) on that kitchen's colour or background picture. Without a last kitchen or
// a phone banner: a plain tinted panel with the app name, never a sample picture. The picture
// comes from the same public menu the customer app reads.

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
  grid-template-columns: 55fr 45fr;
  flex-direction: column;
  min-height: 100dvh;
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
  ${({ $split }) => ($split ? 'position: sticky; top: 0; height: 100dvh;' : 'height: 30dvh;')}
  padding-top: env(safe-area-inset-top);
  background-color: ${({ theme, $background }) => $background ?? theme.colour.surfaceAlt};
  ${({ $image }) =>
    $image
      ? `background-image: url("${$image}"); background-size: cover; background-position: center;`
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
  color: ${({ theme }) => theme.colour.text};
`;
const FormSide = styled.div<{ $split: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${({ $split }) => ($split ? 'min-height: 100dvh;' : '')}
`;
// The screens inside keep their own widths; here they only sit in the middle of the free space.
const FormArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;

  & > main {
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
  }
`;

/** The frame of the seller and admin sign-in and set-up pages. */
export function SignInFrame({ children }: Readonly<{ children: ReactNode }>) {
  const { i18n } = useTranslation();
  const split = useMediaQuery(SPLIT_QUERY);
  const kitchen = useLastKitchen();
  const lang = i18n.language.startsWith('id') ? 'id' : 'en';
  const picture = kitchen?.images?.phoneBanner;
  const background = picture ? kitchen?.images?.bannerBackground : undefined;
  const backgroundImage = picture ? kitchen?.images?.bannerBackgroundImage : undefined;
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
        <PageHeader title="" titleHidden trailing={<LanguageSwitch compact />} />
        <FormArea>{children}</FormArea>
      </FormSide>
    </Split>
  );
}
