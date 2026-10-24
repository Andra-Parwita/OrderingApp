import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMenu } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { InstallOverlay } from './InstallScreens';
import { INSTALL_NS } from './i18n/register';
import { promptInstall, useCanInstall } from './installPrompt';
import { useInstallFlow, type InstallOverride } from './useInstallFlow';

// "Install the app" for the seller app (plan 048 stage 3): the customer app's install flow, reused.
// Android and desktop Chrome: one tap opens the browser's own install dialog. iPhone and iPad: the
// Share → Add to Home Screen steps. Hidden once installed, or where the browser cannot install.

const noTokens = (): ReadonlyArray<string> => [];

/** The kitchen whose seller app the row installs (plan 101); none keeps the generic "Seller" row. */
export type SellerInstallKitchen = Readonly<{ slug: string; name: string }>;

/** The signed-in kitchen (the seller screens act for it) and its public name; undefined until known. */
function useOwnKitchen(): SellerInstallKitchen | undefined {
  const slug = currentSellerSlug();
  const [named, setNamed] = useState<SellerInstallKitchen | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void fetchMenu(slug).then((result) => {
      if (live && result.ok) setNamed({ slug, name: result.data.kitchen.name });
    });
    return () => {
      live = false;
    };
  }, [slug]);
  return named?.slug === slug ? named : undefined;
}

/**
 * iPhone saves the page on screen as the app's start page (plan 101): while the steps are open the
 * address carries `?k=<slug>`, so the new icon opens this kitchen. Nothing else in the address changes.
 */
function markAddressWithKitchen(slug: string): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('k') === slug) return;
    url.searchParams.set('k', slug);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // the address stays as it is: the icon opens the generic seller app, as before
  }
}

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
  const kitchen = useOwnKitchen();
  const { t: tApp } = useTranslation();
  const flow = useInstallFlow({ tokens: noTokens, syncOnMount: false, ...override });
  const browserOffers = useCanInstall();
  const { env } = flow;
  const { startGuide } = flow;
  const stepsOpen = flow.flow.screen !== null;
  const slug = kitchen?.slug;
  useEffect(() => {
    if (slug !== undefined && stepsOpen && env.platform === 'ios') markAddressWithKitchen(slug);
  }, [slug, stepsOpen, env.platform]);
  const install = useCallback(() => {
    if (browserOffers) void promptInstall();
    else startGuide();
  }, [browserOffers, startGuide]);
  return {
    available: !env.installed && (browserOffers || env.platform === 'ios'),
    title: kitchen
      ? tApp('sellerLaunch.installTitle', { name: kitchen.name })
      : t('sellerInstall.title'),
    sub: t('sellerInstall.sub'),
    install,
    overlay: (
      <InstallOverlay controller={flow} kitchenName={kitchen?.name ?? t('sellerInstall.name')} />
    ),
  };
}
