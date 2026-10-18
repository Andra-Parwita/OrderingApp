import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCutoff, formatDay, formatWindow } from '../../../shared/dates';
import type { Language, Order } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import { formatMoney } from '../../../shared/money';
import { ChefIncomeButton } from '../../components/chef-income';
import { pickText } from '../../../shared/text';
import { Icon } from '../../ui';
import { Aside, GoLink } from './homeParts';
import type { LiveStage } from './homeState';
import { HOME_NS } from './i18n/register';
import {
  LOW_STOCK,
  cookingProgress,
  dishStock,
  isRunningNow,
  liveNumbers,
  placeLoads,
  unpaidOf,
  type Bar,
} from './liveData';
import { PhaseStrip, type PhaseItem, type Progress } from './PhaseStrip';
import type { GoTarget } from './types';

// States 3 and 4, the bodies: a live menu. Read-only: the numbers link to Orders with a filter,
// the dish stock and the places are for looking at; changes are made on the screens "Go to …" leads to.

export type LiveProps = Readonly<{
  view: MenuView;
  orders: ReadonlyArray<Order>;
  lang: Language;
  now: Date;
  stage: LiveStage;
  onGo: (target: GoTarget, search?: string) => void;
}>;

/** The four phases of a live menu; the current one depends on where in the week we are. */
function Phases({ view, lang, stage }: Pick<LiveProps, 'view' | 'lang' | 'stage'>) {
  const { t } = useTranslation(HOME_NS);
  const { menu } = view;
  const taking = stage === 'taking' || stage === 'paused';
  const states: Array<Progress> = [
    'done',
    taking ? 'current' : 'done',
    stage === 'cookingDay' ? 'current' : 'todo',
    'todo',
  ];
  const notes = [
    t('live.phaseDone'),
    t('draft.until', { when: formatCutoff(menu.cutoffAt, lang) }),
    formatDay(menu.cookingDate, lang),
    '',
  ];
  const ids = ['make', 'taking', 'cooking', 'finished'] as const;
  const phases: Array<PhaseItem> = ids.map((id, index) => ({
    id,
    label: t(`draft.phase.${id}`),
    note: notes[index] ?? '',
    state: states[index] ?? 'todo',
  }));
  return <PhaseStrip label={t('draft.phases')} phases={phases} />;
}

