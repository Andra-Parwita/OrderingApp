import { useMemo, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { styled, ThemeProvider } from 'styled-components';
import { CustomerPage } from '../../components/CustomerPage';
import { MyOrdersScreen } from '../../features/customer-orders';
import { GlobalStyle } from '../../theme/GlobalStyle';
import type { Brand, Mode } from '../../theme/designTokens';
import { makeTheme } from '../../theme/themes';
import fixtures from './fixtures.json';
import { MENU_FIXTURE_SCREENS } from './menuFixtures';
import type { FixtureProps } from './types';

// Dev only: /__fixtures/:screenId?brand=ondeonde&mode=light renders one design screen with the
// data in fixtures.json (plus that screen's `screenStates`), so every state can be checked against
// the design boards. The two JSON files are copies of uxDesign/customer/data (tsconfig only
// includes src); refresh them by copying when the design data changes. No network for the data.
// Later stages register their screens in SCREENS; the rest show a "not built yet" placeholder.

export type { FixtureProps };

function MyOrdersEmpty() {
  const navigate = useNavigate();
  return <MyOrdersScreen onBack={() => void navigate('/')} onOpenOrder={() => undefined} />;
}

const SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  ...MENU_FIXTURE_SCREENS,
  'my-orders-empty': MyOrdersEmpty,
};

const BRANDS: Readonly<Record<string, Brand>> = {
  ondeonde: 'onde',
  bali: 'bali',
  sumatra: 'sumatra',
  sunda: 'sunda',
  jawa: 'jawa',
};

const Frame = styled.div`
  max-width: 30rem;
  margin: 0 auto;
  min-height: 100dvh;
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
  const title = t('customerNav.notBuilt', { id: screenId });
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Frame>
        {Screen ? (
          <Screen data={fixtures} state={stateFor(screenId)} />
        ) : (
          <CustomerPage title={title} kitchenName={fixtures.kitchen.name} />
        )}
      </Frame>
    </ThemeProvider>
  );
}
