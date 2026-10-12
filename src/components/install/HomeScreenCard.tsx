import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { InstallOverlay } from './InstallScreens';
import { INSTALL_NS } from './i18n/register';
import { InstallIcon } from './installIcons';
import { promptInstall, useCanInstall } from './installPrompt';
import { useInstallFlow, type InstallOverride } from './useInstallFlow';

// Plan 054: a gentle "put it on your home screen" card for people using the app in a browser. Never
// shown inside the installed app. "Not now" hides it on this device for 7 days.

export const HOME_CARD_KEY = 'homeScreenCardUntil';
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;
const noTokens = (): ReadonlyArray<string> => [];

function hiddenNow(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(HOME_CARD_KEY) ?? 0);
  } catch {
    return false; // no storage: show again next visit
  }
}

function hideForAWeek(): void {
  try {
    localStorage.setItem(HOME_CARD_KEY, String(Date.now() + HIDE_MS));
  } catch {
    // no storage: the card comes back next visit
  }
}

const Card = styled.section`
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: ${({ theme }) => theme.spacing.md};
  row-gap: ${({ theme }) => theme.spacing.xs};
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf};

  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.md};
    line-height: 1.25;
    font-weight: 700;
  }
  p {
    grid-column: 2;
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;
const Disc = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
`;
const Actions = styled.div`
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;
const Go = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const NotNow = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

type Props = Readonly<{
  who: 'customer' | 'seller';
  /** The kitchen's name, for the customer's wording. */
  kitchenName?: string;
  /** Tests and fixtures: a fixed environment. */
  override?: InstallOverride;
}>;

export function HomeScreenCard({ who, kitchenName, override }: Props) {
  const { t } = useTranslation(INSTALL_NS);
  const flow = useInstallFlow({ tokens: noTokens, syncOnMount: false, ...override });
  const browserOffers = useCanInstall();
  const [hidden, setHidden] = useState(hiddenNow);
  const { env } = flow;
  const { startGuide, start } = flow;
  const notNow = useCallback(() => {
    hideForAWeek();
    setHidden(true);
  }, []);
  const add = useCallback(() => {
    if (browserOffers) void promptInstall();
    else if (env.platform === 'ios' && !env.inApp) startGuide();
    else start();
  }, [browserOffers, env, startGuide, start]);

  if (env.installed || hidden) return null;
  const canAdd = browserOffers || env.platform === 'ios';
  // A desktop browser that cannot install has nothing to suggest.
  if (!canAdd && env.platform !== 'android') return null;

  const name = kitchenName ?? '';
  return (
    <>
      <Card aria-label={t('homeCard.label')} data-testid="home-screen-card">
        <Disc>
          <InstallIcon name="download" />
        </Disc>
        <h2>
          {who === 'customer' ? t('homeCard.customerTitle', { name }) : t('homeCard.sellerTitle')}
        </h2>
        <p>{who === 'customer' ? t('homeCard.customerBody') : t('homeCard.sellerBody')}</p>
        {canAdd ? null : <p>{t('homeCard.openInChrome')}</p>}
        <Actions>
          {canAdd ? (
            <Go type="button" onClick={add}>
              {browserOffers ? t('homeCard.add') : t('homeCard.showMe')}
            </Go>
          ) : null}
          <NotNow type="button" onClick={notNow}>
            {t('notNow')}
          </NotNow>
        </Actions>
      </Card>
      <InstallOverlay controller={flow} kitchenName={name || t('sellerInstall.name')} />
    </>
  );
}
