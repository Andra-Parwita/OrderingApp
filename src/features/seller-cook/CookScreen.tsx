import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Icon, Segmented, Tooltip, type SegmentedOption } from '../../ui';
import { COOK_NS } from './i18n/register';
import type { CookGroup, CookRow, CountMode, GroupBy } from './cookModel';
import {
  selectCookGroups,
  selectCookList,
  selectCookMenu,
  selectCookNotes,
  selectCookStats,
} from './cookSelectors';
import { pollingStarted, pollingStopped, refreshRequested, type CookRootState } from './cookSlice';

const Page = styled.main<{ $desktop: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: ${({ $desktop }) => ($desktop ? 'none' : 'min(100%, 45rem)')};
  margin: 0 auto;
  padding: 0 ${({ theme, $desktop }) => ($desktop ? theme.spacing.lg : '0')};
  font-size: ${({ theme, $desktop }) => ($desktop ? theme.type.size.base : 'inherit')};
`;
const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 ${({ theme }) => theme.spacing.xl};
`;
const DesktopRowWrap = styled.li`
  display: grid;
  grid-template-columns: 5.25rem minmax(0, 22rem) minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  min-height: 5.25rem;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const BigQty = styled.span`
  font-size: ${({ theme }) => theme.type.size.xxl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  font-variant-numeric: tabular-nums;
  text-align: center;
`;
const NameBig = styled.span`
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
/** Who ordered: equal-width chips in columns, so the names line up (D-033). */
const WhoChips = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  list-style: none;
`;
const WhoItem = styled.li`
  min-width: 0;
`;
const WhoChip = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  font-size: ${({ theme }) => theme.type.size.sm};
  white-space: nowrap;

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.colour.surface};
  }
`;
const ChipName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ChipQty = styled.b`
  font-variant-numeric: tabular-nums;
`;

const Head = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
`;
const Title = styled.h1<{ $desktop: boolean }>`
  margin: 0;
  font-size: ${({ theme, $desktop }) => ($desktop ? theme.type.size.xl : theme.type.size.lg)};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const LiveText = styled.span<{ $ok: boolean }>`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme, $ok }) => ($ok ? theme.colour.accent : theme.status.cancelled.fg)};
  white-space: nowrap;
`;
const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;
const Label = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Scroll = styled.div`
  overflow-x: auto;
`;
const Stats = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Stat = styled.div`
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
`;
const StatName = styled.dt`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const StatValue = styled.dd`
  margin: 0;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  font-variant-numeric: tabular-nums;
`;
const GroupHead = styled.h2`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.regular};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const RowWrap = styled.li`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const RowMain = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Names = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;
const NameMain = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Qty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;
const QtyNumber = styled.span`
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Bar = styled.div`
  height: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  overflow: hidden;
`;
const BarFill = styled.div<{ $percent: number }>`
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: ${({ theme, $percent }) => ($percent >= 80 ? theme.colour.gold : theme.colour.sage)};
`;
const Toggle = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.colour.accent};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.sm};
  cursor: pointer;
`;
const WhoBox = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;
const Code = styled.span`
  font-family: ui-monospace, Consolas, monospace;
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const MODES: ReadonlyArray<CountMode> = ['all', 'confirmed'];
const GROUPS: ReadonlyArray<GroupBy> = ['item', 'chef', 'customer', 'fulfilment'];

/** The chips read "Rina × 2"; the full name shows on hover and focus when it is cut off. */
function WhoChipList({ who, label }: Readonly<{ who: CookRow['who']; label: string }>) {
  return (
    <WhoChips aria-label={label}>
      {who.map((entry) => (
        <WhoItem key={entry.code}>
          <Tooltip text={entry.firstName}>
            <WhoChip tabIndex={0}>
              <ChipName>{entry.firstName}</ChipName>
              <span>×</span>
              <ChipQty>{entry.qty}</ChipQty>
            </WhoChip>
          </Tooltip>
        </WhoItem>
      ))}
    </WhoChips>
  );
}

