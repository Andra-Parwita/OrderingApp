import { useCallback, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Chef, Language, SellerMenuItemView } from '../../../shared/domain';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Pill, Table, TableCell, TableRow, type TableColumn } from '../../ui';
import { MENU_NS } from './i18n/register';
import {
  Actions,
  ErrorText,
  Head,
  Muted,
  Page,
  selectMenu,
  Title,
  TitleRow,
  useLang,
  useMenuData,
  useOpWatch,
} from './menuShared';
import { opRequested } from './menuSlice';

export type MenuScreenProps = Readonly<{
  /** True at 1024 px and up: items show as a table. */
  desktop?: boolean;
  /** Opens the customer preview (the app implements it). */
  onPreview: () => void;
  /** Opens the item editor; `null` adds a new item. */
  onEditItem: (itemId: string | null) => void;
  onSavedSets: () => void;
  onPastePost: () => void;
}>;

const Secondary = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Row = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const RowMain = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;
const Names = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Meta = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Moves = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Stack = styled.span`
  display: flex;
  flex-direction: column;
`;
const Sub = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const MovePair = styled.span<{ $stacked: boolean }>`
  display: inline-flex;
  flex-direction: ${({ $stacked }) => ($stacked ? 'column' : 'row')};
  gap: ${({ theme }) => theme.spacing.xs};
`;

const NAME_MIN_WIDTH = '12rem';
const WATCHED = ['publish', 'unpublish', 'reorder'] as const;

/** The two names, Indonesian first (the cook list language); one line when only one is filled. */
function nameLines(item: SellerMenuItemView): [string, string] {
  const first = item.name.id.trim() !== '' ? item.name.id : item.name.en;
  const second = item.name.en.trim() !== '' && item.name.en !== first ? item.name.en : '';
  return [first, second];
}

function chefName(chefs: ReadonlyArray<Chef>, id: string | undefined): string {
  return chefs.find((chef) => chef.id === id)?.name ?? '';
}

export function MenuScreen({
  desktop = false,
  onPreview,
  onEditItem,
  onSavedSets,
  onPastePost,
}: MenuScreenProps) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const { busy } = useSelector(selectMenu);
  const { data, status } = useMenuData();
  const outcome = useOpWatch(WATCHED);

  const move = useCallback(
    (index: number, by: -1 | 1) => {
      if (!data) return;
      const ids = data.items.map((item) => item.id);
      const [moved] = ids.splice(index, 1);
      if (moved === undefined) return;
      ids.splice(index + by, 0, moved);
      dispatch(opRequested({ kind: 'reorder', ids }));
    },
    [data, dispatch],
  );

  if (!data) {
    return (
      <Page $wide={desktop}>
        <Title $big={desktop}>{t('menu.titleBare')}</Title>
        {status}
      </Page>
    );
  }
  const { week, items, chefs } = data;
  const published = week.status === 'published';
  const full = items.length >= MAX_MENU_ITEMS;
  const failure = outcome?.status === 'failed' ? outcome : null;
  const failureText =
    failure?.kind === 'publish' && failure.code === 'no_items'
      ? t('menu.noItems')
      : failure
        ? t('genericError')
        : null;

  return (
    <Page $wide={desktop}>
      <Head>
        <TitleRow>
          <Title $big={desktop}>
            {t('menu.title', { date: formatDay(week.cookingDate, lang) })}
          </Title>
          <Pill tone={published ? 'confirmed' : 'ordered'}>
            {t(published ? 'menu.status.published' : 'menu.status.draft')}
          </Pill>
        </TitleRow>
        <Actions>
          <Button onClick={onPreview}>{t('menu.preview')}</Button>
          {published ? (
            <Button disabled={busy} onClick={() => dispatch(opRequested({ kind: 'unpublish' }))}>
              {t('menu.unpublish')}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy || items.length === 0}
              aria-describedby={items.length === 0 ? 'menu-publish-reason' : undefined}
              onClick={() => dispatch(opRequested({ kind: 'publish' }))}
            >
              {t('menu.publish')}
            </Button>
          )}
        </Actions>
      </Head>
      {items.length === 0 && !published ? (
        <Muted id="menu-publish-reason">{t('menu.publishNeedsItems')}</Muted>
      ) : null}
      {failureText ? <ErrorText role="alert">{failureText}</ErrorText> : null}

      {items.length === 0 ? (
        <Muted>{t('menu.empty')}</Muted>
      ) : desktop ? (
        <ItemsTable
          items={items}
          chefs={chefs}
          lang={lang}
          busy={busy}
          onEditItem={onEditItem}
          onMove={move}
        />
      ) : (
        <ItemsList
          items={items}
          chefs={chefs}
          lang={lang}
          busy={busy}
          onEditItem={onEditItem}
          onMove={move}
        />
      )}

      <Secondary>
        <Button variant="primary" disabled={full} onClick={() => onEditItem(null)}>
          {t('menu.addItem')}
        </Button>
        {full ? <Muted>{t('menu.maxItems', { max: MAX_MENU_ITEMS })}</Muted> : null}
      </Secondary>
      <Secondary>
        <Button onClick={onSavedSets}>{t('menu.savedSets')}</Button>
        <Button onClick={onPastePost}>{t('menu.paste')}</Button>
      </Secondary>
    </Page>
  );
}

