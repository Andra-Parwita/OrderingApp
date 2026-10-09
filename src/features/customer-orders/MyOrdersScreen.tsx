import { memo, useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { CustomerOrder, Language } from '../../../shared/domain';
import { formatCookingDate, formatDay } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode, parseOrderCode } from '../../../shared/orderCode';
import type { ExpiredOrder } from '../../../shared/orderContract';
import { pickText } from '../../../shared/text';
import { hasUnseenUpdate, readMyOrders, type SavedOrder } from '../../api/device/myOrders';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Button, ListRow, PageHeader, Pill, TextField } from '../../ui';
import { isThisWeek, orderTotalCents } from './helpers';
import { ORDERS_NS } from './i18n/register';
import {
  Block,
  Muted,
  Page,
  ScreenBoundary,
  StateMessage,
  Strong,
  VisuallyHidden,
  useLang,
} from './layout';
import { selectList, selectMenus } from './selectors';
import { listRequested } from './slice';
import { toneOf } from './tone';

const SectionTitle = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const Rows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Line = styled.span`
  display: block;
`;

const Dot = styled.span`
  display: inline-block;
  width: ${({ theme }) => theme.spacing.sm};
  height: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.accent};
`;

const LockLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const Centered = styled(Muted)`
  text-align: center;
`;

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
      <rect x="2" y="5" width="8" height="6" rx="1" />
      <path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

type RowProps = Readonly<{
  order: CustomerOrder;
  saved: SavedOrder | undefined;
  day: string;
  lang: Language;
  onOpen: (token: string) => void;
}>;

const OrderRow = memo(function OrderRow({ order, saved, day, lang, onOpen }: RowProps) {
  const { t } = useTranslation(ORDERS_NS);
  const open = useCallback(() => onOpen(order.token), [onOpen, order.token]);
  const summary = order.lines.map((line) => `${line.qty}× ${pickText(line.name, lang)}`).join(', ');
  const how = order.fulfilment === 'delivery' ? t('list.delivery') : t('list.pickup');
  const unseen = hasUnseenUpdate(order, saved);
  return (
    <li>
      <ListRow
        onClick={open}
        primary={
          <>
            {formatOrderCode(order.code)}
            {` · ${order.seller.name}`}
          </>
        }
        secondary={
          <>
            <Line>{summary}</Line>
            <Line>
              {day} · {how}
            </Line>
          </>
        }
        trailing={
          <>
            {unseen ? (
              <>
                <Dot aria-hidden="true" />
                <VisuallyHidden>{t('list.newUpdate')}</VisuallyHidden>
              </>
            ) : null}
            <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
            <Strong>{formatMoney(orderTotalCents(order), lang)}</Strong>
            {order.locked ? (
              <LockLabel>
                <LockIcon />
                {t('list.locked')}
              </LockLabel>
            ) : null}
          </>
        }
      />
    </li>
  );
});

type ExpiredRowProps = Readonly<{
  order: ExpiredOrder;
  /** From this phone's saved entry: the server no longer knows the code. */
  code: string | undefined;
  lang: Language;
  onOpen: (token: string) => void;
}>;

/** A closed week's order past the 4 weeks: one line, no details (D-044). */
const ExpiredRow = memo(function ExpiredRow({ order, code, lang, onOpen }: ExpiredRowProps) {
  const { t } = useTranslation(ORDERS_NS);
  const open = useCallback(() => onOpen(order.token), [onOpen, order.token]);
  return (
    <li>
      <ListRow
        onClick={open}
        primary={
          <>
            {code ? `${formatOrderCode(code)} · ` : ''}
            {order.seller.name}
          </>
        }
        secondary={
          <Line>
            {t('list.archivedLine', { date: formatCookingDate(order.cookingDate, lang) })}
          </Line>
        }
      />
    </li>
  );
});

