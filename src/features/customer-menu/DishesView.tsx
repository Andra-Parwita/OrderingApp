import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView } from '../../../shared/domain';
import { formatCookingDate, formatCutoff } from '../../../shared/dates';
import { LOW_STOCK, MAX_QTY } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { CustomerPage } from '../../components/CustomerPage';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { MainButton } from './menuParts';

// The dishes page (spec §4.1): a pushed page with a name, a muted description, size · price and a
// round stepper per dish, then a sticky basket bar. Presentational: the basket lives in the store.

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Row = styled.li<{ $soldOut: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme, $soldOut }) => ($soldOut ? theme.c.muted : theme.c.text)};
`;
const Text = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;
const DishName = styled.span`
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
`;
const Description = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Meta = styled.span`
  font-size: ${({ theme }) => theme.type.size.md};
  b {
    font-weight: 700;
  }
`;
const Left = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.warn};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
`;
const SoldOut = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: 2.25rem;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
  white-space: nowrap;
`;
export const Round = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
export const Group = styled.div`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
export const Qty = styled.output`
  min-width: 1.5rem;
  text-align: center;
  font-weight: 700;
  color: ${({ theme }) => theme.c.atext};
`;
const Sub = styled.p`
  margin: -${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;
const Empty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;
const BasketBar = styled.div`
  position: sticky;
  /* Above the customer tab bar (the shell sets its height). */
  bottom: var(--customer-tabbar-height, 0rem);
  z-index: 5;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: linear-gradient(transparent, ${({ theme }) => theme.c.bg} 30%);
`;
const BarButton = styled(MainButton)`
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing.lg};
`;
const BarEnd = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

type DishProps = Readonly<{
  item: MenuItemView;
  qty: number;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
  /** Ordering is off (closed, paused or the seller's preview): the dish shows, no stepper works. */
  readOnly: boolean;
}>;

/** The most of a dish the basket may hold: what is left, never past MAX_QTY. */
export function dishMax(item: MenuItemView): number {
  return item.soldOut ? 0 : Math.min(MAX_QTY, item.remaining ?? MAX_QTY);
}

const Dish = memo(function Dish({ item, qty, lang, onQty, readOnly }: DishProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const name = pickText(item.name, lang);
  const description = pickText(item.description, lang);
  const size = pickText(item.size, lang);
  const max = dishMax(item);
  const lowStock = item.remaining !== null && item.remaining > 0 && item.remaining <= LOW_STOCK;
  const add = useCallback(() => onQty(item.id, qty + 1), [onQty, item.id, qty]);
  const remove = useCallback(() => onQty(item.id, qty - 1), [onQty, item.id, qty]);
  return (
    <Row $soldOut={item.soldOut}>
      <Text>
        <DishName>{name}</DishName>
        {description ? <Description>{description}</Description> : null}
        <Meta>
          {size ? `${size} · ` : null}
          <b>{formatMoney(item.priceCents, lang)}</b>
        </Meta>
        {lowStock && !item.soldOut ? (
          <Left>
            <MenuIcon name="clock" size="1rem" />
            {t('menu.left', { count: item.remaining })}
          </Left>
        ) : null}
      </Text>
      {item.soldOut ? (
        <SoldOut>
          <MenuIcon name="ban" size="1rem" />
          {t('menu.soldOut')}
        </SoldOut>
      ) : (
        <Group role="group" aria-label={name}>
          {qty > 0 ? (
            <>
              <Round
                type="button"
                aria-label={t('menu.decrease', { name })}
                disabled={readOnly}
                onClick={remove}
              >
                <MenuIcon name="minus" />
              </Round>
              <Qty aria-live="polite">{qty}</Qty>
            </>
          ) : null}
          <Round
            type="button"
            aria-label={t('menu.increase', { name })}
            disabled={readOnly || qty >= max}
            onClick={add}
          >
            <MenuIcon name="plus" />
          </Round>
        </Group>
      )}
    </Row>
  );
});

type ListProps = Readonly<{
  data: MenuResponse;
  basket: Readonly<Record<string, number>>;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
  readOnly: boolean;
}>;

/** The dish rows alone (the seller's preview shows them under the menu home). */
export function DishList({ data, basket, lang, onQty, readOnly }: ListProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  if (data.items.length === 0) return <Empty>{t('dishes.empty')}</Empty>;
  return (
    <List>
      {data.items.map((item) => (
        <Dish
          key={item.id}
          item={item}
          qty={basket[item.id] ?? 0}
          lang={lang}
          onQty={onQty}
          readOnly={readOnly}
        />
      ))}
    </List>
  );
}

type PageProps = ListProps &
  Readonly<{
    count: number;
    totalCents: number;
    onBack: () => void;
    onViewBasket: () => void;
  }>;

export function DishesView({
  data,
  basket,
  lang,
  onQty,
  readOnly,
  count,
  totalCents,
  onBack,
  onViewBasket,
}: PageProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen, week } = data;
  return (
    <CustomerPage
      title={t('dishes.title')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage ?? undefined}
      backLabel={t('dishes.backMenu')}
      onBack={onBack}
    >
      <Sub>
        {t('dishes.line', {
          date: formatCookingDate(week.cookingDate, lang),
          dateTime: formatCutoff(week.cutoffAt, lang),
        })}
      </Sub>
      <DishList data={data} basket={basket} lang={lang} onQty={onQty} readOnly={readOnly} />
      {count > 0 && !readOnly ? (
        <BasketBar>
          <BarButton type="button" onClick={onViewBasket}>
            <span>
              {t('menu.items', { count })} · {formatMoney(totalCents, lang)}
            </span>
            <BarEnd>
              {t('dishes.viewBasket')}
              <MenuIcon name="chevron" />
            </BarEnd>
          </BarButton>
        </BasketBar>
      ) : null}
    </CustomerPage>
  );
}
