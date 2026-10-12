import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InstallOverlay } from './InstallScreens';
import { INSTALL_NS } from './i18n/register';
import { promptInstall, useCanInstall } from './installPrompt';
import { useInstallFlow, type InstallOverride } from './useInstallFlow';

// "Install the app" for the seller app (plan 048 stage 3): the customer app's install flow, reused.
// Android and desktop Chrome: one tap opens the browser's own install dialog. iPhone and iPad: the
// Share → Add to Home Screen steps. Hidden once installed, or where the browser cannot install.

const noTokens = (): ReadonlyArray<string> => [];

export type SellerInstall = Readonly<{
  /** Show the row at all. */
  available: boolean;
  /** The row's texts. */
  title: string;
  sub: string;
  /** The row's tap. */
  install: () => void;
  /** The iPhone steps, drawn over the page while open; render it next to the row. */
  overlay: ReactNode;
}>;

export function useSellerInstall(override?: InstallOverride): SellerInstall {
  const { t } = useTranslation(INSTALL_NS);
  const flow = useInstallFlow({ tokens: noTokens, syncOnMount: false, ...override });
  const browserOffers = useCanInstall();
  const { env } = flow;
  const { startGuide } = flow;
  const install = useCallback(() => {
    if (browserOffers) void promptInstall();
    else startGuide();
  }, [browserOffers, startGuide]);
  return {
    available: !env.installed && (browserOffers || env.platform === 'ios'),
    title: t('sellerInstall.title'),
    sub: t('sellerInstall.sub'),
    install,
    overlay: <InstallOverlay controller={flow} kitchenName={t('sellerInstall.name')} />,
  };
}
