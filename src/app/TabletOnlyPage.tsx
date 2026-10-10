import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import { Icon } from '../ui';

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
  padding-top: ${({ theme }) => theme.spacing.xxl};
  color: ${({ theme }) => theme.c.text};
`;
const Title = styled.h1`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  font-size: 1.625rem;
  font-weight: 700;
  line-height: 1.25;
`;
const Body = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.9375rem;
`;
const Next = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.mainAction}px;
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font-weight: 700;
  text-decoration: none;
`;

/** Shown on a phone in place of Kitchen, Menu and Settings (D-057, D-067). */
export function TabletOnlyPage() {
  const { t } = useTranslation();
  return (
    <Wrap>
      <Title>
        <Icon name="tablet" />
        {t('sellerNav.tabletOnlyTitle')}
      </Title>
      <Body>{t('sellerNav.tabletOnlyBody')}</Body>
      <Next to="/seller">{t('sellerNav.tabletOnlyOrders')}</Next>
    </Wrap>
  );
}
