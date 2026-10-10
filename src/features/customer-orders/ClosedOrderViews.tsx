import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { CustomerOrder, Language } from '../../../shared/domain';
import { formatCookingDate, formatDayTime } from '../../../shared/dates';
import type { MenuResponse } from '../../../shared/menuContract';
import type { ExpiredOrder } from '../../../shared/orderContract';
import { PageTopBar } from '../../components/CustomerPage';
import { keptUntil } from './helpers';
import { ORDERS_NS } from './i18n/register';
import { VisuallyHidden } from './layout';
import { OrderIcon } from './orderIcons';
import { orderInfo } from './orderInfo';
import { Details } from './OrderPageView';
import {
  Actions,
  Chip,
  ChipRow,
  Hint,
  MainButton,
  OrderCode,
  OrderHead,
  Updates,
} from './orderParts';

// The two read-only views of a finished menu (spec §4.5): the earlier order (details still
// kept) and the archived order (only whose it was and which week).

const Page = styled.div`
  padding-bottom: calc(
    var(--customer-tabbar-height, 0rem) + var(--sab) + ${({ theme }) => theme.spacing.xl}
  );
`;
const Note = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf2};
  font-size: ${({ theme }) => theme.type.size.base};

  svg {
    margin-top: 0.1rem;
    color: ${({ theme }) => theme.c.muted};
  }
`;

/** order-earlier: a closed menu's order, read-only (D-044). */
export function EarlierOrderView({
  order,
  menu,
  lang,
  paid,
  onBack,
  onOpenMenu,
}: Readonly<{
  order: CustomerOrder;
  menu: MenuResponse | undefined;
  lang: Language;
  paid?: boolean;
  onBack: () => void;
  onOpenMenu: () => void;
}>) {
  const { t } = useTranslation(ORDERS_NS);
  const info = orderInfo(order, menu, lang);
  const eyebrow = [info.kitchenName, info.dateText].filter(Boolean).join(' · ');
  const kept = order.cookingDate ? formatCookingDate(keptUntil(order.cookingDate), lang) : null;
  const done = order.status === 'collected' || order.status === 'delivered';
  return (
    <Page>
      <PageTopBar
        kitchenName={info.kitchenName}
        logoSrc={info.logoSrc}
        backLabel={t('common.myOrders')}
        onBack={onBack}
      />
      <VisuallyHidden as="h1">{t('order.title')}</VisuallyHidden>
      <OrderHead eyebrow={eyebrow} code={order.code} />
      <ChipRow>
        <Chip
          tone={order.status === 'cancelled' ? 'danger' : done ? 'conf' : 'muted'}
          icon={order.status === 'cancelled' ? 'ban' : 'check'}
        >
          {t(`status.${order.status}`)}
          {order.collectedAt ? ` · ${formatDayTime(order.collectedAt, lang)}` : ''}
        </Chip>
      </ChipRow>
      <Note role="status">
        <OrderIcon name="lock" />
        <span>{t('order.menuClosed')}</span>
      </Note>
      <Details order={order} lang={lang} paid={paid} info={info} />
      <Updates inbox={order.inbox} lang={lang} place={info.place} cook={info.cook} />
      <Actions>
        <MainButton type="button" onClick={onOpenMenu}>
          {t('order.seeMenu')}
        </MainButton>
        {kept ? <Hint>{t('order.keptUntil', { date: kept })}</Hint> : null}
      </Actions>
    </Page>
  );
}

const Center = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xxl} ${({ theme }) => theme.spacing.xl};
  text-align: center;

  h1 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.xl};
    line-height: 1.2;
    font-weight: 700;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
  p b {
    color: ${({ theme }) => theme.c.text};
    font-weight: 700;
  }
`;
const Disc = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.muted};
`;
const Pad = styled.div`
  width: 100%;
  max-width: 16rem;
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

/** order-archived: after the 4 weeks only the kitchen, the date and the code remain. */
export function ArchivedOrderView({
  order,
  code,
  kitchenName,
  logoSrc,
  lang,
  onBack,
  onOpenMenu,
}: Readonly<{
  order: ExpiredOrder;
  /** The code saved on this phone, when there is one (the server no longer has it). */
  code?: string;
  kitchenName: string;
  logoSrc?: string;
  lang: Language;
  onBack: () => void;
  onOpenMenu: () => void;
}>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <Page>
      <PageTopBar
        kitchenName={kitchenName}
        logoSrc={logoSrc}
        backLabel={t('common.myOrders')}
        onBack={onBack}
      />
      <Center>
        <Disc>
          <OrderIcon name="archive" size="2.25rem" />
        </Disc>
        <h1>{t('order.archivedTitle')}</h1>
        <p>
          <b>{kitchenName}</b> · {formatCookingDate(order.cookingDate, lang)}
        </p>
        {code ? <OrderCode code={code} size="1rem" /> : null}
        <p>{t('order.archivedBody')}</p>
        <Pad>
          <MainButton type="button" onClick={onOpenMenu}>
            {t('order.seeMenu')}
          </MainButton>
        </Pad>
      </Center>
    </Page>
  );
}
