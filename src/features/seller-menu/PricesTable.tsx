import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuDishView } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { fieldControlStyle } from '../../ui/Field';
import { LIMIT_MAX, parsePriceInput, priceInputOf } from './itemForm';
import { MENU_NS } from './i18n/register';
import { SwitchButton, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';

// Prices & limits for this menu only: price, limit, chef and sold out per dish. Used by step 3 and
// by the live menu's third tab; every change is saved as you make it.

const Grid = styled.div<{ $head?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem 6rem 10rem 7.5rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $head, theme }) => ($head ? theme.c.muted : theme.c.text)};
  font-size: ${({ $head }) => ($head ? '0.8125rem' : '0.9375rem')};
  font-weight: ${({ $head }) => ($head ? 700 : 400)};

  .name {
    font-weight: 600;
  }
  .sub {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
`;
const Input = styled.input<{ $invalid: boolean }>`
  ${fieldControlStyle}
  font-variant-numeric: tabular-nums;
`;
const Select = styled.select<{ $invalid: boolean }>`
  ${fieldControlStyle}
`;
const Hint = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

function PriceRow({
  dish,
  chefs,
  kitchen,
  lang,
}: Readonly<{ dish: MenuDishView; chefs: MenuData['chefs']; kitchen: string; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const [price, setPrice] = useState(priceInputOf(dish.priceCents));
  const [limit, setLimit] = useState(dish.limit === undefined ? '' : String(dish.limit));
  const priceCents = parsePriceInput(price);
  const limitText = limit.trim();
  const limitValue = limitText === '' ? null : /^\d+$/.test(limitText) ? Number(limitText) : 0;
  const limitOk = limitValue === null || (limitValue >= 1 && limitValue <= LIMIT_MAX);
  const name = pickText(dish.name, lang);
  const size = pickText(dish.size, lang);

  const commitPrice = () => {
    if (priceCents !== null && priceCents !== dish.priceCents) {
      run({ kind: 'updateMenuDish', id: dish.id, request: { priceCents } });
    }
  };
  const commitLimit = () => {
    if (limitOk && limitValue !== (dish.limit ?? null)) {
      run({ kind: 'updateMenuDish', id: dish.id, request: { limit: limitValue } });
    }
  };
  return (
    <Grid role="row">
      <span role="cell" className="name">
        {name}
        {size ? <span className="sub">{size}</span> : null}
      </span>
      <span role="cell">
        <Input
          $invalid={priceCents === null}
          aria-invalid={priceCents === null}
          aria-label={t('prices.priceFor', { name })}
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          onBlur={commitPrice}
        />
      </span>
      <span role="cell">
        <Input
          $invalid={!limitOk}
          aria-invalid={!limitOk}
          aria-label={t('prices.limitFor', { name })}
          inputMode="numeric"
          placeholder={t('prices.none')}
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          onBlur={commitLimit}
        />
      </span>
      <span role="cell">
        <Select
          $invalid={false}
          aria-label={t('prices.chefFor', { name })}
          value={dish.chefId ?? ''}
          onChange={(event) =>
            run({
              kind: 'updateMenuDish',
              id: dish.id,
              request: { chefId: event.target.value === '' ? null : event.target.value },
            })
          }
        >
          <option value="">{kitchen}</option>
          {chefs.map((chef) => (
            <option key={chef.id} value={chef.id}>
              {chef.name}
            </option>
          ))}
        </Select>
      </span>
      <span role="cell">
        <SwitchButton
          type="button"
          role="switch"
          aria-checked={dish.manualSoldOut === true}
          aria-label={t('prices.soldOutFor', { name })}
          $on={dish.manualSoldOut === true}
          disabled={busy}
          onClick={() =>
            run({
              kind: 'updateMenuDish',
              id: dish.id,
              request: { soldOut: dish.manualSoldOut !== true },
            })
          }
        >
          <i />
          <span>{dish.manualSoldOut === true ? t('live.yes') : t('live.no')}</span>
        </SwitchButton>
      </span>
    </Grid>
  );
}

export function PricesTable({ data, lang }: Readonly<{ data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const kitchen = t('dish.wholeKitchen');
  return (
    <div>
      <div role="table" aria-label={t('prices.title')}>
        <Grid $head role="row">
          <span role="columnheader">{t('live.dish')}</span>
          <span role="columnheader">{t('live.price')}</span>
          <span role="columnheader">{t('live.limit')}</span>
          <span role="columnheader">{t('prices.chef')}</span>
          <span role="columnheader">{t('live.soldOut')}</span>
        </Grid>
        {data.view.dishes.map((dish) => (
          <PriceRow
            // The row's inputs start from the saved values again when the server's change.
            key={`${dish.id}:${String(dish.priceCents)}:${String(dish.limit ?? '')}`}
            dish={dish}
            chefs={data.chefs}
            kitchen={kitchen}
            lang={lang}
          />
        ))}
      </div>
      <Hint>{t('prices.hint')}</Hint>
    </div>
  );
}
