import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { createGlobalStyle, styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { fetchMenu } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { useReadOnlyOrders } from './orderAccess';
import { useLang } from './orderText';
import {
  PRINT_SORT,
  PRINT_WHICH,
  buildPrintPlan,
  itemsLine,
  paginate,
  type PrintBlock,
  type PrintGroup,
  type PrintSort,
  type PrintWhich,
} from './printModel';
import { selectCurrent } from './sellerOrdersSelectors';
import { useLiveOrders } from './useLiveOrders';

// Plan 042: the current menu's orders as A4 pages. The screen shows the pages; Print opens the
// browser's print dialog ("Save as PDF" is there too). Black on white, 10 pt, one order never
// split across pages. Print sizes (mm, pt) live in this file only, as in LabelSheets.

const PrintStyle = createGlobalStyle`
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    html, body { height: auto; margin: 0; background: white; }
    body * { visibility: hidden; }
    [data-print-area], [data-print-area] * { visibility: visible; }
    [data-print-area] { position: absolute; top: 0; left: 0; width: 100%; }
    [data-no-print] { display: none; }
  }
`;

const Wrap = styled.main`
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
  font-size: 1.375rem;
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

  span {
    font-size: 0.875rem;
    font-weight: 700;
  }
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Pages = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: center;
  overflow-x: auto;

  @media print {
    display: block;
    overflow: visible;
  }
`;

/** One sheet: paper on screen, the page's content when printed. */
const Sheet = styled.section`
  box-sizing: border-box;
  flex: none;
  width: 210mm;
  max-width: 100%;
  padding: 12mm;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: white;
  color: black;
  font-size: 10pt;
  line-height: 1.3;

  @media print {
    width: auto;
    max-width: none;
    padding: 0;
    border: 0;
    break-after: page;

    &:last-child {
      break-after: auto;
    }
  }
`;
const PageHead = styled.header`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding-bottom: 2mm;
  margin-bottom: 3mm;
  border-bottom: 0.3mm solid black;

  h2 {
    margin: 0;
    font-size: 13pt;
  }
  p {
    margin: 0;
    font-size: 9pt;
  }
  div:last-child {
    text-align: right;
  }
`;
const GroupHead = styled.h3`
  margin: 3mm 0 1mm;
  padding-bottom: 0.5mm;
  border-bottom: 0.2mm solid black;
  font-size: 11pt;
  break-after: avoid;

  small {
    font-size: 9pt;
    font-weight: 400;
  }
`;
const Row = styled.article`
  display: grid;
  grid-template-columns: 22mm 22mm minmax(0, 1fr) 30mm 6mm;
  gap: 0 2mm;
  align-items: start;
  padding: 1mm 0;
  border-bottom: 0.1mm solid black;
  break-inside: avoid;

  .code {
    white-space: nowrap;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .note {
    grid-column: 3;
    font-style: italic;
  }
  .state {
    text-align: right;
    font-size: 9pt;
  }
  .tick {
    box-sizing: border-box;
    width: 4mm;
    height: 4mm;
    margin-top: 0.5mm;
    border: 0.3mm solid black;
  }
`;
const Totals = styled.section`
  margin-top: 4mm;
  break-inside: avoid;

  h3 {
    margin: 0 0 1mm;
    font-size: 11pt;
  }
  ul {
    margin: 0 0 2mm;
    padding: 0;
    list-style: none;
    columns: 2;
  }
  p {
    margin: 0;
  }
`;

function useKitchenName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    let live = true;
    void fetchMenu(currentSellerSlug()).then((result) => {
      if (live && result.ok) setName(result.data.kitchen.name);
    });
    return () => {
      live = false;
    };
  }, []);
  return name;
}

function GroupTitle({
  title,
  window,
  continued,
}: Readonly<{ title: string; window?: string; continued: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <GroupHead>
      {title}
      {window ? <small> · {window}</small> : null}
      {continued ? <small> · {t('print.continued')}</small> : null}
    </GroupHead>
  );
}

function OrderRow({ order, place }: Readonly<{ order: Order; place: string }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  return (
    <Row data-testid="print-order">
      <span className="code">{formatOrderCode(order.code)}</span>
      <span>{order.firstName}</span>
      <span>
        {itemsLine(order, lang)}
        {place ? ` · ${place}` : ''}
      </span>
      <span className="state">
        {order.paid ? t('print.paid') : t('print.notPaid')}
        <br />
        {t(`status.${order.status}`)}
      </span>
      <span className="tick" aria-hidden="true" />
      {order.note ? <span className="note">{order.note}</span> : null}
    </Row>
  );
}

