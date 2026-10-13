import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { ChefSummaryResponse } from '../../../shared/chefSummaryContract';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchChefSummary } from '../../api/chefSummary';
import { useMediaQuery } from '../useMediaQuery';
import { Button, SlideOver } from '../../ui';
import { useIncomeAccess } from './access';
import { INCOME_NS, registerChefIncomeI18n } from './i18n/register';

// Plan 069: one "Per chef" button (a chef: "My income") and the panel it opens. The panel asks the
// server for the figures when it opens, one call, and shows them as a small table.

const Wrap = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
`;
const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-size: 1.125rem;
  font-weight: 700;
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Scroll = styled.div`
  overflow-x: auto;
`;
const Grid = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs};
    border-bottom: ${({ theme }) => theme.border.hairline} solid
      ${({ theme }) => theme.colour.hairline};
    text-align: right;
    white-space: nowrap;
  }
  th:first-child,
  td:first-child {
    text-align: left;
    white-space: normal;
  }
  th {
    color: ${({ theme }) => theme.colour.textMuted};
    font-size: 0.8125rem;
    font-weight: 600;
  }
  tbody th {
    color: ${({ theme }) => theme.colour.text};
    font-size: 0.875rem;
  }
  tfoot th,
  tfoot td {
    font-weight: 700;
  }
`;

type Load =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' | 'forbidden' | 'notKept' }>
  | Readonly<{ status: 'ready'; data: ChefSummaryResponse }>;

function useLanguage(): Language {
  const { i18n } = useTranslation(INCOME_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

function Figures({ data, lang }: Readonly<{ data: ChefSummaryResponse; lang: Language }>) {
  const { t } = useTranslation(INCOME_NS);
  const money = (cents: number) => formatMoney(cents, lang);
  const only = (cents: number) => (cents > 0 ? money(cents) : t('noValue'));
  if (data.rows.length === 0) return <Muted>{t('empty')}</Muted>;
  return (
    <Scroll>
      <Grid>
        <thead>
          <tr>
            <th scope="col">{t('chef')}</th>
            <th scope="col">{t('portions')}</th>
            <th scope="col">{t('preOrders')}</th>
            <th scope="col">{t('stall')}</th>
            <th scope="col">{t('income')}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.chefId ?? 'kitchen'}>
              <th scope="row">{row.name ?? t('wholeKitchen')}</th>
              <td>{row.portions}</td>
              <td>{only(row.preOrderCents)}</td>
              <td>{only(row.stallCents)}</td>
              <td>{money(row.incomeCents)}</td>
            </tr>
          ))}
        </tbody>
        {data.rows.length > 1 ? (
          <tfoot>
            <tr>
              <th scope="row">{t('total')}</th>
              <td>{data.totalPortions}</td>
              <td />
              <td />
              <td>{money(data.totalCents)}</td>
            </tr>
          </tfoot>
        ) : null}
      </Grid>
    </Scroll>
  );
}

function ChefIncomePanel({
  menuId,
  own,
  onClose,
}: Readonly<{ menuId: string; own: boolean; onClose: () => void }>) {
  const { t } = useTranslation(INCOME_NS);
  const lang = useLanguage();
  const tablet = useMediaQuery('(min-width: 768px)');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void fetchChefSummary(menuId, currentSellerSlug()).then((result) => {
      if (!live) return;
      if (result.ok) setLoad({ status: 'ready', data: result.data });
      else if (result.status === 403) setLoad({ status: 'forbidden' });
      else if (result.status === 404) setLoad({ status: 'notKept' });
      else setLoad({ status: 'error' });
    });
    return () => {
      live = false;
    };
  }, [menuId, attempt]);
  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const date = load.status === 'ready' ? formatDay(load.data.cookingDate, lang) : '';
  return (
    <SlideOver
      label={t('label')}
      closeLabel={t('close')}
      onClose={onClose}
      width={tablet ? '38rem' : '100%'}
    >
      <Wrap>
        <Title>{own ? t('titleOwn', { date }) : t('title', { date })}</Title>
        {load.status === 'loading' ? <Muted role="status">{t('loading')}</Muted> : null}
        {load.status === 'error' ? (
          <div role="alert">
            <Muted>{t('error')}</Muted>
            <Button onClick={retry}>{t('retry')}</Button>
          </div>
        ) : null}
        {load.status === 'forbidden' ? <Muted role="alert">{t('forbidden')}</Muted> : null}
        {load.status === 'notKept' ? <Muted>{t('notKept')}</Muted> : null}
        {load.status === 'ready' ? <Figures data={load.data} lang={lang} /> : null}
      </Wrap>
    </SlideOver>
  );
}

/** Nothing for a helper (or a chef when the kitchen turned it off). `menuId`: 'current' or a menu's id. */
export function ChefIncomeButton({ menuId }: Readonly<{ menuId: string }>) {
  registerChefIncomeI18n();
  const { t } = useTranslation(INCOME_NS);
  const access = useIncomeAccess();
  const [open, setOpen] = useState(false);
  if (access === null) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)} aria-haspopup="dialog">
        {access === 'own' ? t('buttonOwn') : t('button')}
      </Button>
      {open ? (
        <ChefIncomePanel menuId={menuId} own={access === 'own'} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
