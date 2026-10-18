import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, SellerMenuItemView } from '../../../shared/domain';
import { MAX_QTY } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon, IconButton, Stepper } from '../../ui';
import { SELLER_NS } from './i18n/register';
import type { EditRow } from './editOrderModel';
import { roomFor } from './editOrderModel';
import { Label, Names } from './orderFormParts';

// The dish lines and the "Add dish" list of the Edit order sheet (plan 105).

const Line = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Gone = styled.span`
  color: ${({ theme }) => theme.c.muted};
  text-decoration: line-through;

  small {
    margin-left: ${({ theme }) => theme.spacing.xs};
    text-decoration: none;
  }
`;
const Warn = styled.small`
  display: block;
  color: ${({ theme }) => theme.c.warn};
`;
const Controls = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  flex: none;
`;
const NewMark = styled.span`
  margin-left: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.conf};
  font-size: 0.75rem;
  font-weight: 700;
`;
const Have = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  white-space: nowrap;
`;

type RowsProps = Readonly<{
  rows: ReadonlyArray<EditRow>;
  menu: ReadonlyArray<SellerMenuItemView>;
  /** The order holds portions (false for a cancelled order that stays cancelled). */
  holds: boolean;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
  onRemoved: (itemId: string, removed: boolean) => void;
}>;

/** The order's dishes: − n + and Remove (struck through with Undo until Save). */
export function EditDishRows({ rows, menu, holds, lang, onQty, onRemoved }: RowsProps) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <>
      {rows.map((row) => {
        const name = pickText(row.name, lang);
        if (row.removed) {
          return (
            <Line key={row.itemId}>
              <Gone>
                {name} <small>{t('edit.removed')}</small>
              </Gone>
              <Button variant="quiet" onClick={() => onRemoved(row.itemId, false)}>
                {t('edit.undo')}
              </Button>
            </Line>
          );
        }
        const room = roomFor(
          row,
          menu.find((item) => item.id === row.itemId),
          holds,
        );
        return (
          <Line key={row.itemId}>
            <Names>
              <span>
                {name}
                {row.was === 0 ? <NewMark>{t('edit.newDish')}</NewMark> : null}
              </span>
              <small>{formatMoney(row.priceCents, lang)}</small>
              {room !== null && row.qty > room ? (
                <Warn role="status">{t('edit.limit', { left: Math.max(room, 0), name })}</Warn>
              ) : null}
            </Names>
            <Controls>
              <Stepper
                value={row.qty}
                min={1}
                max={MAX_QTY}
                onChange={(next: number) => onQty(row.itemId, next)}
                label={name}
                decreaseLabel={t('new.decrease', { name })}
                increaseLabel={t('new.increase', { name })}
              />
              <IconButton
                label={t('edit.remove', { name })}
                onClick={() => onRemoved(row.itemId, true)}
              >
                <Icon name="x" />
              </IconButton>
            </Controls>
          </Line>
        );
      })}
    </>
  );
}

type AddListProps = Readonly<{
  rows: ReadonlyArray<EditRow>;
  menu: ReadonlyArray<SellerMenuItemView>;
  lang: Language;
  onAdd: (item: SellerMenuItemView) => void;
}>;

/** The current menu with what is left of each dish; dishes already in the order show a tick. */
export function AddDishList({ rows, menu, lang, onAdd }: AddListProps) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <div>
      <Label>{t('edit.addTitle')}</Label>
      {menu.map((item) => {
        const name = pickText(item.name, lang);
        const inOrder = rows.find((row) => row.itemId === item.id && !row.removed);
        const hint = item.soldOut
          ? t('edit.soldOut')
          : item.remaining !== null
            ? t('edit.left', { count: item.remaining })
            : null;
        return (
          <Line key={item.id}>
            <Names>
              <span>{name}</span>
              <small>
                {formatMoney(item.priceCents, lang)}
                {hint ? ` · ${hint}` : ''}
              </small>
            </Names>
            {inOrder ? (
              <Have>✓ {inOrder.qty}</Have>
            ) : (
              <Button onClick={() => onAdd(item)}>
                <Icon name="plus" />
                {t('edit.add')}
              </Button>
            )}
          </Line>
        );
      })}
    </div>
  );
}
