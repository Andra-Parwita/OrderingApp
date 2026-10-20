import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView } from '../../../shared/domain';
import { formatCookingDate, formatCutoff } from '../../../shared/dates';
import { YourTime } from '../../components/YourTime';
import { LOW_STOCK, MAX_QTY } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { CustomerPage } from '../../components/CustomerPage';
import { ChoiceSheet } from './ChoiceSheet';
import { FullPictureViewer } from './FullPictureViewer';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { dishMax, Group, MainButton, Qty, Round } from './menuParts';

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
// Plan 067: a fixed 64 x 64 slot on the left, so nothing jumps while the picture loads.
const PictureButton = styled.button<{ $soldOut: boolean }>`
  flex: none;
  width: 4rem;
  height: 4rem;
  padding: 0;
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};
  cursor: pointer;

  img {
    display: block;
    width: 4rem;
    height: 4rem;
    object-fit: cover;
    opacity: ${({ $soldOut }) => ($soldOut ? 0.5 : 1)};
  }
`;
const Text = styled.div`
  flex: 1;
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
const Stall = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
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
const Sub = styled.p`
  margin: -${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;
const GroupHeading = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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
  /** Plan 111: the choices of a dish that has them, with the basket (the + opens a sheet to pick). */
  choices?: ReadonlyArray<MenuItemView>;
  basket?: Readonly<Record<string, number>>;
}>;

export const Dish = memo(function Dish({
  item,
  qty,
  lang,
  onQty,
  readOnly,
  choices,
  basket,
}: DishProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const name = pickText(item.name, lang);
  const description = pickText(item.description, lang);
  const size = pickText(item.size, lang);
  const grouped = choices !== undefined && choices.length > 0;
  // A dish with choices is out when it is, or when every choice is.
  const soldOut = grouped
    ? item.soldOut || choices.every((choice) => choice.soldOut || dishMax(choice) === 0)
    : item.soldOut;
  const max = grouped ? MAX_QTY : dishMax(item);
  // Plan 029: on the day only = no Add button; sold both ways = as usual plus a stall line.
  const dayOnly = item.preorder === false;
  const stallOut = item.onTheDay === 'sold_out';
  const lowStock = item.remaining !== null && item.remaining > 0 && item.remaining <= LOW_STOCK;
  const [picking, setPicking] = useState(false);
  const add = useCallback(
    () => (grouped ? setPicking(true) : onQty(item.id, qty + 1)),
    [grouped, onQty, item.id, qty],
  );
  const remove = useCallback(
    () => (grouped ? setPicking(true) : onQty(item.id, qty - 1)),
    [grouped, onQty, item.id, qty],
  );
  const closePicking = useCallback(() => setPicking(false), []);
  const addPicked = useCallback(
    (picked: Readonly<Record<string, number>>) => {
      for (const [id, n] of Object.entries(picked)) onQty(id, (basket?.[id] ?? 0) + n);
      setPicking(false);
    },
    [onQty, basket],
  );
  const [viewing, setViewing] = useState(false);
  const closeViewer = useCallback(() => setViewing(false), []);
  return (
    <Row $soldOut={soldOut || dayOnly}>
      {item.pictureRef ? (
        <PictureButton
          type="button"
          $soldOut={soldOut}
          aria-haspopup="dialog"
          aria-label={t('menu.enlargePicture', { name })}
          onClick={() => setViewing(true)}
        >
          <img src={item.pictureRef} alt="" width={64} height={64} loading="lazy" />
        </PictureButton>
      ) : null}
      <Text>
        <DishName>{name}</DishName>
        {description ? <Description>{description}</Description> : null}
        <Meta>
          {size ? `${size} · ` : null}
          <b>{formatMoney(item.priceCents, lang)}</b>
        </Meta>
        {item.onTheDay && !dayOnly ? (
          <Stall>{stallOut ? t('menu.stallSoldOut') : t('menu.alsoAtStall')}</Stall>
        ) : null}
        {lowStock && !grouped && !soldOut && !dayOnly ? (
          <Left>
            <MenuIcon name="clock" size="1rem" />
            {t('menu.left', { count: item.remaining })}
          </Left>
        ) : null}
      </Text>
      {dayOnly ? (
        <SoldOut>
          {stallOut ? <MenuIcon name="ban" size="1rem" /> : null}
          {stallOut ? t('menu.soldOut') : t('menu.availableOnDay')}
        </SoldOut>
      ) : soldOut ? (
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
      {picking && grouped ? (
        <ChoiceSheet
          dish={item}
          choices={choices}
          lang={lang}
          basket={basket ?? {}}
          onAdd={addPicked}
          onClose={closePicking}
        />
      ) : null}
      {viewing && item.pictureRef ? (
        <FullPictureViewer
          src={item.pictureRef}
          title={name}
          label={t('menu.dishPicture', { name })}
          caption={`${name} · ${formatMoney(item.priceCents, lang)}`}
          {...(description ? { detail: description } : {})}
          onClose={closeViewer}
        />
      ) : null}
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
  // Plan 107: orderable dishes first, then the on-the-day-only ones in their own group (no add button).
  // Plan 111: a choice shows inside its dish's sheet, not as a card of its own.
  const dishes = data.items.filter((item) => item.groupId === undefined);
  const orderable = dishes.filter((item) => item.preorder !== false);
  const dayOnly = dishes.filter((item) => item.preorder === false);
  const rows = (items: ReadonlyArray<MenuItemView>) =>
    items.map((item) => {
      const choices = data.items.filter((other) => other.groupId === item.id);
      return choices.length > 0 ? (
        <Dish
          key={item.id}
          item={item}
          qty={choices.reduce((sum, choice) => sum + (basket[choice.id] ?? 0), 0)}
          lang={lang}
          onQty={onQty}
          readOnly={readOnly}
          choices={choices}
          basket={basket}
        />
      ) : (
        <Dish
          key={item.id}
          item={item}
          qty={basket[item.id] ?? 0}
          lang={lang}
          onQty={onQty}
          readOnly={readOnly}
        />
      );
    });
  return (
    <>
      {orderable.length > 0 ? <List>{rows(orderable)}</List> : null}
      {dayOnly.length > 0 ? (
        <section aria-labelledby="day-only-heading">
          <GroupHeading id="day-only-heading">{t('dishes.dayOnly')}</GroupHeading>
          <List>{rows(dayOnly)}</List>
        </section>
      ) : null}
    </>
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
    <CustomerPage title={t('dishes.title')} backLabel={t('dishes.backMenu')} onBack={onBack}>
      <Sub>
        {t('dishes.line', {
          date: formatCookingDate(week.cookingDate, lang),
          dateTime: formatCutoff(week.cutoffAt, lang),
        })}
        <YourTime label={t('home.yourTime')} kitchenZone={kitchen.timeZone} />
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