const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (max-width: 52rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
const Tile = styled.button<{ $warn?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  align-content: center;
  gap: 0 ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:first-child {
    border-left: 0;
  }
  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  strong {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    color: ${({ $warn, theme }) => ($warn ? theme.c.warn : theme.c.text)};
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;

const Tools = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const LiveBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;
`;
const OnTheDay = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

function NumberTiles({ orders, lang, onGo }: Pick<LiveProps, 'orders' | 'lang' | 'onGo'>) {
  const { t } = useTranslation(HOME_NS);
  const n = liveNumbers(orders);
  return (
    <Tiles>
      <Tile type="button" onClick={() => onGo('orders')}>
        <strong>{n.orders}</strong>
        <span>{t('live.tileOrders', { count: n.orders, cancelled: n.cancelled })}</span>
      </Tile>
      <Tile type="button" onClick={() => onGo('orders')}>
        <strong>{formatMoney(n.totalCents, lang)}</strong>
        <span>{t('live.tileTotal', { paid: formatMoney(n.paidCents, lang) })}</span>
      </Tile>
      <Tile type="button" onClick={() => onGo('orders', 'status=ordered')}>
        <strong>{n.toConfirm}</strong>
        <span>{t('live.tileConfirm', { changed: n.changed })}</span>
      </Tile>
      <Tile type="button" $warn={n.unpaidCount > 0} onClick={() => onGo('orders', 'unpaid=1')}>
        <strong>
          {n.unpaidCount > 0 ? <Icon name="coin" /> : null}
          {n.unpaidCount}
        </strong>
        <span>{t('live.tileUnpaid', { amount: formatMoney(n.unpaidCents, lang) })}</span>
      </Tile>
    </Tiles>
  );
}

const Heading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xs};

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }
  > span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Stock = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  column-gap: ${({ theme }) => theme.spacing.xxl};
  margin: 0;
  padding: 0;
  list-style: none;
`;
const StockRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem 5.5rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 2rem;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-weight: 600;

  .gone {
    color: ${({ theme }) => theme.c.muted};
  }
  > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
const Meter = styled.span`
  display: block;
  height: 0.25rem;
  border-radius: 0.125rem;
  background: ${({ theme }) => theme.c.line};
`;
const MeterFill = styled.span<{ $share: number; $warn: boolean; $gone: boolean }>`
  display: block;
  width: ${({ $share }) => Math.min(100, Math.max(0, $share * 100))}%;
  height: 100%;
  border-radius: inherit;
  background: ${({ $warn, $gone, theme }) =>
    $gone ? theme.c.ctrl : $warn ? theme.c.warn : theme.c.fill};
`;
const Amount = styled.span<{ $warn?: boolean; $gone?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ $warn, $gone, theme }) =>
    $warn ? theme.c.warn : $gone ? theme.c.muted : theme.c.text};
  font-variant-numeric: tabular-nums;
  font-weight: 500;
`;

function DishStock({
  view,
  orders,
  lang,
  onGo,
}: Pick<LiveProps, 'view' | 'orders' | 'lang' | 'onGo'>) {
  const { t } = useTranslation(HOME_NS);
  return (
    <section aria-labelledby="home-stock">
      <Heading>
        <h2 id="home-stock">{t('live.dishes')}</h2>
        <Tools>
          <ChefIncomeButton menuId="current" />
          <GoLink onClick={() => onGo('menu')}>{t('live.goMenuLimits')}</GoLink>
        </Tools>
      </Heading>
      <Stock>
        {dishStock(view, orders).map((dish) => {
          const low = dish.left !== null && !dish.soldOut && dish.left <= LOW_STOCK;
          const share = dish.limit === null || dish.limit === 0 ? 0.25 : dish.sold / dish.limit;
          return (
            <StockRow key={dish.id}>
              <span className={dish.soldOut ? 'gone' : undefined}>{pickText(dish.name, lang)}</span>
              <Meter aria-hidden="true">
                <MeterFill $share={dish.soldOut ? 1 : share} $warn={low} $gone={dish.soldOut} />
              </Meter>
              <Amount $warn={low} $gone={dish.soldOut}>
                {dish.soldOut ? (
                  t('live.soldOut')
                ) : dish.left === null ? (
                  t('live.noLimit', { sold: dish.sold })
                ) : (
                  <>
                    {low ? <Icon name="warning" /> : null}
                    {t('live.left', { count: dish.left })}
                  </>
                )}
              </Amount>
            </StockRow>
          );
        })}
      </Stock>
    </section>
  );
}

const Places = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  column-gap: ${({ theme }) => theme.spacing.xxl};
  margin: 0;
  padding: 0;
  list-style: none;
`;
const PlaceRow = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 2rem;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  strong {
    margin-right: ${({ theme }) => theme.spacing.sm};
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
  b {
    font-variant-numeric: tabular-nums;
  }
`;

function OrdersPerPlace({ view, orders, lang }: Pick<LiveProps, 'view' | 'orders' | 'lang'>) {
  const { t } = useTranslation(HOME_NS);
  const note = pickText(view.menu.delivery.note, lang);
  return (
    <Aside aria-labelledby="home-places">
      <Heading>
        <h2 id="home-places">{t('live.cookingDay')}</h2>
        <span>{formatDay(view.menu.cookingDate, lang)}</span>
      </Heading>
      <Places>
        {placeLoads(view, orders).map((place) => (
          <PlaceRow key={place.id}>
            <Icon name={place.kind === 'pickup' ? 'bag' : 'truck'} />
            <span>
              <strong>{place.kind === 'pickup' ? place.name : t('live.delivery')}</strong>
              {place.window ? (
                <small>
                  {t('live.pickup', {
                    window: formatWindow(place.window.start, place.window.end, lang),
                  })}
                </small>
              ) : note ? (
                <small>{note}</small>
              ) : null}
            </span>
            <b>{place.orders}</b>
          </PlaceRow>
        ))}
      </Places>
    </Aside>
  );
}

/** State 3: taking orders (or paused). */
export function Taking(props: LiveProps) {
  return (
    <>
      <Phases {...props} />
      <NumberTiles {...props} />
      <LiveBody>
        <DishStock {...props} />
        <OrdersPerPlace {...props} />
      </LiveBody>
    </>
  );
}

// ---- State 4 ----

const Bars = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const BarBox = styled.div`
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-weight: 700;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .count b {
    font-size: 1.25rem;
  }
  .count span {
    margin-left: ${({ theme }) => theme.spacing.xs};
    color: ${({ theme }) => theme.c.muted};
    font-weight: 400;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const BarMeter = styled(Meter)`
  margin: ${({ theme }) => theme.spacing.xs} 0;
`;

function ProgressBar({ label, note, bar }: Readonly<{ label: string; note: string; bar: Bar }>) {
  const { t } = useTranslation(HOME_NS);
  return (
    <BarBox>
      <div className="top">
        <span>{label}</span>
        <span className="count">
          <b>{bar.done}</b>
          <span>{t('live.of', { total: bar.of })}</span>
        </span>
      </div>
      <BarMeter
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={bar.of}
        aria-valuenow={bar.done}
      >
        <MeterFill $share={bar.of === 0 ? 0 : bar.done / bar.of} $warn={false} $gone={false} />
      </BarMeter>
      <small>{note}</small>
    </BarBox>
  );
}

const Handover = styled.section`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px
    ${({ theme }) => theme.spacing.md};
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: right;
    text-transform: uppercase;
  }
  th:first-child,
  td:first-child {
    padding-left: 0;
    text-align: left;
  }
  th:nth-child(2),
  td:nth-child(2) {
    text-align: left;
  }
  td {
    height: 2.25rem;
    padding: 0 ${({ theme }) => theme.spacing.md};
    border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td:first-child {
    font-weight: 700;
  }
  td:last-child,
  th:last-child {
    padding-right: 0;
  }
  .place {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  }
  .now {
    color: ${({ theme }) => theme.c.atext};
    font-weight: 700;
  }
`;
const UnpaidStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0 ${({ theme }) => theme.size.pagePadTablet}px ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};

  span {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
  em {
    color: ${({ theme }) => theme.c.muted};
    font-style: normal;
  }
`;

function HandoverTable({ view, orders, lang, now, onGo }: LiveProps) {
  const { t } = useTranslation(HOME_NS);
  return (
    <Handover aria-labelledby="home-handover">
      <Heading>
        <h2 id="home-handover">{t('live.handover')}</h2>
        <GoLink onClick={() => onGo('handover')}>{t('live.goHandover')}</GoLink>
      </Heading>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t('live.colPlace')}</th>
            <th scope="col">{t('live.colTime')}</th>
            <th scope="col">{t('live.colOrders')}</th>
            <th scope="col">{t('live.colPacked')}</th>
            <th scope="col">{t('live.colHandedOver')}</th>
          </tr>
        </thead>
        <tbody>
          {placeLoads(view, orders).map((place) => {
            const { window } = place;
            const running =
              window !== undefined && isRunningNow(window, view.menu.cookingDate, now);
            return (
              <tr key={place.id}>
                <td>
                  <span className="place">
                    <Icon name={place.kind === 'pickup' ? 'bag' : 'truck'} />
                    {place.kind === 'pickup' ? place.name : t('live.delivery')}
                  </span>
                </td>
                <td className={running ? 'now' : undefined}>
                  {window
                    ? running
                      ? t('live.nowUntil', { end: window.end })
                      : formatWindow(window.start, window.end, lang)
                    : ''}
                </td>
                <td>
                  <b>{place.orders}</b>
                </td>
                <td>{t('live.packedN', { count: place.packed })}</td>
                <td>
                  {t(place.kind === 'pickup' ? 'live.collectedN' : 'live.deliveredN', {
                    count: place.handedOver,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Handover>
  );
}

/** State 4 (and "Orders closed" before the day): the day's progress and the hand-over. */
export function CookingDay(props: LiveProps) {
  const { t } = useTranslation(HOME_NS);
  const { orders, lang, onGo } = props;
  const bars = cookingProgress(orders);
  const unpaid = unpaidOf(orders);
  const dayDishes = props.view.dishes.filter((dish) => dish.dayStock !== undefined);
  const dayGone = dayDishes.filter((dish) => dish.dayStock === 0).length;
  return (
    <>
      <Phases {...props} />
      {props.stage === 'cookingDay' && dayDishes.length > 0 ? (
        <OnTheDay>
          {t('live.onTheDay', { count: dayDishes.length })}
          {dayGone > 0 ? ` · ${t('live.onTheDaySold', { count: dayGone })}` : ''}
        </OnTheDay>
      ) : null}
      <Bars>
        <ProgressBar label={t('live.packed')} note={t('live.packedNote')} bar={bars.packed} />
        <ProgressBar
          label={t('live.collected')}
          note={t('live.collectedNote')}
          bar={bars.collected}
        />
        <ProgressBar
          label={t('live.delivered')}
          note={t('live.deliveredNote')}
          bar={bars.delivered}
        />
      </Bars>
      <HandoverTable {...props} />
      {unpaid.count > 0 ? (
        <UnpaidStrip>
          <span>
            <Icon name="coin" />
            <strong>{t('live.unpaidStrip', { count: unpaid.count })}</strong>
            <em>· {formatMoney(unpaid.cents, lang)}</em>
          </span>
          <GoLink onClick={() => onGo('orders', 'unpaid=1')}>{t('live.seeWho')}</GoLink>
        </UnpaidStrip>
      ) : null}
    </>
  );
}