type ItemsProps = Readonly<{
  items: ReadonlyArray<SellerMenuItemView>;
  chefs: ReadonlyArray<Chef>;
  lang: Language;
  busy: boolean;
  onEditItem: (itemId: string) => void;
  onMove: (index: number, by: -1 | 1) => void;
}>;

function MoveButtons({
  item,
  index,
  count,
  busy,
  stacked,
  onMove,
}: Readonly<{
  stacked: boolean;
  item: SellerMenuItemView;
  index: number;
  count: number;
  busy: boolean;
  onMove: ItemsProps['onMove'];
}>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const name = pickText(item.name, lang);
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    // The row opens the editor on a click; these buttons must not.
    <span onClick={stop} onKeyDown={(event) => event.stopPropagation()} role="presentation">
      <MovePair $stacked={stacked}>
        <Button
          disabled={busy || index === 0}
          aria-label={t('menu.moveUp', { name })}
          onClick={() => onMove(index, -1)}
        >
          <span aria-hidden="true">↑</span> {t('menu.up')}
        </Button>
        <Button
          disabled={busy || index === count - 1}
          aria-label={t('menu.moveDown', { name })}
          onClick={() => onMove(index, 1)}
        >
          <span aria-hidden="true">↓</span> {t('menu.down')}
        </Button>
      </MovePair>
    </span>
  );
}

function ItemsTable({ items, chefs, lang, busy, onEditItem, onMove }: ItemsProps) {
  const { t } = useTranslation(MENU_NS);
  const columns: Array<TableColumn> = [
    { id: 'num', header: t('menu.col.num') },
    { id: 'name', header: t('menu.col.name'), width: '100%' },
    { id: 'size', header: t('menu.col.size') },
    { id: 'price', header: t('menu.col.price'), align: 'end' },
    { id: 'limit', header: t('menu.col.limit'), align: 'end' },
    { id: 'chef', header: t('menu.col.chef') },
    { id: 'soldOut', header: t('menu.col.soldOut') },
    { id: 'order', header: t('menu.col.order') },
  ];
  return (
    <Table label={t('menu.tableLabel')} columns={columns}>
      {items.map((item, index) => {
        const [first, second] = nameLines(item);
        return (
          <TableRow key={item.id} rowId={item.id} onOpen={onEditItem}>
            <TableCell>{index + 1}</TableCell>
            <TableCell wrap minWidth={NAME_MIN_WIDTH} strong>
              <Stack>
                <span>{first}</span>
                {second ? <Sub>{second}</Sub> : null}
              </Stack>
            </TableCell>
            <TableCell wrap>{pickText(item.size, lang)}</TableCell>
            <TableCell align="end">{formatMoney(item.priceCents, lang)}</TableCell>
            <TableCell align="end">{item.limit ?? '—'}</TableCell>
            <TableCell>{chefName(chefs, item.chefId) || '—'}</TableCell>
            <TableCell>
              {item.soldOut ? <Pill tone="cancelled">{t('menu.soldOut')}</Pill> : '—'}
            </TableCell>
            <TableCell>
              <MoveButtons
                item={item}
                index={index}
                count={items.length}
                busy={busy}
                stacked={false}
                onMove={onMove}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
}

function ItemsList({ items, chefs, lang, busy, onEditItem, onMove }: ItemsProps) {
  const { t } = useTranslation(MENU_NS);
  return (
    <List aria-label={t('menu.listLabel')}>
      {items.map((item, index) => {
        const [first, second] = nameLines(item);
        const chef = chefName(chefs, item.chefId);
        const size = pickText(item.size, lang);
        const meta = [
          size,
          formatMoney(item.priceCents, lang),
          item.limit !== undefined ? t('menu.limitLabel', { n: item.limit }) : '',
          chef,
        ].filter((part) => part !== '');
        return (
          <Row key={item.id}>
            <RowMain
              type="button"
              aria-label={t('menu.edit', { name: pickText(item.name, lang) })}
              onClick={() => onEditItem(item.id)}
            >
              <Names>
                {index + 1}. {first}
                {second ? ` / ${second}` : ''}
              </Names>
              <Meta>{meta.join(' · ')}</Meta>
              {item.soldOut ? <Pill tone="cancelled">{t('menu.soldOut')}</Pill> : null}
            </RowMain>
            <Moves>
              <MoveButtons
                item={item}
                index={index}
                count={items.length}
                busy={busy}
                stacked
                onMove={onMove}
              />
            </Moves>
          </Row>
        );
      })}
    </List>
  );
}
