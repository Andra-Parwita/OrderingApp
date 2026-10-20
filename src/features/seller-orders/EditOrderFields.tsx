import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, SellerMenuItemView } from '../../../shared/domain';
import { MAX_QTY, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon, IconButton, Stepper } from '../../ui';
import { fieldControlStyle } from '../../ui/Field';
import { SELLER_NS } from './i18n/register';
import type { EditRow } from './editOrderModel';
import { roomFor } from './editOrderModel';
import { Label, Names } from './orderFormParts';
import { pickableItems } from './pickItems';

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
const NoteInput = styled.input<{ $invalid: boolean }>`
  ${fieldControlStyle}
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: 0.875rem;
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
  onNote: (itemId: string, note: string) => void;
}>;

/** The order's dishes: − n + and Remove (struck through with Undo until Save). */
export function EditDishRows({ rows, menu, holds, lang, onQty, onRemoved, onNote }: RowsProps) {
  const { t } = useTranslation(SELLER_NS);
  // Plan 111: the note box of a line opens with its pencil, and stays open when there is a note.
  const [noting, setNoting] = useState<ReadonlyArray<string>>([]);
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
              {noting.includes(row.itemId) || (row.note ?? '') !== '' ? (
                <NoteInput
                  $invalid={false}
                  aria-label={t('edit.lineNote', { name })}
                  placeholder={t('edit.lineNotePlaceholder')}
                  maxLength={NOTE_MAX}
                  value={row.note ?? ''}
                  onChange={(event) => onNote(row.itemId, event.target.value)}
                />
              ) : null}
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
                label={t('edit.lineNote', { name })}
                onClick={() =>
                  setNoting((previous) =>
                    previous.includes(row.itemId) ? previous : [...previous, row.itemId],
                  )
                }
              >
                <Icon name="pencil" />
              </IconButton>
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
      {pickableItems(menu).map((item) => {
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
