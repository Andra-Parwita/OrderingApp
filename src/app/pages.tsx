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

type Props = Readonly<{ title: string; text: string; linkText: string }>;

function Notice({ title, text, linkText }: Props) {
  return (
    <Page>
      <Bar>
        <LanguageSwitch />
      </Bar>
      <Title>{title}</Title>
      <Text>{text}</Text>
      <Home to="/">{linkText}</Home>
    </Page>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Notice title={t('notFound.title')} text={t('notFound.body')} linkText={t('notFound.home')} />
  );
}

/** Placeholder until batch 2 builds the real list. */
export function MyOrdersPage() {
  const { t } = useTranslation();
  return (
    <Notice title={t('myOrders.title')} text={t('myOrders.soon')} linkText={t('myOrders.back')} />
  );
}
