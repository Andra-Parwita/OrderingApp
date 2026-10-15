import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, SellerMenuItemView, SellerOrder } from '../../../shared/domain';
import { daySalesToCsv } from '../../../shared/csv';
import { DAY_STOCK_MAX, type DaySaleEntry } from '../../../shared/daySalesContract';
import type { LiveEventType } from '../../../shared/liveContract';
import { pickText } from '../../../shared/text';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import { fetchDayLog, sellOnDay, setDayCount, undoDaySale } from '../../api/day';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Segmented, TextField, type SegmentedOption } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import { summarise } from './daySummary';
import { Muted, Notice, useLang } from './parts';
import { useLiveReload, type Wanted } from './useLiveReload';
import { TOP_BARS } from '../../theme/screen';

/** How long Undo stays on screen after a sale. */
export const UNDO_MS = 5000;

type Data = Readonly<{
  items: ReadonlyArray<SellerMenuItemView>;
  entries: ReadonlyArray<DaySaleEntry>;
  orders: ReadonlyArray<SellerOrder>;
}>;
type Load = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Data);
type Undo = Readonly<{ entryId: string; text: string }>;
type Tab = 'sell' | 'summary';

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadPhone}px;
  max-width: 40rem;
`;
const Title = styled.h1`
  margin: 0;
  font-size: 1.625rem;
`;
const Card = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Name = styled.span`
  font-weight: 700;
  font-size: 1.125rem;
`;
const Stock = styled.span`
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Big = styled(Button)`
  min-height: 4rem;
  font-size: 1.5rem;
`;
const Row = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const UndoBar = styled.div`
  position: sticky;
  top: ${TOP_BARS};
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.panel};
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs};
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    text-align: right;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
`;
const Section = styled.h2`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  font-size: 1.125rem;
`;
const Gone = styled.span`
  text-decoration: line-through;
`;

type Parts = Readonly<{ menu: boolean; log: boolean; orders: boolean }>;

/**
 * The menu (with the day stock), the day's log and the orders. Plan 074: no timer. It loads once,
 * then follows the live connection and fetches only what an event touched: a sale elsewhere
 * (`stock.changed`) reloads the stock, an order event the orders. The log and the orders only feed
 * the Summary tab, so on the Sell tab they are marked stale and fetched when Summary opens. This
 * device's own sale is applied from the POST answer and its echo (same device id) is ignored: no extra request.
 */
function useSellData(tab: Tab) {
  const slug = currentSellerSlug();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const alive = useRef(true);
  const ready = useRef(false);
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  const stale = useRef({ log: false, orders: false });

  const fetchParts = useCallback(
    async (parts: Parts) => {
      const [menu, log, orders] = await Promise.all([
        parts.menu ? fetchSellerMenu(undefined, slug) : null,
        parts.log ? fetchDayLog(slug) : null,
        parts.orders ? fetchSellerOrders(undefined, slug) : null,
      ]);
      if (!alive.current) return;
      if ((menu && !menu.ok) || (log && !log.ok)) {
        // A silent refresh that fails keeps what is already on screen.
        if (parts.log) stale.current.log = true;
        setLoad((current) => (current.status === 'ready' ? current : { status: 'error' }));
        return;
      }
      if (orders && !orders.ok) stale.current.orders = true;
      setLoad((current) => {
        if (current.status !== 'ready') {
          // Only a full load can start the screen.
          return menu?.ok && log?.ok
            ? {
                status: 'ready',
                items: menu.data.items,
                entries: log.data.entries,
                orders: orders?.ok ? orders.data.orders : [],
              }
            : current;
        }
        return {
          status: 'ready',
          items: menu?.ok ? menu.data.items : current.items,
          entries: log?.ok ? log.data.entries : current.entries,
          orders: orders?.ok ? orders.data.orders : current.orders,
        };
      });
      if (menu && log) ready.current = true;
    },
    [slug],
  );

  const loadFor = useCallback(
    async (wanted: Wanted) => {
      const all = wanted === null || !ready.current;
      const has = (type: LiveEventType) => wanted?.has(type) ?? false;
      const menu = all || has('menu.changed') || has('stock.changed');
      let log = all || has('menu.changed') || has('stock.changed');
      let orders = all || has('menu.changed') || has('order.created') || has('order.changed');
      // The Sell tab shows neither: mark them stale and fetch when Summary opens.
      if (!all && tabRef.current === 'sell') {
        stale.current.log ||= log;
        stale.current.orders ||= orders;
        log = false;
        orders = false;
      }
      if (log) stale.current.log = false;
      if (orders) stale.current.orders = false;
      if (menu || log || orders) await fetchParts({ menu, log, orders });
    },
    [fetchParts],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useLiveReload(loadFor);

  // Summary opens: fetch what went stale while the Sell tab was showing.
  useEffect(() => {
    if (tab !== 'summary' || !ready.current) return;
    const { log, orders } = stale.current;
    if (!log && !orders) return;
    stale.current = { log: false, orders: false };
    void fetchParts({ menu: false, log, orders });
  }, [tab, fetchParts]);

  /** This device's own change: the stock from the POST answer; the log goes stale (fetched at once on Summary). */
  const applied = useCallback(
    (itemId: string, dayStock: number) => {
      setLoad((current) =>
        current.status === 'ready'
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === itemId ? { ...item, dayStock } : item,
              ),
            }
          : current,
      );
      if (tabRef.current === 'summary') void fetchParts({ menu: false, log: true, orders: false });
      else stale.current.log = true;
    },
    [fetchParts],
  );
  const reloadMenu = useCallback(
    () => fetchParts({ menu: true, log: false, orders: false }),
    [fetchParts],
  );
  const reload = useCallback(
    () => fetchParts({ menu: true, log: true, orders: true }),
    [fetchParts],
  );
  return { load, reload, reloadMenu, applied };
}

