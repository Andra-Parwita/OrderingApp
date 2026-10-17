import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import type { Dish } from '../../../shared/menusContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon, TextField } from '../../ui';
import { MENU_NS } from './i18n/register';
import { Muted } from './menuShared';

// The library picker: a search box, "New dish", and one ticked row per dish. The menu wizard
// (DishesStep) and the private order editor (plan 081) both use it; what a tick means is theirs.

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;
const Row = styled.div<{ $head?: boolean; $cols: string }>`
  display: grid;
  grid-template-columns: ${({ $cols }) => $cols};
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $head, theme }) => ($head ? theme.c.muted : theme.c.text)};
  font-size: ${({ $head }) => ($head ? '0.8125rem' : '0.9375rem')};
  font-weight: ${({ $head }) => ($head ? 700 : 400)};
  font-variant-numeric: tabular-nums;

  .name {
    font-weight: 600;
  }
  .sub {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
  .num {
    text-align: right;
  }
`;
const Tick = styled.input`
  width: 1.375rem;
  height: 1.375rem;
  accent-color: ${({ theme }) => theme.c.fill};
`;
export const Pencil = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;

export type DishPickerProps = Readonly<{
  dishes: ReadonlyArray<Dish>;
  lang: Language;
  /** The ticked dish ids. */
  selected: ReadonlyArray<string>;
  /** No more can be ticked (a ticked one can still be unticked). */
  full: boolean;
  onToggle: (dish: Dish) => void;
  onNewDish: () => void;
  /** The pencil beside each dish; absent = no pencil. */
  onEdit?: (dishId: string) => void;
  /** The "Last used" column (the wizard shows it). */
  showLastUsed?: boolean;
  /** Something under a ticked dish's row (the private editor's quantity and price). */
  renderSelected?: (dish: Dish) => ReactNode;
}>;

export function DishPicker({
  dishes,
  lang,
  selected,
  full,
  onToggle,
  onNewDish,
  onEdit,
  showLastUsed = true,
  renderSelected,
}: DishPickerProps) {
  const { t } = useTranslation(MENU_NS);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const shown = dishes.filter(
    (dish) =>
      needle === '' ||
      dish.name.en.toLowerCase().includes(needle) ||
      dish.name.id.toLowerCase().includes(needle),
  );
  const cols = [
    '2rem',
    'minmax(0, 1fr)',
    '5.5rem',
    ...(showLastUsed ? ['6rem'] : []),
    ...(onEdit ? ['3rem'] : []),
  ].join(' ');
  return (
    <>
      <Bar>
        <div style={{ flex: 1, minWidth: '12rem' }}>
          <TextField
            label={t('dishes.search')}
            value={search}
            placeholder={t('dishes.searchHint')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button onClick={onNewDish}>
          <Icon name="plus" />
          {t('dishes.newDish')}
        </Button>
      </Bar>
      {dishes.length === 0 ? <Muted>{t('dishes.noneYet')}</Muted> : null}
      {dishes.length > 0 ? (
        <div role="table" aria-label={t('dishes.yours')}>
          <Row $head $cols={cols} role="row">
            <span />
            <span role="columnheader">{t('dishes.dish')}</span>
            <span role="columnheader" className="num">
              {t('dishes.lastPrice')}
            </span>
            {showLastUsed ? (
              <span role="columnheader" className="num">
                {t('dishes.lastOn')}
              </span>
            ) : null}
            {onEdit ? <span /> : null}
          </Row>
          {shown.map((dish) => {
            const on = selected.includes(dish.id);
            const name = pickText(dish.name, lang);
            const size = pickText(dish.size, lang);
            return (
              <div key={dish.id}>
                <Row $cols={cols} role="row">
                  <Tick
                    type="checkbox"
                    checked={on}
                    disabled={!on && full}
                    aria-label={t('dishes.onMenuFor', { name })}
                    onChange={() => onToggle(dish)}
                  />
                  <span role="cell" className="name">
                    {name}
                    {size ? <span className="sub">{size}</span> : null}
                  </span>
                  <span role="cell" className="num">
                    {formatMoney(dish.priceCents, lang)}
                  </span>
                  {showLastUsed ? (
                    <span role="cell" className="num">
                      {dish.lastUsedAt ? formatDay(dish.lastUsedAt, lang) : '–'}
                    </span>
                  ) : null}
                  {onEdit ? (
                    <Pencil
                      type="button"
                      aria-label={t('dishes.edit', { name })}
                      onClick={() => onEdit(dish.id)}
                    >
                      <Icon name="pencil" />
                    </Pencil>
                  ) : null}
                </Row>
                {on && renderSelected ? renderSelected(dish) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
