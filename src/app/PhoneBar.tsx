import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import { useUnseenNewOrders } from '../features/seller-orders';
import { PRIVATE_NS, usePrivateDueCount } from '../features/seller-private';
import { Icon } from '../ui';
import { HREF, ICON, PHONE_NAV_IDS, type PhoneNavId } from './sellerNav';

const LABEL_KEY: Readonly<Record<PhoneNavId, string>> = {
  orders: 'sellerNav.navOrders',
  handover: 'sellerNav.navHandover',
  more: 'sellerNav.navMore',
};

const Bar = styled.footer`
  position: sticky;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.panel};
`;
const List = styled.ul`
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Tab = styled(Link)<{ $active: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  min-height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.xs};
  color: ${({ $active, theme }) => ($active ? theme.c.atext : theme.c.muted)};
  font-size: 0.75rem;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  text-align: center;
  text-decoration: none;

  &:focus-visible {
    outline-offset: -0.125rem;
  }
`;
// Plan 021: new orders not yet seen.
const Dot = styled.span`
  position: absolute;
  top: 0.5rem;
  left: calc(50% + 0.5rem);
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.warn};
`;
// Plan 081: private orders due today or tomorrow, a small number on More.
const Badge = styled.span`
  position: absolute;
  top: 0.25rem;
  left: calc(50% + 0.5rem);
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3125rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.125rem;
  text-align: center;
`;
const Hidden = styled.span`
  position: absolute;
  width: 0.0625rem;
  height: 0.0625rem;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;
const Item = styled.li`
  flex: 1;
  min-width: 0;
`;

/** Phone: Orders · Pickup & delivery · More. The current tab is marked by weight and colour. */
export function PhoneBar({ activeId }: Readonly<{ activeId: PhoneNavId }>) {
  const { t } = useTranslation();
  const unseenNew = useUnseenNewOrders();
  const privateDue = usePrivateDueCount();
  return (
    <Bar>
      <nav aria-label={t('sellerNav.phoneLabel')}>
        <List>
          {PHONE_NAV_IDS.map((id) => (
            <Item key={id}>
              <Tab
                to={HREF[id]}
                $active={id === activeId}
                aria-current={id === activeId ? 'page' : undefined}
              >
                <Icon name={ICON[id]} />
                {t(LABEL_KEY[id])}
                {id === 'more' && privateDue > 0 ? (
                  <>
                    <Badge aria-hidden="true">{privateDue}</Badge>
                    <Hidden>{t('dueBadge', { ns: PRIVATE_NS, count: privateDue })}</Hidden>
                  </>
                ) : null}
                {id === 'orders' && unseenNew > 0 ? (
                  <>
                    <Dot aria-hidden="true" />
                    <Hidden>{t('sellerNav.newOrders')}</Hidden>
                  </>
                ) : null}
              </Tab>
            </Item>
          ))}
        </List>
      </nav>
    </Bar>
  );
}