type Props = Readonly<{
  /** Used by the empty state's "to the menu" button; the header has no back arrow (tab root). */
  onBack: () => void;
  /** Open the order page for this private token. */
  onOpenOrder: (token: string) => void;
}>;

function MyOrdersContent({ onBack, onOpenOrder }: Props) {
  const { t } = useTranslation(ORDERS_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const menus = useSelector(selectMenus);
  const [code, setCode] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    dispatch(listRequested());
  }, [dispatch]);
  useEffect(load, [load]);

  // Typing a saved code opens that order on the 6th character; any spacing or case works.
  const onCode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setCode(value);
      const parsed = parseOrderCode(value);
      if (parsed === null) {
        setNotFound(false);
        return;
      }
      const match = readMyOrders().find((entry) => entry.code === parsed);
      if (match) onOpenOrder(match.token);
      else setNotFound(true);
    },
    [onOpenOrder],
  );

  const cookingOf = (order: CustomerOrder) => menus[order.seller.slug]?.week.cookingDate ?? null;

  // A closed week's order (D-044) is always "earlier", and shows the date of its own week.
  const isCurrent = (order: CustomerOrder) =>
    order.archived !== true && isThisWeek(order, cookingOf(order));

  const renderRows = (orders: ReadonlyArray<CustomerOrder>, saved: ReadonlyArray<SavedOrder>) =>
    orders.map((order) => {
      const cooking = order.archived === true ? (order.cookingDate ?? null) : cookingOf(order);
      return (
        <OrderRow
          key={order.token}
          order={order}
          saved={saved.find((entry) => entry.token === order.token)}
          day={
            cooking !== null && (order.archived === true || isThisWeek(order, cooking))
              ? formatCookingDate(cooking, lang)
              : formatDay(order.createdAt, lang)
          }
          lang={lang}
          onOpen={onOpenOrder}
        />
      );
    });

  let body;
  if (list.status === 'error') {
    body = <StateMessage alert text={t('list.loadError')} onRetry={load} />;
  } else if (list.status !== 'ready') {
    body = <StateMessage text={t('common.loading')} />;
  } else if (list.orders.length === 0 && list.expired.length === 0) {
    body = (
      <Block>
        <Muted>{t('list.empty')}</Muted>
        <Button variant="primary" onClick={onBack}>
          {t('list.toMenu')}
        </Button>
      </Block>
    );
  } else {
    const thisWeek = list.orders.filter(isCurrent);
    const earlier = list.orders.filter((order) => !isCurrent(order));
    body = (
      <>
        {thisWeek.length > 0 ? (
          <section>
            <SectionTitle>{t('list.thisWeek')}</SectionTitle>
            <Rows>{renderRows(thisWeek, list.saved)}</Rows>
          </section>
        ) : null}
        {earlier.length > 0 || list.expired.length > 0 ? (
          <section>
            <SectionTitle>{t('list.earlier')}</SectionTitle>
            <Rows>
              {renderRows(earlier, list.saved)}
              {list.expired.map((expired) => (
                <ExpiredRow
                  key={expired.token}
                  order={expired}
                  code={list.saved.find((entry) => entry.token === expired.token)?.code}
                  lang={lang}
                  onOpen={onOpenOrder}
                />
              ))}
            </Rows>
          </section>
        ) : null}
        <Centered>{t('list.footnote')}</Centered>
      </>
    );
  }

  return (
    <Page>
      <PageHeader title={t('list.title')} trailing={<LanguageSwitch compact />} />
      <Block>
        <Strong>{t('list.findTitle')}</Strong>
        <TextField
          label={t('list.codeLabel')}
          helper={t('list.codeHelper')}
          error={notFound ? t('list.codeNotFound') : undefined}
          value={code}
          onChange={onCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </Block>
      {body}
    </Page>
  );
}

export function MyOrdersScreen(props: Props) {
  return (
    <ScreenBoundary>
      <MyOrdersContent {...props} />
    </ScreenBoundary>
  );
}
