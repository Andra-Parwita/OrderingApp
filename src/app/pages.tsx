import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../components/LanguageSwitch';

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  min-height: 100dvh;
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
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
`;

/** `/`: what Delave is. Customers arrive through a seller's own link, so no list of sellers. */
export function HomePage() {
  const { t } = useTranslation();
  return (
    <ShellPage>
      <Bar>
        <LanguageSwitch />
      </Bar>
      <Title>{t('home.title')}</Title>
      <Text>{t('home.body')}</Text>
      <Text>{t('home.hint')}</Text>
    </ShellPage>
  );
}

/** `/<slug>` with a mistyped, old or reserved slug. */
export function KitchenNotFoundPage() {
  const { t } = useTranslation();
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