type RowProps = Readonly<{ row: CookRow; showWho: boolean; lang: Language }>;

const Row = memo(function Row({ row, showWho, lang }: RowProps) {
  const { t } = useTranslation(COOK_NS);
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  // The cook reads Indonesian first; the English name is the smaller line (D-012 menu names).
  const nameId = pickText(row.name, 'id');
  const nameEn = pickText(row.name, 'en');
  const percent =
    row.limit !== undefined && row.limit > 0 ? Math.min(100, (row.qty / row.limit) * 100) : null;
  return (
    <RowWrap>
      <RowMain>
        <Names>
          <NameMain>{nameId}</NameMain>
          {nameEn !== nameId ? <Muted>{nameEn}</Muted> : null}
        </Names>
        <Qty>
          <QtyNumber>{row.qty}</QtyNumber>
          <Muted>{pickText(row.size, lang)}</Muted>
          {/* The bar is decoration: the numbers carry the meaning. */}
          {row.limit !== undefined ? (
            <Muted>{t('ofLimit', { count: row.qty, limit: row.limit })}</Muted>
          ) : null}
        </Qty>
      </RowMain>
      {percent !== null ? (
        <Bar aria-hidden="true">
          <BarFill $percent={percent} />
        </Bar>
      ) : null}
      {showWho ? (
        <>
          <Toggle type="button" aria-expanded={open} onClick={toggle}>
            {t('who')} {open ? '▴' : '▾'}
          </Toggle>
          {open ? (
            <WhoBox>
              <WhoChipList who={row.who} label={t('who')} />
            </WhoBox>
          ) : null}
        </>
      ) : null}
    </RowWrap>
  );
});

/** Desktop: the quantity, the dish, and who ordered it with how many, all in view (A1-3). */
const DesktopRow = memo(function DesktopRow({ row, showWho, lang }: RowProps) {
  const { t } = useTranslation(COOK_NS);
  const nameId = pickText(row.name, 'id');
  const nameEn = pickText(row.name, 'en');
  const percent =
    row.limit !== undefined && row.limit > 0 ? Math.min(100, (row.qty / row.limit) * 100) : null;
  return (
    <DesktopRowWrap>
      <BigQty>{row.qty}</BigQty>
      <Names>
        <NameBig>{nameId}</NameBig>
        {nameEn !== nameId ? <Muted>{nameEn}</Muted> : null}
        <Muted>
          {pickText(row.size, lang)}
          {row.limit !== undefined
            ? ` · ${t('ofLimit', { count: row.qty, limit: row.limit })}`
            : ''}
        </Muted>
        {percent !== null ? (
          <Bar aria-hidden="true">
            <BarFill $percent={percent} />
          </Bar>
        ) : null}
      </Names>
      {showWho ? <WhoChipList who={row.who} label={t('who')} /> : <span />}
    </DesktopRowWrap>
  );
});

type GroupProps = Readonly<{
  group: CookGroup;
  showWho: boolean;
  lang: Language;
  desktop: boolean;
}>;

const Group = memo(function Group({ group, showWho, lang, desktop }: GroupProps) {
  const { t } = useTranslation(COOK_NS);
  const title = group.fulfilment ? t(`fulfilment.${group.fulfilment}`) : group.title;
  return (
    <section aria-label={title ?? undefined}>
      {title !== null ? (
        <GroupHead>
          <span>{title}</span>
          <Muted>{t('items', { count: group.rows.length })}</Muted>
        </GroupHead>
      ) : null}
      <List>
        {group.rows.map((row) =>
          desktop ? (
            <DesktopRow key={row.itemId} row={row} showWho={showWho} lang={lang} />
          ) : (
            <Row key={row.itemId} row={row} showWho={showWho} lang={lang} />
          ),
        )}
      </List>
    </section>
  );
});

