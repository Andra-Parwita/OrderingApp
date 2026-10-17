import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import type { Dish } from '../../../shared/menusContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon, Segmented, TextField, WarningDialog } from '../../ui';
import { DishPicker, Pencil } from './DishPicker';
import { AutoSaveStatus } from './AutoSaveStatus';
import { useAutoSave } from './autoSave';
import { MENU_NS } from './i18n/register';
import {
  AskDialog,
  ErrorText,
  GroupLabel,
  LinkButton,
  Muted,
  saveResultOf,
  useOpWatch,
  useRunOp,
  useSendOp,
} from './menuShared';
import type { MenuData } from './menuSlice';
import { matchPastDishes } from './pastMenus';
import { useSold } from './useSold';

// Step 1 and the Dishes tab: the reuse picker (Your dishes, Saved sets, Past menus), the list of
// what is on this menu, and "Save these as a set".

type Source = 'dishes' | 'sets' | 'past';

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 21rem;
  min-height: 0;

  @media (max-width: 56.25rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Left = styled.div`
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Right = styled.aside`
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;
const OnMenu = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;

  span:first-child {
    font-weight: 600;
  }
`;
const List = styled.ul`
  margin: ${({ theme }) => theme.spacing.md} 0;
  padding: 0;
  list-style: none;
`;
const Card = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  strong {
    display: block;
  }
`;
const Foot = styled.div`
  margin-top: auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
`;

export function DishesStep({
  data,
  lang,
  live,
  onEdit,
  onNewDish,
}: Readonly<{
  data: MenuData;
  lang: Language;
  /** A live menu: removing a dish somebody ordered warns first. */
  live: boolean;
  onEdit: (dishId: string) => void;
  onNewDish: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const [source, setSource] = useState<Source>('dishes');
  const [naming, setNaming] = useState(false);
  const [setName, setSetName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{
    id: string;
    dishId: string;
    name: string;
    sold: number;
  } | null>(null);
  const { sold } = useSold(live);
  const { view } = data;
  const serverIds = useMemo(
    () => view.dishes.flatMap((dish) => (dish.dishId ? [dish.dishId] : [])),
    [view.dishes],
  );
  // Plan 072: a tick shows at once and is saved ~1 s after the last one, in one request.
  const sendOp = useSendOp();
  const saver = useAutoSave<Array<string>>(
    draftKey(currentSellerSlug(), 'menu-dishes', view.menu.id),
    async (dishIds) => saveResultOf(await sendOp({ kind: 'updateMenu', request: { dishIds } })),
  );
  const { pending } = saver.state;
  const onMenuIds = pending ?? serverIds;
  const onMenu = useMemo(() => {
    if (pending === null) {
      return view.dishes.map((dish) => ({
        key: dish.id,
        dishId: dish.dishId,
        name: dish.name,
        priceCents: dish.priceCents,
      }));
    }
    return pending.flatMap((dishId) => {
      const item = view.dishes.find((candidate) => candidate.dishId === dishId);
      const dish = data.dishes.find((candidate) => candidate.id === dishId);
      const source = item ?? dish;
      return source
        ? [{ key: item?.id ?? dishId, dishId, name: source.name, priceCents: source.priceCents }]
        : [];
    });
  }, [pending, view.dishes, data.dishes]);
  const full = onMenuIds.length >= MAX_MENU_ITEMS;

  useOpWatch(['useSet', 'usePast', 'createSet'], {
    onDone: (result) => {
      if (result.kind === 'createSet') setNote(t('dishes.setSaved'));
      else if (result.kind === 'usePast' && (result.missing ?? 0) > 0) {
        setNote(t('dishes.pastMissing', { count: result.missing }));
      } else setNote(null);
    },
    onFail: (result) =>
      setNote(result.code === 'limit_reached' ? t('dishes.setsFull') : t('genericError')),
  });

  const toggle = (dish: Dish) => {
    saver.update((previous) => {
      const base = previous ?? serverIds;
      if (base.includes(dish.id)) return base.filter((id) => id !== dish.id);
      return base.length >= MAX_MENU_ITEMS ? base : [...base, dish.id];
    });
  };
  const removeItem = (id: string, dishId: string | undefined, name: string) => {
    const qty = sold.get(id) ?? 0;
    if (live && qty > 0) {
      setRemoving({ id, dishId: dishId ?? '', name, sold: qty });
      return;
    }
    dropItem(id, dishId);
  };
  const dropItem = (id: string, dishId: string | undefined) => {
    // An item whose library dish is gone has no id to keep or drop by; the others are listed.
    saver.update((previous) => (previous ?? serverIds).filter((candidate) => candidate !== dishId));
    void id;
  };

  const options = [
    { value: 'dishes' as const, label: `${t('dishes.yours')} ${String(data.dishes.length)}` },
    { value: 'sets' as const, label: `${t('dishes.sets')} ${String(data.sets.length)}` },
    { value: 'past' as const, label: `${t('dishes.past')} ${String(data.past.length)}` },
  ];

  return (
    <Layout>
      <Left>
        <Bar>
          <GroupLabel as="span">{t('dishes.startFrom')}</GroupLabel>
          <Segmented
            options={options}
            value={source}
            onChange={setSource}
            label={t('dishes.startFrom')}
          />
        </Bar>
        {source === 'dishes' ? (
          <>
            <DishPicker
              dishes={data.dishes}
              lang={lang}
              selected={onMenuIds}
              full={full}
              onToggle={toggle}
              onNewDish={onNewDish}
              onEdit={onEdit}
            />
          </>
        ) : null}
        {source === 'sets' ? (
          <div>
            {data.sets.length === 0 ? <Muted>{t('dishes.noSets')}</Muted> : null}
            {data.sets.map((set) => {
              const names = set.dishIds
                .map((id) => data.dishes.find((dish) => dish.id === id))
                .flatMap((dish) => (dish ? [pickText(dish.name, lang)] : []));
              return (
                <Card key={set.id}>
                  <div>
                    <strong>{set.name}</strong>
                    <Muted>{names.join(' · ')}</Muted>
                  </div>
                  <Button
                    disabled={busy || pending !== null}
                    onClick={() => run({ kind: 'useSet', setId: set.id })}
                  >
                    {t('dishes.addSet')}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : null}
        {source === 'past' ? (
          <div>
            {data.past.length === 0 ? <Muted>{t('past.empty')}</Muted> : null}
            {data.past.map((week) => {
              const { ids } = matchPastDishes(week.totals.items, data.dishes);
              return (
                <Card key={week.id}>
                  <div>
                    <strong>{formatDay(week.cookingDate, lang)}</strong>
                    <Muted>
                      {week.totals.items.map((item) => pickText(item.name, lang)).join(' · ')}
                    </Muted>
                  </div>
                  <Button
                    disabled={busy || pending !== null || ids.length === 0}
                    onClick={() => run({ kind: 'usePast', weekId: week.id })}
                  >
                    {t('dishes.addThese')}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : null}
        {full ? <Muted>{t('dishes.full', { max: MAX_MENU_ITEMS })}</Muted> : null}
        {note ? <Muted role="status">{note}</Muted> : null}
        {saver.state.removedWithOrders > 0 ? (
          <Muted role="status">
            {t('dishes.removedWithOrders', { count: saver.state.removedWithOrders })}
          </Muted>
        ) : null}
      </Left>
      <Right aria-label={t('dishes.onMenu')}>
        <div>
          <strong>{t('dishes.onMenu')}</strong>{' '}
          <Muted as="span">{t('dishes.count', { count: onMenu.length })}</Muted>
        </div>
        <AutoSaveStatus state={saver.state} onRetry={saver.retry} max={MAX_MENU_ITEMS} />
        {onMenu.length === 0 ? <Muted>{t('dishes.emptyMenu')}</Muted> : null}
        <List>
          {onMenu.map((dish) => {
            const name = pickText(dish.name, lang);
            return (
              <OnMenu key={dish.key}>
                <span>{name}</span>
                <span>{formatMoney(dish.priceCents, lang)}</span>
                <Pencil
                  type="button"
                  aria-label={t('dishes.remove', { name })}
                  disabled={!dish.dishId}
                  onClick={() => removeItem(dish.key, dish.dishId, name)}
                >
                  <Icon name="x" />
                </Pencil>
              </OnMenu>
            );
          })}
        </List>
        <Foot>
          <Muted>{t('dishes.pricesLater')}</Muted>
          <LinkButton
            disabled={onMenuIds.length === 0}
            onClick={() => {
              setSetName('');
              setNaming(true);
            }}
          >
            {t('dishes.saveSet')}
          </LinkButton>
        </Foot>
      </Right>
      {naming ? (
        <AskDialog
          title={t('dishes.saveSet')}
          confirmLabel={t('dishes.saveSetGo')}
          cancelLabel={t('cancel')}
          disabled={setName.trim() === ''}
          onCancel={() => setNaming(false)}
          onConfirm={() => {
            setNaming(false);
            run({ kind: 'createSet', name: setName.trim(), dishIds: onMenuIds });
          }}
        >
          <TextField
            label={t('dishes.setName')}
            value={setName}
            maxLength={40}
            onChange={(event) => setSetName(event.target.value)}
            data-autofocus
          />
          {data.sets.length >= 5 ? <ErrorText>{t('dishes.setsFull')}</ErrorText> : null}
        </AskDialog>
      ) : null}
      {removing ? (
        <WarningDialog
          title={t('dishes.removeTitle', { name: removing.name })}
          cancelLabel={t('dishes.keep')}
          continueLabel={t('dishes.removeAnyway')}
          onCancel={() => setRemoving(null)}
          onContinue={() => {
            const target = removing;
            setRemoving(null);
            dropItem(target.id, target.dishId);
          }}
        >
          {t('dishes.removeBody', { count: removing.sold, name: removing.name })}
        </WarningDialog>
      ) : null}
    </Layout>
  );
}