/** Print orders. Owners and chefs; a helper reads orders only and gets no print. */
export function PrintOrdersScreen({ onBack }: Readonly<{ onBack?: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const readOnly = useReadOnlyOrders();
  const orders = useLiveOrders();
  const current = useSelector(selectCurrent);
  const kitchen = useKitchenName();
  const [which, setWhich] = useState<PrintWhich>('all');
  const [sort, setSort] = useState<PrintSort>('place');
  const [printedAt] = useState(() => new Date().toISOString());
  const print = useCallback(() => window.print(), []);

  const view = current.status === 'ready' ? current.view : null;
  const plan = useMemo(
    () => buildPrintPlan(orders ?? [], view, which, sort, lang),
    [orders, view, which, sort, lang],
  );
  const pages = useMemo(() => paginate(plan, lang), [plan, lang]);

  if (readOnly) {
    return (
      <Wrap>
        <Muted role="status">{t('print.notAllowed')}</Muted>
      </Wrap>
    );
  }

  const whichOptions: ReadonlyArray<SegmentedOption<PrintWhich>> = PRINT_WHICH.map((value) => ({
    value,
    label: t(`print.which.${value}`),
  }));
  const sortOptions: ReadonlyArray<SegmentedOption<PrintSort>> = PRINT_SORT.map((value) => ({
    value,
    label: t(`print.sort.${value}`),
  }));
  const titleOf = (group: PrintGroup) =>
    group.kind === 'delivery'
      ? t('fulfilment.delivery')
      : group.kind === 'pickup'
        ? (group.place ?? '')
        : t('print.otherPlace');
  /** Only the code-sorted list names the place on each row. */
  const placeOf = (order: Order) => {
    if (order.fulfilment === 'delivery') return t('fulfilment.delivery');
    const id = order.pickupPlaceId ?? view?.pickupPoints[0]?.id;
    return view?.pickupPoints.find((p) => p.id === id)?.place ?? t('print.otherPlace');
  };
  const day = view ? formatDay(view.menu.cookingDate, lang) : '';
  const printed = formatDayTime(printedAt, lang);
  const ready = orders !== null && view !== null;
  const empty = ready && plan.totals.orders === 0;
  const { totals } = plan;

  const renderBlock = (block: PrintBlock, index: number) => {
    if (block.type === 'group')
      return (
        <GroupTitle
          key={`g-${block.group.key}`}
          title={titleOf(block.group)}
          window={block.group.window}
          continued={false}
        />
      );
    if (block.type === 'order') {
      // A group that carries on from the page before says so.
      const heading =
        index === 0 && block.group.kind !== 'all' ? (
          <GroupTitle
            key={`c-${block.group.key}`}
            title={titleOf(block.group)}
            window={block.group.window}
            continued
          />
        ) : null;
      return [
        heading,
        <OrderRow
          key={block.order.id}
          order={block.order}
          place={block.group.kind === 'all' ? placeOf(block.order) : ''}
        />,
      ];
    }
    return (
      <Totals key="totals" data-testid="print-totals">
        <h3>{t('print.totals')}</h3>
        <ul>
          {totals.dishes.map((dish) => (
            <li key={dish.itemId}>
              {dish.qty} × {dish.name}
            </li>
          ))}
        </ul>
        <p>{t('print.ordersCount', { count: totals.orders })}</p>
        <p>
          {t('print.total')}: {formatMoney(totals.totalCents, lang)} · {t('print.paid')}:{' '}
          {formatMoney(totals.paidCents, lang)} · {t('print.notPaid')}:{' '}
          {formatMoney(totals.unpaidCents, lang)}
        </p>
      </Totals>
    );
  };

  return (
    <Wrap>
      <PrintStyle />
      <Head data-no-print>
        {onBack ? (
          <Button onClick={onBack} aria-label={t('print.back')}>
            <Icon name="back" />
          </Button>
        ) : null}
        <Title>{t('print.title')}</Title>
        <Button variant="primary" onClick={print} disabled={!ready || empty}>
          <Icon name="print" />
          {t('print.print')}
        </Button>
      </Head>
      <Controls data-no-print>
        <Field>
          <span>{t('print.which.label')}</span>
          <Segmented
            label={t('print.which.label')}
            options={whichOptions}
            value={which}
            onChange={setWhich}
          />
        </Field>
        <Field>
          <span>{t('print.sort.label')}</span>
          <Segmented
            label={t('print.sort.label')}
            options={sortOptions}
            value={sort}
            onChange={setSort}
          />
        </Field>
      </Controls>
      {ready ? <Muted data-no-print>{t('print.hint', { count: pages.length })}</Muted> : null}
      {!ready ? (
        <Muted role="status" data-no-print>
          {t('print.loading')}
        </Muted>
      ) : null}
      {empty ? <Muted data-no-print>{t('print.empty')}</Muted> : null}
      {ready && !empty ? (
        <Pages data-print-area data-testid="print-pages">
          {pages.map((blocks, pageIndex) => (
            <Sheet key={pageIndex} data-testid="print-page">
              <PageHead>
                <div>
                  <h2>{kitchen}</h2>
                  <p>{t('print.menuFor', { day })}</p>
                </div>
                <div>
                  <p>{t('print.printedAt', { time: printed })}</p>
                  <p>{t('print.page', { n: pageIndex + 1, total: pages.length })}</p>
                </div>
              </PageHead>
              {blocks.map((block, i) => renderBlock(block, i))}
            </Sheet>
          ))}
        </Pages>
      ) : null}
    </Wrap>
  );
}
