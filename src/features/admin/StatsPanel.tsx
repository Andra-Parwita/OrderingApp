// Plan 121 B: "Statistics" (admin only). Per kitchen, the last 8 weeks of anonymous counts: where the
// order was placed, the phone's system, and how many had notifications and Remember me on. Counts
// only: no order, name or code is ever shown.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { STATS_WEEKS, type StatsKitchen, type StatsResponse } from '../../../shared/orderStats';
import type { ApiFailure } from '../../api/http';
import { fetchStats } from '../../api/stats';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { Message, Muted, Section, Sub } from './shared';

const Kitchen = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  align-self: stretch;
  min-width: 0;
`;
const KitchenName = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
`;
// Narrow screens scroll the table, never the page.
const Scroll = styled.div`
  overflow-x: auto;
`;
const Table = styled.table`
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  th,
  td {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    text-align: end;
    border-bottom: ${({ theme }) => theme.border.hairline} solid
      ${({ theme }) => theme.colour.hairline};
  }
  th {
    color: ${({ theme }) => theme.colour.textMuted};
    font-weight: ${({ theme }) => theme.type.weight.regular};
  }
  th:first-child,
  td:first-child {
    text-align: start;
  }
  tbody th {
    color: ${({ theme }) => theme.colour.text};
  }
`;

/** "67%" of the orders that said on or off; a dash when none said. */
function percent(on: number, off: number): string {
  const known = on + off;
  return known === 0 ? '–' : `${String(Math.round((on / known) * 100))}%`;
}

function KitchenTable({ kitchen, lang }: Readonly<{ kitchen: StatsKitchen; lang: Language }>) {
  const { t } = useTranslation(ADMIN_NS);
  return (
    <Kitchen>
      <KitchenName>{kitchen.name}</KitchenName>
      {kitchen.weeks.length === 0 ? (
        <Muted>{t('home.stats.none', { count: STATS_WEEKS })}</Muted>
      ) : (
        <Scroll>
          <Table aria-label={t('home.stats.tableLabel', { name: kitchen.name })}>
            <thead>
              <tr>
                <th scope="col">{t('home.stats.week')}</th>
                <th scope="col">{t('home.stats.app')}</th>
                <th scope="col">{t('home.stats.browser')}</th>
                <th scope="col">{t('home.stats.inapp')}</th>
                <th scope="col">{t('home.stats.ios')}</th>
                <th scope="col">{t('home.stats.android')}</th>
                <th scope="col">{t('home.stats.other')}</th>
                <th scope="col">{t('home.stats.push')}</th>
                <th scope="col">{t('home.stats.remember')}</th>
                <th scope="col">{t('home.stats.orders')}</th>
              </tr>
            </thead>
            <tbody>
              {kitchen.weeks.map((w) => (
                <tr key={w.week}>
                  <th scope="row">{formatDay(w.week, lang)}</th>
                  <td>{w.place.app}</td>
                  <td>{w.place.browser}</td>
                  <td>{w.place.inapp}</td>
                  <td>{w.os.ios}</td>
                  <td>{w.os.android}</td>
                  <td>{w.os.other}</td>
                  <td>{percent(w.push.on, w.push.off)}</td>
                  <td>{percent(w.remember.on, w.remember.off)}</td>
                  <td>{w.orders}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Scroll>
      )}
    </Kitchen>
  );
}

/** The Statistics section: a compact table per kitchen. */
export function StatsPanel({
  refused,
  refreshKey = 0,
}: Readonly<{ refused: (failure: ApiFailure) => string; refreshKey?: number }>) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchStats();
    if (!result.ok) {
      setProblem(refused(result));
      return;
    }
    setProblem(null);
    setStats(result.data);
  }, [refused]);

  useEffect(() => {
    // A call that sets state after a network round trip, started on mount and on Refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  return (
    <Section>
      <Sub>{t('home.stats.title')}</Sub>
      <Muted>{t('home.stats.text', { count: STATS_WEEKS })}</Muted>
      {problem ? (
        <>
          <Message $bad role="alert">
            {problem}
          </Message>
          <Button type="button" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </>
      ) : null}
      {stats === null && !problem ? <Muted>{t('loading')}</Muted> : null}
      {stats?.kitchens.map((kitchen) => (
        <KitchenTable key={kitchen.sellerId} kitchen={kitchen} lang={lang} />
      ))}
      {stats ? <Muted>{t('home.stats.note')}</Muted> : null}
    </Section>
  );
}
