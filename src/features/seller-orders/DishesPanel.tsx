import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { LIMIT_MAX } from '../../../shared/setupContract';
import { pickText } from '../../../shared/text';
import type { MenuDishView } from '../../../shared/menusContract';
import { Button, SlideOver, TextField } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { useLang } from './orderText';
import { selectCurrent, selectSoldByItem } from './sellerOrdersSelectors';
import { dishPatchRequested } from './sellerOrdersSlice';

// The live Dishes panel (D-069 Q6): sold / limit / left for each dish, with Edit limit and Sold
// out. Edits are instant (D-069 Q2). It talks to today's menu item route (PATCH
// /api/seller/menu/items/:id), the only per-dish live route that exists.

// Plan 015: shown inside a slide-over opened by the Dishes button.
const Wrap = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
`;
const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: 1.125rem;
  font-weight: 700;
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Names = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    font-size: 0.9375rem;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
`;
const Badge = styled.span`
  color: ${({ theme }) => theme.c.danger};
  font-size: 0.8125rem;
  font-weight: 700;
`;
const Buttons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const LimitForm = styled.form`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  padding-bottom: ${({ theme }) => theme.spacing.sm};
`;

function LimitEditor({ dish, onDone }: Readonly<{ dish: MenuDishView; onDone: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const [value, setValue] = useState(dish.limit === undefined ? '' : String(dish.limit));
  const parsed = value.trim() === '' ? null : Number(value);
  const invalid =
    parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > LIMIT_MAX);
  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (invalid) return;
      dispatch(dishPatchRequested({ id: dish.id, patch: { limit: parsed } }));
      onDone();
    },
    [dispatch, dish.id, invalid, onDone, parsed],
  );
  return (
    <LimitForm onSubmit={submit}>
      <TextField
        label={t('dishes.limitLabel', { name: pickText(dish.name, lang) })}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
      />
      <Button type="submit" variant="primary" disabled={invalid}>
        {t('dishes.save')}
      </Button>
      <Button type="button" onClick={onDone}>
        {t('dishes.cancel')}
      </Button>
    </LimitForm>
  );
}

function DishRow({ dish, sold }: Readonly<{ dish: MenuDishView; sold: number }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const stop = useCallback(() => setEditing(false), []);
  const start = useCallback(() => setEditing(true), []);
  const toggleSoldOut = useCallback(
    () =>
      dispatch(
        dishPatchRequested({ id: dish.id, patch: { soldOut: !(dish.manualSoldOut === true) } }),
      ),
    [dispatch, dish.id, dish.manualSoldOut],
  );
  const name = pickText(dish.name, lang);
  const detail =
    dish.limit === undefined
      ? t('dishes.rowNoLimit', { sold })
      : t('dishes.row', { sold, left: dish.remaining ?? 0, limit: dish.limit });
  return (
    <Row>
      <Names>
        <strong>
          {name} {dish.soldOut ? <Badge>{t('dishes.soldOutBadge')}</Badge> : null}
        </strong>
        <small>{detail}</small>
      </Names>
      <Buttons>
        <Button onClick={start} aria-label={`${t('dishes.editLimit')}: ${name}`}>
          {t('dishes.editLimit')}
        </Button>
        <Button onClick={toggleSoldOut} aria-pressed={dish.manualSoldOut === true}>
          {dish.manualSoldOut === true ? t('dishes.backOn') : t('dishes.markSoldOut')}
        </Button>
      </Buttons>
      {editing ? <LimitEditor dish={dish} onDone={stop} /> : null}
    </Row>
  );
}

/** Total portions sold on the open menu (cancelled orders do not count). */
export function useSoldTotal(): number {
  const soldBy = useSelector(selectSoldByItem);
  let total = 0;
  for (const qty of soldBy.values()) total += qty;
  return total;
}

/** The Dishes slide-over (30rem on a tablet or computer, full width on a phone). */
export function DishesSlideOver({
  onClose,
  width = '30rem',
}: Readonly<{ onClose: () => void; width?: string }>) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <SlideOver
      label={t('dishes.title')}
      closeLabel={t('detail.close')}
      onClose={onClose}
      width={width}
    >
      <DishesPanel />
    </SlideOver>
  );
}

function DishesPanel() {
  const { t } = useTranslation(SELLER_NS);
  const current = useSelector(selectCurrent);
  const soldBy = useSelector(selectSoldByItem);
  if (current.status !== 'ready') return null;
  const dishes = current.view.dishes;
  return (
    <Wrap>
      <Title>{t('dishes.title')}</Title>
      {dishes.length === 0 ? <p>{t('dishes.empty')}</p> : null}
      {dishes.map((dish) => (
        <DishRow key={dish.id} dish={dish} sold={soldBy.get(dish.id) ?? 0} />
      ))}
    </Wrap>
  );
}
