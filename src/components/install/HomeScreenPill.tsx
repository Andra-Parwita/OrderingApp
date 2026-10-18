import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hideHomeNudge, homeNudgeHidden } from '../notice/nudgeState';
import { Pill, PillBody, PillButton, PillClose, PillLink } from '../notice/NoticePill';
import { InstallOverlay } from './InstallScreens';
import { INSTALL_NS } from './i18n/register';
import { readEnvironment, type Environment } from './detect';
import { promptInstall, useCanInstall } from './installPrompt';
import { useInstallFlow, type InstallOverride } from './useInstallFlow';

// Plan 096: "Add to your home screen · How" in the soft-stone pill (N1), on the order-placed page of a
// first order. Browser only (never inside the installed app); the cross hides it for 14 days.

const noTokens = (): ReadonlyArray<string> => [];

/** The browser can add the app, or it is an iPhone or Android phone with steps to show. */
function offered(env: Environment, browserOffers: boolean): boolean {
  if (env.installed) return false;
  return browserOffers || env.platform === 'ios' || env.platform === 'android';
}

/** Whether the pill would show now (decided once when the page opens). */
export function useHomePillOffered(override?: InstallOverride): boolean {
  const browserOffers = useCanInstall();
  const [env] = useState<Environment>(() => override?.env ?? readEnvironment());
  const [hidden] = useState(() => homeNudgeHidden());
  return !hidden && offered(env, browserOffers);
}

export function HomeScreenPill({
  kitchenName,
  override,
}: Readonly<{ kitchenName: string; override?: InstallOverride }>) {
  const { t } = useTranslation(INSTALL_NS);
  const flow = useInstallFlow({ tokens: noTokens, syncOnMount: false, ...override });
  const browserOffers = useCanInstall();
  const [hidden, setHidden] = useState(false);
  const { env, startGuide, start } = flow;
  const how = useCallback(() => {
    if (browserOffers) void promptInstall();
    else if (env.platform === 'ios' && !env.inApp) startGuide();
    else start();
  }, [browserOffers, env, startGuide, start]);
  const hide = useCallback(() => {
    hideHomeNudge();
    setHidden(true);
  }, []);
  return (
    <>
      {hidden ? null : (
        <Pill $kind="tip" role="status" data-testid="home-screen-pill">
          <PillButton
            type="button"
            aria-label={`${t('homePill.text')}. ${t('homePill.how')}`}
            onClick={how}
          >
            <PillBody text={t('homePill.text')} />
            <PillLink>{t('homePill.how')}</PillLink>
          </PillButton>
          <PillClose type="button" $kind="tip" aria-label={t('homePill.hide')} onClick={hide}>
            ✕
          </PillClose>
        </Pill>
      )}
      <InstallOverlay controller={flow} kitchenName={kitchenName} />
    </>
  );
}
