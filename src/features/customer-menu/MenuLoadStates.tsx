import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { CardBody, CardHead, MainButton, StatusCard } from './menuParts';

// Loading and load-error states of the menu (spec §4.1): a quiet skeleton, then an error card
// with Try again. No spinner animation, so reduced motion needs nothing extra.

const Screen = styled.main`
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.c.bg};
`;
const Block = styled.div<{ $h: string; $w?: string }>`
  height: ${({ $h }) => $h};
  width: ${({ $w }) => $w ?? 'auto'};
  margin: 0 ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
`;
const Banner = styled.div`
  height: calc(6.5rem + var(--sat));
  background: ${({ theme }) => theme.c.surf2};
`;
const Picture = styled.div`
  height: 11rem;
  background: ${({ theme }) => theme.c.surf2};
  opacity: 0.6;
`;

function Skeleton() {
  return (
    <>
      <Banner />
      <Picture />
      <Block $h="1.75rem" $w="55%" />
      <Block $h="1rem" $w="75%" />
    </>
  );
}

export function MenuLoadingView() {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <Screen role="status" aria-busy="true" aria-label={t('states.loading')}>
      <Skeleton />
    </Screen>
  );
}

export function MenuErrorView({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <Screen>
      <Skeleton />
      <StatusCard role="alert">
        <CardHead $tone="danger">
          <MenuIcon name="warning" size="1.5rem" />
          <h2>{t('states.errorTitle')}</h2>
        </CardHead>
        <CardBody>{t('states.errorBody')}</CardBody>
        <MainButton type="button" onClick={onRetry}>
          {t('common.retry')}
        </MainButton>
      </StatusCard>
    </Screen>
  );
}