/** S4. Route-agnostic: the app shell (4.4) puts it on a route and adds the tab bar. */
export function CookScreen({ desktop = false }: Readonly<{ desktop?: boolean }>) {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const [mode, setMode] = useState<CountMode>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('item');

  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  const list = useSelector(selectCookList);
  const menu = useSelector(selectCookMenu);
  const stats = useSelector((state: CookRootState) => selectCookStats(state, mode));
  const notes = useSelector((state: CookRootState) => selectCookNotes(state, mode));
  const groups = useSelector((state: CookRootState) => selectCookGroups(state, mode, groupBy));
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);
  const printList = useCallback(() => window.print(), []);

  const modeOptions: ReadonlyArray<SegmentedOption<CountMode>> = MODES.map((value) => ({
    value,
    label: t(`mode.${value}`),
  }));
  const groupOptions: ReadonlyArray<SegmentedOption<GroupBy>> = GROUPS.map((value) => ({
    value,
    label: t(`group.${value}`),
  }));
  const money = (cents: number) => formatMoney(cents, lang);
  const date = menu ? formatDay(menu.cookingDate, lang) : '';

  return (
    <Page $desktop={desktop}>
      <Head>
        <Title $desktop={desktop}>
          {menu ? t(desktop ? 'titleDesktop' : 'title', { date }) : t('titleBare')}
        </Title>
        {list.status === 'ready' ? (
          <LiveText $ok={list.live === 'ok'} role="status">
            {list.live === 'ok' ? t('live') : t('offline')}
          </LiveText>
        ) : null}
        {desktop ? (
          <Button variant="primary" onClick={printList}>
            <Icon name="print" />
            {t('print')}
          </Button>
        ) : null}
      </Head>

      <Controls>
        <Block>
          <Label>{t('group.label')}</Label>
          <Scroll>
            <Segmented
              options={groupOptions}
              value={groupBy}
              onChange={setGroupBy}
              label={t('group.label')}
            />
          </Scroll>
        </Block>
        <Block>
          <Label>{t('mode.label')}</Label>
          <Scroll>
            <Segmented
              options={modeOptions}
              value={mode}
              onChange={setMode}
              label={t('mode.label')}
            />
          </Scroll>
        </Block>
      </Controls>

      <Stats aria-label={t('stats.label')}>
        <Stat>
          <StatValue>{stats.orders}</StatValue>
          <StatName>{t('stats.orders')}</StatName>
        </Stat>
        <Stat>
          <StatValue>{money(stats.incomeCents)}</StatValue>
          <StatName>{t('stats.income')}</StatName>
        </Stat>
        <Stat>
          <StatValue>{money(stats.paidCents)}</StatValue>
          <StatName>{t('stats.paid')}</StatName>
        </Stat>
        <Stat>
          <StatValue>{money(stats.unpaidCents)}</StatValue>
          <StatName>{t('stats.unpaid')}</StatName>
        </Stat>
      </Stats>

      {list.status === 'loading' ? <Centered role="status">{t('loading')}</Centered> : null}
      {list.status === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {list.status === 'ready' && groups.length === 0 ? <Centered>{t('empty')}</Centered> : null}

      {groups.map((group) => (
        <Group
          key={group.key}
          group={group}
          showWho={desktop ? groupBy !== 'customer' : groupBy === 'item' || groupBy === 'chef'}
          lang={lang}
          desktop={desktop}
        />
      ))}

      {notes.length > 0 ? (
        <section aria-label={t('notes', { count: notes.length })}>
          <GroupHead>
            <span>{t('notes', { count: notes.length })}</span>
          </GroupHead>
          <List>
            {notes.map((note) => (
              <RowWrap key={note.code}>
                <Code>{note.code}</Code> <b>{note.firstName}</b>
                <div>“{note.note}”</div>
              </RowWrap>
            ))}
          </List>
        </section>
      ) : null}
    </Page>
  );
}
