import { useMemo, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { styled, ThemeProvider } from 'styled-components';
import { CustomerTabBar, TAB_BAR_HEIGHT, type TabId } from '../../app/CustomerShell';
import { CustomerPage } from '../../components/CustomerPage';
import { GlobalStyle } from '../../theme/GlobalStyle';
import type { Brand, Mode } from '../../theme/designTokens';
import { makeTheme } from '../../theme/themes';
import { ACCOUNT_FIXTURE_SCREENS } from './accountFixtures';
import { CHECKOUT_FIXTURE_SCREENS } from './checkoutFixtures';
import fixtures from './fixtures.json';
import { INSTALL_FIXTURE_SCREENS } from './installFixtures';
import { MENU_FIXTURE_SCREENS } from './menuFixtures';
import { ORDER_FIXTURE_SCREENS } from './orderFixtures';
import type { FixtureProps } from './types';

// Dev only: /__fixtures/:screenId?brand=ondeonde&mode=light renders one design screen with the
// data in fixtures.json (plus that screen's `screenStates`), so every state can be checked against
// the design boards. The two JSON files are copies of uxDesign/customer/data (tsconfig only
// includes src); refresh them by copying when the design data changes. No network for the data.
// Later stages register their screens in SCREENS; the rest show a "not built yet" placeholder.

export type { FixtureProps };

const SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  ...MENU_FIXTURE_SCREENS,
  ...CHECKOUT_FIXTURE_SCREENS,
  ...ORDER_FIXTURE_SCREENS,
  ...ACCOUNT_FIXTURE_SCREENS,
  ...INSTALL_FIXTURE_SCREENS,
};

/** The root screens show the bottom tab bar, as the design does: the tab each one belongs to. */
const ROOT_TABS: Readonly<Record<string, TabId>> = {
  'menu-home': 'menu',
  'menu-paused': 'menu',
  'menu-closed': 'menu',
  'menu-not-published': 'menu',
  'menu-load-error': 'menu',
  'my-orders': 'orders',
  'my-orders-empty': 'orders',
  'android-settings': 'settings',
};

const BRANDS: Readonly<Record<string, Brand>> = {
  ondeonde: 'onde',
  bali: 'bali',
  sumatra: 'sumatra',
  sunda: 'sunda',
  jawa: 'jawa',
};

const Frame = styled.div<{ $tabs: boolean }>`
  --customer-tabbar-height: ${({ $tabs }) => ($tabs ? TAB_BAR_HEIGHT : '0px')};
  max-width: 30rem;
  margin: 0 auto;
  min-height: 100dvh;
  padding-bottom: var(--customer-tabbar-height);
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;

function stateFor(id: string): Readonly<Record<string, unknown>> {
  const all: Readonly<Record<string, Record<string, unknown>>> = fixtures.screenStates;
  return all[id] ?? {};
}

export default function FixturesPage() {
  const { t } = useTranslation();
  const { screenId = '' } = useParams();
  const [query] = useSearchParams();
  const brand = BRANDS[query.get('brand') ?? 'ondeonde'] ?? 'onde';
  const mode: Mode = query.get('mode') === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => makeTheme(brand, mode), [brand, mode]);
  const Screen = SCREENS[screenId];
  const tab = Screen ? ROOT_TABS[screenId] : undefined;
  const title = t('customerNav.notBuilt', { id: screenId });
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Frame $tabs={tab !== undefined}>
        {Screen ? (
          <Screen data={fixtures} state={stateFor(screenId)} />
        ) : (
          <CustomerPage title={title} kitchenName={fixtures.kitchen.name} />
        )}
        {tab !== undefined ? (
          // The design shows the unseen-update dot on the My orders tab of the filled list only.
          <CustomerTabBar active={tab} unseen={screenId === 'my-orders'} menuHref="/" />
        ) : null}
      </Frame>
    </ThemeProvider>
  );
}
