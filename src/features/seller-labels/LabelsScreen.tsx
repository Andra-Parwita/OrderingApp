import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, styled } from 'styled-components';
import type { Language, SellerOrder } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { formatOrderCode } from '../../../shared/orderCode';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { LABELS_NS } from './i18n/register';
import {
  LABELS_PER_SHEET,
  chunk,
  itemText,
  pickOrders,
  truncateNote,
  type LabelFilter,
  type LabelPaper,
} from './labelModel';

// Print sizes. A4 sheet of 2 × 7 (99 × 38 mm labels, 2 mm between columns, 5 mm side margins,
// 15.5 mm top and bottom). Roll: one 62 × 40 mm label per page.
const PAPERS: ReadonlyArray<LabelPaper> = ['a4', 'roll'];
const FILTERS: ReadonlyArray<LabelFilter> = ['confirmed', 'notCancelled', 'selected'];

/** Page size and "print only the labels"; mounted only while the labels screen is open. */
const PrintStyle = createGlobalStyle<{ $paper: LabelPaper }>`
  @page {
    size: ${({ $paper }) => ($paper === 'a4' ? 'A4 portrait' : '62mm 40mm')};
    margin: 0;
  }
  @media print {
    html, body { height: auto; margin: 0; background: white; }
    body * { visibility: hidden; }
    [data-print-area], [data-print-area] * { visibility: visible; }
    [data-print-area] { position: absolute; top: 0; left: 0; }
    [data-no-print] { display: none; }
  }
`;

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
const PreviewTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Sheet = styled.div<{ $paper: LabelPaper }>`
  display: grid;
  grid-template-columns: ${({ $paper }) => ($paper === 'a4' ? 'repeat(2, minmax(0, 1fr))' : '1fr')};
  gap: ${({ theme }) => theme.spacing.md};
  max-width: ${({ $paper }) => ($paper === 'a4' ? 'none' : '20rem')};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  @media print {
    box-sizing: border-box;
    max-width: none;
    margin: 0;
    break-after: page;
    ${({ $paper }) =>
      $paper === 'a4'
        ? `width: 210mm; height: 297mm; padding: 15.5mm 5mm;
           grid-template-columns: repeat(2, 99mm); grid-auto-rows: 38mm; gap: 0 2mm;
           align-content: start;`
        : `width: 62mm; height: 40mm; padding: 0; gap: 0;`}
  }
`;

const LabelBox = styled.article<{ $paper: LabelPaper }>`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'code qr'
    'name qr'
    'items items'
    'where where'
    'note note';
  align-content: start;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  overflow: hidden;

  @media print {
    width: ${({ $paper }) => ($paper === 'a4' ? '99mm' : '62mm')};
    height: ${({ $paper }) => ($paper === 'a4' ? '38mm' : '40mm')};
    padding: 2mm 3mm;
    gap: 0.5mm 2mm;
    border: 0;
    border-radius: 0;
    background: white;
    color: black;
    font-size: 8pt;
    line-height: 1.15;
    break-inside: avoid;
    ${({ $paper }) => ($paper === 'roll' ? 'break-after: page;' : '')}
  }
`;
const Code = styled.div`
  grid-area: code;
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: ${({ theme }) => theme.type.lineHeight.tight};

  @media print {
    font-size: 17pt;
  }
`;
const Qr = styled.div`
  grid-area: qr;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border: ${({ theme }) => theme.border.hairline} dashed ${({ theme }) => theme.colour.outline};
  color: ${({ theme }) => theme.colour.textMuted};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  @media print {
    width: 15mm;
    height: 15mm;
    border-color: black;
    color: black;
  }
`;
const Name = styled.div`
  grid-area: name;
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  @media print {
    font-size: 11pt;
  }
`;
const Items = styled.ul`
  grid-area: items;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Where = styled.div`
  grid-area: where;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const NoteLine = styled.div`
  grid-area: note;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  font-size: ${({ theme }) => theme.type.size.sm};

  @media print {
    background: transparent;
    border-top: 0.2mm solid black;
    font-size: 7pt;
  }
`;

type LabelProps = Readonly<{
  order: SellerOrder;
  paper: LabelPaper;
  day: string;
}>;

/** No chef names, address or phone: the label carries only what packing needs (D-007, D-012). */
const Label = memo(function Label({ order, paper, day }: LabelProps) {
  const { t } = useTranslation(LABELS_NS);
  const where = t(order.fulfilment === 'pickup' ? 'label.pickup' : 'label.delivery', { day });
  const code = formatOrderCode(order.code);
  return (
    <LabelBox $paper={paper} aria-label={code}>
      <Code>{code}</Code>
      <Qr role="img" aria-label={t('label.qrName')}>
        {t('label.qr')}
      </Qr>
      <Name>{order.firstName}</Name>
      <Items>
        {order.lines.map((line) => (
          <li key={line.itemId}>{itemText(line)}</li>
        ))}
      </Items>
      <Where>{where}</Where>
      {order.note ? <NoteLine>{truncateNote(order.note)}</NoteLine> : null}
    </LabelBox>
  );
});

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'ready'; orders: Array<SellerOrder>; cookingDate: string }>;

/** S12. Route-agnostic: 6.3 puts it on a route. Print uses the browser's print dialog. */
export function LabelsScreen() {
  const { t, i18n } = useTranslation(LABELS_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [paper, setPaper] = useState<LabelPaper>('a4');
  const [filter, setFilter] = useState<LabelFilter>('confirmed');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const slug = currentSellerSlug();
    void Promise.all([fetchSellerOrders(undefined, slug), fetchSellerMenu(undefined, slug)]).then(
      ([orders, menu]) => {
        if (!live) return;
        setState(
          orders.ok && menu.ok
            ? {
                status: 'ready',
                orders: orders.data.orders,
                cookingDate: menu.data.week.cookingDate,
              }
            : { status: 'error' },
        );
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const print = useCallback(() => window.print(), []);
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
  const sheets = useMemo(
    () => chunk(chosen, paper === 'a4' ? LABELS_PER_SHEET : 1),
    [chosen, paper],
  );

  const paperOptions: ReadonlyArray<SegmentedOption<LabelPaper>> = PAPERS.map((value) => ({
    value,
    label: t(`paper.${value}`),
  }));
  const filterOptions: ReadonlyArray<SegmentedOption<LabelFilter>> = FILTERS.map((value) => ({
    value,
    label: t(`which.${value}`, { count: counts[value] }),
  }));
  const day = state.status === 'ready' ? formatDay(state.cookingDate, lang) : '';

  return (
    <Page>
      <PrintStyle $paper={paper} />
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
            <Field>
              <FieldName>{t('paper.label')}</FieldName>
              <Segmented
                label={t('paper.label')}
                options={paperOptions}
                value={paper}
                onChange={setPaper}
              />
            </Field>
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
                    {formatOrderCode(order.code)} · {order.firstName}
                  </span>
                </PickRow>
              ))}
            </Picker>
          ) : null}

          <PreviewTitle data-no-print>
            {t('previewTitle', { paper: t(`paper.${paper}`) })}
          </PreviewTitle>
          {chosen.length === 0 ? <Muted data-no-print>{t('previewEmpty')}</Muted> : null}
          <div data-print-area data-paper={paper} data-testid="label-sheets">
            {sheets.map((sheet) => (
              <Sheet key={sheet[0]?.id} $paper={paper}>
                {sheet.map((order) => (
                  <Label key={order.id} order={order} paper={paper} day={day} />
                ))}
              </Sheet>
            ))}
          </div>
        </>
      ) : null}
    </Page>
  );
}
