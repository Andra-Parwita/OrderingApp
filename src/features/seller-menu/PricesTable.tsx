import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuDishView } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { Segmented } from '../../ui';
import { fieldControlStyle } from '../../ui/Field';
import { DAY_STOCK_MAX } from '../../../shared/daySalesContract';
import { LIMIT_MAX, parsePriceInput, priceInputOf } from './itemForm';
import { AutoSaveStatus } from './AutoSaveStatus';
import { useAutoSave, type SaveResult } from './autoSave';
import { MENU_NS } from './i18n/register';
import { ErrorText, SwitchButton, saveResultOf, useRunOp, useSendOp } from './menuShared';
import type { MenuData } from './menuSlice';
import { useMarks, useSession } from './sessionIntercept';
import { ChangeMark } from './SessionMarks';

// Prices & limits for this menu only: price, limit, chef and sold out per dish. Used by step 3 and
// by the live menu's third tab. Plan 072: a price or limit is saved ~1 s after the last edit
// (several edits together), the chef and sold-out switch at once.

/** The price / limit edits not saved yet, by menu item id. */
type Edits = Record<
  string,
  { priceCents?: number; limit?: number | null; preorder?: boolean; dayStock?: number | null }
>;
type SellAs = 'pre' | 'day' | 'both';
/** Portions offered when the seller first picks On the day or Both. */
const FIRST_PORTIONS = 10;

const Grid = styled.div<{ $head?: boolean; $changed?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem 6rem 10rem 7.5rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ $changed, theme }) => ($changed ? theme.c.warnTint : 'transparent')};
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
  .sell {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    padding-bottom: ${({ theme }) => theme.spacing.sm};
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.c.muted};
  }
  .sell input {
    width: 5rem;
  }
  /* A phone: the name on a line of its own, then price and limit, then chef and sold out. */
  @media (max-width: 40rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: ${({ theme }) => theme.spacing.sm} 0;

    .name {
      grid-column: 1 / -1;
    }
    ${({ $head }) => ($head ? 'display: none;' : '')}
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
  mark,
  onEdit,
}: Readonly<{
  dish: MenuDishView;
  chefs: MenuData['chefs'];
  kitchen: string;
  lang: Language;
  /** What is waiting to be saved for this dish; it shows instead of the saved value. */
  edit: Edits[string] | undefined;
  mark: 'added' | 'edited' | null;
  onEdit: (id: string, change: Edits[string]) => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const sendOp = useSendOp();
  // Plan 103: the chef shows at once; a refusal puts the old one back and says so.
  const [pickedChef, setPickedChef] = useState<string | null>(null);
  const [chefFailed, setChefFailed] = useState(false);
  const shownPrice = edit?.priceCents ?? dish.priceCents;
  const shownLimit = edit?.limit === undefined ? (dish.limit ?? null) : edit.limit;
  const [price, setPrice] = useState(priceInputOf(shownPrice));
  const [limit, setLimit] = useState(shownLimit === null ? '' : String(shownLimit));
  const priceCents = parsePriceInput(price);
  const limitText = limit.trim();
  const limitValue = limitText === '' ? null : /^\d+$/.test(limitText) ? Number(limitText) : 0;
  const limitOk = limitValue === null || (limitValue >= 1 && limitValue <= LIMIT_MAX);
  const shownPreorder = edit?.preorder ?? dish.preorder ?? true;
  const shownStock = edit?.dayStock === undefined ? (dish.dayStock ?? null) : edit.dayStock;
  const sellAs: SellAs = !shownPreorder ? 'day' : shownStock === null ? 'pre' : 'both';
  const [portions, setPortions] = useState(shownStock === null ? '' : String(shownStock));
  const portionsOk = /^\d{1,4}$/.test(portions.trim()) && Number(portions) <= DAY_STOCK_MAX;
  const name = pickText(dish.name, lang);
  const size = pickText(dish.size, lang);

  const commitPrice = () => {
    if (priceCents !== null && priceCents !== shownPrice) onEdit(dish.id, { priceCents });
  };
  const commitLimit = () => {
    if (limitOk && limitValue !== shownLimit) onEdit(dish.id, { limit: limitValue });
  };
  const pickSellAs = (next: SellAs) => {
    if (next === 'pre') {
      onEdit(dish.id, { preorder: true, dayStock: null });
      return;
    }
    const stock = portionsOk ? Number(portions) : (shownStock ?? FIRST_PORTIONS);
    setPortions(String(stock));
    onEdit(dish.id, { preorder: next === 'both', dayStock: stock });
  };
  const commitPortions = () => {
    if (sellAs !== 'pre' && portionsOk && Number(portions) !== shownStock) {
      onEdit(dish.id, { dayStock: Number(portions) });
    }
  };
  return (
    <Grid role="row" $changed={mark !== null}>
      <span role="cell" className="name">
        {name}
        {mark ? <ChangeMark kind={mark} /> : null}
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
          value={pickedChef ?? dish.chefId ?? ''}
          onChange={(event) => {
            const chosen = event.target.value;
            setPickedChef(chosen);
            setChefFailed(false);
            void sendOp({
              kind: 'updateMenuDish',
              id: dish.id,
              request: { chefId: chosen === '' ? null : chosen },
            }).then((answer) => {
              setChefFailed(!answer.ok);
              setPickedChef(null);
            });
          }}
        >
          <option value="">{kitchen}</option>
          {chefs.map((chef) => (
            <option key={chef.id} value={chef.id}>
              {chef.name}
            </option>
          ))}
        </Select>
        {chefFailed ? <ErrorText role="alert">{t('genericError')}</ErrorText> : null}
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
      <span role="cell" className="sell">
        <Segmented<SellAs>
          compact
          label={t('prices.sellAsFor', { name })}
          value={sellAs}
          onChange={pickSellAs}
          options={[
            { value: 'pre', label: t('prices.asPre') },
            { value: 'day', label: t('prices.asDay') },
            { value: 'both', label: t('prices.asBoth') },
          ]}
        />
        {sellAs === 'pre' ? null : (
          <>
            <span>{t('dish.dayStock')}</span>
            <Input
              $invalid={!portionsOk}
              aria-invalid={!portionsOk}
              aria-label={t('prices.portionsFor', { name })}
              inputMode="numeric"
              value={portions}
              onChange={(event) => setPortions(event.target.value)}
              onBlur={commitPortions}
            />
          </>
        )}
      </span>
    </Grid>
  );
}

export function PricesTable({ data, lang }: Readonly<{ data: MenuData; lang: Language }>) {
  const { t } = useTranslation(MENU_NS);
  const kitchen = t('dish.wholeKitchen');
  const sendOp = useSendOp();
  const session = useSession();
  const marks = useMarks();
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
    session ? 0 : undefined,
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
            key={`${dish.id}:${String(dish.priceCents)}:${String(dish.limit ?? '')}:${String(dish.preorder ?? true)}:${String(dish.dayStock ?? '')}:${String(saver.state.revision)}`}
            dish={dish}
            chefs={data.chefs}
            kitchen={kitchen}
            lang={lang}
            edit={saver.state.pending?.[dish.id]}
            mark={
              !marks
                ? null
                : dish.dishId && marks.added.includes(dish.dishId)
                  ? 'added'
                  : marks.edited[dish.id]
                    ? 'edited'
                    : null
            }
            onEdit={onEdit}
          />
        ))}
      </div>
      <AutoSaveStatus state={saver.state} onRetry={saver.retry} />
      <Hint>{t('prices.hint')}</Hint>
    </div>
  );
}