const clock = (at: string, lang: Language) =>
  new Date(at).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

/** The Sell screen (plan 029 stages 4-5): record sales at the stall; the Summary tab ends the day. */
export function SellScreen({ canCorrect = false }: Readonly<{ canCorrect?: boolean }>) {
  const { t } = useTranslation(SATURDAY_NS);
  const lang = useLang();
  const slug = currentSellerSlug();
  const [tab, setTab] = useState<Tab>('sell');
  const { load, reload, reloadMenu, applied } = useSellData(tab);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    if (!undo) return undefined;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const nameOf = useCallback(
    (itemId: string) => {
      const item = load.status === 'ready' ? load.items.find((i) => i.id === itemId) : undefined;
      return item ? pickText(item.name, lang) : itemId;
    },
    [load, lang],
  );

  const sell = async (item: SellerMenuItemView, qty: number) => {
    setNote(null);
    const result = await sellOnDay({ itemId: item.id, qty }, slug);
    if (result.ok) {
      applied(item.id, result.data.dayStock);
      const entryId = result.data.entryId;
      if (entryId) {
        setUndo({ entryId, text: t('sell.sold', { count: qty, name: pickText(item.name, lang) }) });
      }
    } else {
      setNote(result.error === 'sold_out' ? t('sell.soldOutNote') : t('common.actionFailed'));
      // The stock on screen was out of date (or the call failed): ask for the truth.
      await reloadMenu();
    }
  };
  const setCount = async (item: SellerMenuItemView, count: number) => {
    setNote(null);
    const result = await setDayCount({ itemId: item.id, count }, slug);
    if (result.ok) applied(item.id, result.data.dayStock);
    else {
      setNote(t('common.actionFailed'));
      await reloadMenu();
    }
  };
  const reverse = async (entryId: string) => {
    setUndo(null);
    const result = await undoDaySale({ entryId }, slug);
    if (result.ok) {
      applied(result.data.itemId, result.data.dayStock);
      setNote(null);
    } else {
      setNote(t('sell.undoRefused'));
      await reloadMenu();
    }
  };

  const ready = load.status === 'ready' ? load : null;
  const dishes = useMemo(() => ready?.items.filter((i) => i.dayStock !== undefined) ?? [], [ready]);
  const summary = useMemo(
    () => (ready ? summarise(ready.items, ready.orders, ready.entries) : null),
    [ready],
  );
  const options: ReadonlyArray<SegmentedOption<Tab>> = [
    { value: 'sell', label: t('sell.tabSell') },
    { value: 'summary', label: t('sell.tabSummary') },
  ];
  const parsed = (id: string): number | null => {
    const text = (numbers[id] ?? '').trim();
    return /^\d{1,4}$/.test(text) && Number(text) <= DAY_STOCK_MAX ? Number(text) : null;
  };

  const download = () => {
    if (!ready) return;
    const blob = new Blob([daySalesToCsv(ready.entries, nameOf)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `day-sales-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <Title>{t('sell.title')}</Title>
      <Segmented options={options} value={tab} onChange={setTab} label={t('sell.tabsLabel')} />
      {undo ? (
        <UndoBar role="status">
          <span>{undo.text}</span>
          <Button variant="secondary" onClick={() => void reverse(undo.entryId)}>
            {t('sell.undo')}
          </Button>
        </UndoBar>
      ) : null}
      {note ? (
        <Notice $bad role="alert">
          {note}
        </Notice>
      ) : null}
      {load.status === 'loading' ? <Muted>{t('common.loading')}</Muted> : null}
      {load.status === 'error' ? (
        <Notice $bad>
          {t('common.loadError')}{' '}
          <Button variant="quiet" onClick={() => void reload()}>
            {t('common.retry')}
          </Button>
        </Notice>
      ) : null}
      {ready && tab === 'sell' ? (
        dishes.length === 0 ? (
          <Muted>{t('sell.none')}</Muted>
        ) : (
          <List aria-label={t('sell.title')}>
            {dishes.map((item) => {
              const name = pickText(item.name, lang);
              const stock = item.dayStock ?? 0;
              const n = parsed(item.id);
              return (
                <Card key={item.id} data-testid={`sell-${item.id}`}>
                  <Head>
                    <Name>{name}</Name>
                    <Stock aria-label={t('sell.left', { name })}>{stock}</Stock>
                  </Head>
                  {stock === 0 ? <Muted>{t('sell.soldOut')}</Muted> : null}
                  <Big
                    disabled={stock < 1}
                    onClick={() => void sell(item, 1)}
                    aria-label={t('sell.minusOne', { name })}
                  >
                    −1
                  </Big>
                  <Row>
                    <TextField
                      label={t('sell.number')}
                      value={numbers[item.id] ?? ''}
                      inputMode="numeric"
                      onChange={(event) =>
                        setNumbers((previous) => ({ ...previous, [item.id]: event.target.value }))
                      }
                    />
                    <Button
                      variant="secondary"
                      disabled={n === null || n < 1 || n > stock}
                      onClick={() => n !== null && void sell(item, n)}
                      aria-label={t('sell.minusN', { name })}
                    >
                      −n
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={n === null}
                      onClick={() => n !== null && void setCount(item, n)}
                      aria-label={t('sell.setCountFor', { name })}
                    >
                      {t('sell.setCount')}
                    </Button>
                  </Row>
                </Card>
              );
            })}
          </List>
        )
      ) : null}
      {ready && summary && tab === 'summary' ? (
        <>
          <Section>{t('sell.byDish')}</Section>
          <Table>
            <thead>
              <tr>
                <th>{t('sell.dish')}</th>
                <th>{t('sell.preordered')}</th>
                <th>{t('sell.soldOnDay')}</th>
                <th>{t('sell.leftCol')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.dishes.map((row) => (
                <tr key={row.itemId}>
                  <td>{nameOf(row.itemId)}</td>
                  <td>{row.preordered}</td>
                  <td>{row.soldOnDay}</td>
                  <td>{row.left}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Muted>{t('sell.totalSold', { count: summary.totalSold })}</Muted>
          <Section>{t('sell.byPerson')}</Section>
          {summary.people.length === 0 ? (
            <Muted>{t('sell.noSales')}</Muted>
          ) : (
            <Table>
              <tbody>
                {summary.people.map((person) => (
                  <tr key={person.name}>
                    <td>{person.name}</td>
                    <td>{t('sell.portions', { count: person.portions })}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Section>{t('sell.log')}</Section>
          <Row>
            <Button variant="secondary" onClick={download} disabled={ready.entries.length === 0}>
              {t('sell.csv')}
            </Button>
          </Row>
          <Table>
            <tbody>
              {ready.entries.map((entry) => {
                const text = `${clock(entry.at, lang)} · ${entry.by} · ${t(`sell.kind.${entry.kind}`)} · ${nameOf(entry.itemId)}`;
                return (
                  <tr key={entry.id}>
                    <td>{entry.undone ? <Gone>{text}</Gone> : text}</td>
                    <td>{entry.change > 0 ? `+${String(entry.change)}` : entry.change}</td>
                    <td>
                      {canCorrect && entry.kind === 'sale' && !entry.undone ? (
                        <Button
                          variant="quiet"
                          onClick={() => void reverse(entry.id)}
                          aria-label={t('sell.undoEntry', { text })}
                        >
                          {t('sell.undo')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      ) : null}
    </Page>
  );
}
