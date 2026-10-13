import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuDishView } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { fieldControlStyle } from '../../ui/Field';
import { LIMIT_MAX, parsePriceInput, priceInputOf } from './itemForm';
import { AutoSaveStatus } from './AutoSaveStatus';
import { useAutoSave, type SaveResult } from './autoSave';
import { MENU_NS } from './i18n/register';
import { SwitchButton, saveResultOf, useRunOp, useSendOp } from './menuShared';
import type { MenuData } from './menuSlice';

// Prices & limits for this menu only: price, limit, chef and sold out per dish. Used by step 3 and
// by the live menu's third tab. Plan 072: a price or limit is saved ~1 s after the last edit
// (several edits together), the chef and sold-out switch at once.

/** The price / limit edits not saved yet, by menu item id. */
type Edits = Record<string, { priceCents?: number; limit?: number | null }>;

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
  edit,
  onEdit,
}: Readonly<{
  dish: MenuDishView;
  chefs: MenuData['chefs'];
  kitchen: string;
  lang: Language;
  /** What is waiting to be saved for this dish; it shows instead of the saved value. */
  edit: Edits[string] | undefined;
  onEdit: (id: string, change: Edits[string]) => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const shownPrice = edit?.priceCents ?? dish.priceCents;
  const shownLimit = edit?.limit === undefined ? (dish.limit ?? null) : edit.limit;
  const [price, setPrice] = useState(priceInputOf(shownPrice));
  const [limit, setLimit] = useState(shownLimit === null ? '' : String(shownLimit));
  const priceCents = parsePriceInput(price);
  const limitText = limit.trim();
  const limitValue = limitText === '' ? null : /^\d+$/.test(limitText) ? Number(limitText) : 0;
  const limitOk = limitValue === null || (limitValue >= 1 && limitValue <= LIMIT_MAX);
  const name = pickText(dish.name, lang);
  const size = pickText(dish.size, lang);

  const commitPrice = () => {
    if (priceCents !== null && priceCents !== shownPrice) onEdit(dish.id, { priceCents });
  };
  const commitLimit = () => {
    if (limitOk && limitValue !== shownLimit) onEdit(dish.id, { limit: limitValue });
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
  const sendOp = useSendOp();
  const saver = useAutoSave<Edits>(
    draftKey(currentSellerSlug(), 'menu-prices', data.view.menu.id),
    async (edits) => {
      // One request per changed dish, sent together; the first problem is the answer.
      const answers = await Promise.all(
        Object.entries(edits).map(async ([id, request]) =>
          saveResultOf(await sendOp({ kind: 'updateMenuDish', id, request })),
        ),
      );
      const failed = answers.filter(
        (answer): answer is Extract<SaveResult, { ok: false }> => !answer.ok,
      );
      return failed.find((answer) => answer.refused) ?? failed[0] ?? { ok: true };
    },
  );
  const onEdit = (id: string, change: Edits[string]) =>
    saver.update((previous) => ({ ...previous, [id]: { ...previous?.[id], ...change } }));
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
            key={`${dish.id}:${String(dish.priceCents)}:${String(dish.limit ?? '')}:${String(saver.state.revision)}`}
            dish={dish}
            chefs={data.chefs}
            kitchen={kitchen}
            lang={lang}
            edit={saver.state.pending?.[dish.id]}
            onEdit={onEdit}
          />
        ))}
      </div>
      <AutoSaveStatus state={saver.state} onRetry={saver.retry} />
      <Hint>{t('prices.hint')}</Hint>
    </div>
  );
}
