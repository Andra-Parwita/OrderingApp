import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, SellerOrder } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { formatOrderCode } from '../../../shared/orderCode';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import { fetchPrivate } from '../../api/private';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { PrivateTag } from '../../components/PrivateTag';
import { LabelPrintStyle, LabelSheets, type LabelText } from '../../components/labels/LabelSheets';
import {
  labelsFor,
  pickOrders,
  type LabelFilter,
  type LabelPaper,
} from '../../components/labels/labelModel';
import { useLabelPaper } from '../../components/labels/useLabelPaper';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { LABELS_NS } from './i18n/register';

const PAPERS: ReadonlyArray<LabelPaper> = ['a4', 'roll'];
const FILTERS: ReadonlyArray<LabelFilter> = ['confirmed', 'notCancelled', 'selected'];

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 64rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h1`
  flex: 1;
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;
const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  max-width: 100%;
  overflow-x: auto;
`;
const FieldName = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Picker = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const PickerLegend = styled.legend`
  padding: ${({ theme }) => theme.spacing.sm} 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const PickRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  cursor: pointer;

  input {
    width: ${({ theme }) => theme.spacing.xl};
    height: ${({ theme }) => theme.spacing.xl};
    accent-color: ${({ theme }) => theme.colour.accent};
  }
`;
const Settings = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const PreviewTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'ready'; orders: Array<SellerOrder>; cookingDate: string }>;

/**
 * S12. Route-agnostic: 6.3 puts it on a route. Print uses the browser's print dialog. Plan 084:
 * `orderCode` (from Pack's "Print label") opens it on the Selected filter with that one order.
 */
export function LabelsScreen({ orderCode }: Readonly<{ orderCode?: string }>) {
  const { t, i18n } = useTranslation(LABELS_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const { paper, choose: setPaper, hasRoll, setHasRoll } = useLabelPaper();
  const [filter, setFilter] = useState<LabelFilter>(orderCode ? 'selected' : 'confirmed');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const slug = currentSellerSlug();
    // Plan 081: today's private orders print with the menu's, tagged Private.
    void Promise.all([
      fetchSellerOrders(undefined, slug),
      fetchSellerMenu(undefined, slug),
      fetchPrivate({ day: 'today' }, slug),
    ]).then(([orders, menu, privateToday]) => {
      if (!live) return;
      const all =
        orders.ok && privateToday.ok ? [...orders.data.orders, ...privateToday.data.orders] : [];
      const wanted = orderCode ? all.find((order) => order.code === orderCode) : undefined;
      if (wanted) setSelected(new Set([wanted.id]));
      setState(
        orders.ok && menu.ok && privateToday.ok
          ? {
              status: 'ready',
              orders: [...orders.data.orders, ...privateToday.data.orders],
              cookingDate: menu.data.week.cookingDate,
            }
          : { status: 'error' },
      );
    });
    return () => {
      live = false;
    };
  }, [attempt, orderCode]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const print = useCallback(() => window.print(), []);
  const setHasPrinter = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setHasRoll(event.target.checked),
    [setHasRoll],
  );
  const toggle = useCallback((id: string) => {
    setSelected((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const orders = useMemo(() => (state.status === 'ready' ? state.orders : []), [state]);
  const printable = useMemo(() => orders.filter((order) => order.status !== 'cancelled'), [orders]);
  const counts: Record<LabelFilter, number> = {
    confirmed: pickOrders(orders, 'confirmed', selected).length,
    notCancelled: printable.length,
    selected: pickOrders(printable, 'selected', selected).length,
  };
  const chosen = useMemo(
    () => pickOrders(printable, filter, selected),
    [filter, printable, selected],
  );
  const parts = useMemo(() => labelsFor(chosen, paper), [chosen, paper]);

  const paperOptions: ReadonlyArray<SegmentedOption<LabelPaper>> = PAPERS.map((value) => ({
    value,
    label: t(`paper.${value}`),
  }));
  const filterOptions: ReadonlyArray<SegmentedOption<LabelFilter>> = FILTERS.map((value) => ({
    value,
    label: t(`which.${value}`, { count: counts[value] }),
  }));
  const day = state.status === 'ready' ? formatDay(state.cookingDate, lang) : '';
  const text: LabelText = {
    qrName: t('label.qrName'),
    where: (fulfilment, order) => {
      const own = order.private ? formatDay(order.private.eventDate, lang) : day;
      const text = t(fulfilment === 'pickup' ? 'label.pickup' : 'label.delivery', { day: own });
      return order.private ? `${t('privateTag')} · ${text}` : text;
    },
    part: (index, of) => t('label.part', { index, of }),
  };

  return (
    <Page>
      <LabelPrintStyle $paper={paper} />
      <Head data-no-print>
        <Title>{t('title')}</Title>
        <Button variant="primary" onClick={print} disabled={chosen.length === 0}>
          <Icon name="print" />
          {t('print')}
        </Button>
      </Head>

      {state.status === 'loading' ? (
        <Muted role="status" data-no-print>
          {t('loading')}
        </Muted>
      ) : null}
      {state.status === 'error' ? (
        <div role="alert" data-no-print>
          <Muted>{t('error')}</Muted>
          <Button onClick={retry}>{t('retry')}</Button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <Controls data-no-print>
            {hasRoll ? (
              <Field>
                <FieldName>{t('paper.label')}</FieldName>
                <Segmented
                  label={t('paper.label')}
                  options={paperOptions}
                  value={paper}
                  onChange={setPaper}
                />
              </Field>
            ) : null}
            <Field>
              <FieldName>{t('which.label')}</FieldName>
              <Segmented
                label={t('which.label')}
                options={filterOptions}
                value={filter}
                onChange={setFilter}
              />
            </Field>
          </Controls>

          {filter === 'selected' ? (
            <Picker data-no-print>
              <PickerLegend>{t('pick.label')}</PickerLegend>
              {printable.length === 0 ? <Muted>{t('pick.none')}</Muted> : null}
              {printable.map((order) => (
                <PickRow key={order.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggle(order.id)}
                  />
                  <span>
                    {formatOrderCode(order.code)} · {order.firstName}{' '}
                    {order.private ? <PrivateTag label={t('privateTag')} /> : null}
                  </span>
                </PickRow>
              ))}
            </Picker>
          ) : null}

          <PreviewTitle data-no-print>
            {t('previewTitle', { paper: t(`paper.${paper}`) })}
          </PreviewTitle>
          {chosen.length === 0 ? <Muted data-no-print>{t('previewEmpty')}</Muted> : null}
          {chosen.length > 0 ? (
            <Muted data-no-print>
              {t('previewCount', {
                count: parts.length,
                orders: t('ordersCount', { count: chosen.length }),
              })}
            </Muted>
          ) : null}
          <div data-print-area data-paper={paper} data-testid="label-sheets">
            <LabelSheets parts={parts} paper={paper} text={text} />
          </div>
          {chosen.length > 0 ? (
            <Muted data-no-print>{t('hint', { size: t(`hintSize.${paper}`) })}</Muted>
          ) : null}

          <Settings data-no-print>
            <PickerLegend>{t('printer.title')}</PickerLegend>
            <PickRow>
              <input type="checkbox" checked={hasRoll} onChange={setHasPrinter} />
              <span>{t('printer.hasRoll')}</span>
            </PickRow>
            <Muted>{t('printer.help')}</Muted>
          </Settings>
        </>
      ) : null}
    </Page>
  );
}
