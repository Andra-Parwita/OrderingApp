import { memo, useCallback, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css, keyframes, styled } from 'styled-components';
import type { Fulfilment, Language, PickupPoint } from '../../../shared/domain';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { MAX_QTY } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { CustomerPage } from '../../components/CustomerPage';
import { Notice } from '../../ui/Notice';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { Group, MainButton, Qty, Round } from './menuParts';
import { NoteSheet } from './NoteSheet';
import type { BasketNotice } from './customerSlice';
import type { BasketLine } from './selectors';

// The three checkout pages (spec §4.2): basket, pickup place, your name. Presentational: the routed
// screen (BasketScreen) and the fixtures page both feed them; nothing here fetches or navigates.

export const Body = styled.div`
  /* Room for the pinned footer. */
  padding-bottom: calc(10rem + var(--sab));
`;
export const Footer = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  max-width: 30rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg}
    calc(${({ theme }) => theme.spacing.md} + var(--sab));
  background: ${({ theme }) => theme.c.bg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const FooterNote = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const spin = keyframes`
  to { transform: rotate(360deg); }
`;
export const Spinner = styled.span`
  width: 1.1rem;
  height: 1.1rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.9s linear infinite;
`;

// ---- Banners ----

function AlertBanner({ lead, rest }: Readonly<{ lead: string; rest: string }>) {
  return (
    <Notice tone="warn" role="alert" icon={<MenuIcon name="warning" />}>
      <b>{lead}</b> {rest}
    </Notice>
  );
}

// ---- Basket ----

const NO_NOTES: Readonly<Record<string, string>> = {};
const noNote = () => undefined;

const Lines = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const LineRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const LineText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;
const LineName = styled.span`
  font-weight: 700;
`;
const LineMeta = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  b {
    color: ${({ theme }) => theme.c.text};
    font-weight: 700;
  }
`;
const LineNote = styled.span`
  overflow: hidden;
  color: ${({ theme }) => theme.c.warn};
  font-size: ${({ theme }) => theme.type.size.md};
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const NoteButton = styled.button<{ $has: boolean }>`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${({ theme, $has }) => ($has ? theme.c.warn : theme.c.muted)};
  cursor: pointer;
`;
const LineEnd = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-weight: 700;
`;
const SectionLabel = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;
const Track = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0 ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf2};
`;
const Segment = styled.button`
  flex: 1;
  min-height: ${({ theme }) => theme.size.tap}px;
  border: ${({ theme }) => theme.border.hairline} solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &[aria-checked='true'] {
    background: ${({ theme }) => theme.c.surf};
    font-weight: 700;
    border-color: ${({ theme }) => theme.c.ctrl};
  }
`;
const placeRow = css`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 3.5rem;
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;

  > svg:first-child {
    color: ${({ theme }) => theme.c.atext};
  }
`;
const PlaceRow = styled.div`
  ${placeRow}
`;
const PlaceButton = styled.button`
  ${placeRow}
  cursor: pointer;
`;
const PlaceText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  b {
    font-weight: 700;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.md};
  }
`;
const ChangeText = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.atext};
  font-weight: 600;
`;
const DeliveryNote = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg} 0;
  color: ${({ theme }) => theme.c.text};

  svg {
    margin-top: 0.125rem;
    color: ${({ theme }) => theme.c.atext};
  }
`;
const Quiet = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;

/**
 * The ways this menu can be received: pickup only when it has pickup places, delivery only when it
 * is on. (Plan 063: a delivery-only menu offers no pickup, a pickup-only one no delivery.)
 */
export function fulfilmentOptions(week: MenuResponse['week']): ReadonlyArray<Fulfilment> {
  const options: Array<Fulfilment> = [];
  if (week.pickupPoints.length > 0) options.push('pickup');
  if (week.delivery.available) options.push('delivery');
  return options.length > 0 ? options : ['pickup'];
}

/** What the pickup place row shows: where, and when. */
function whenAndWhere(point: PickupPoint, cookingDate: string, lang: Language): string {
  return `${formatCookingDate(cookingDate, lang)} · ${formatWindow(point.window.start, point.window.end, lang, cookingDate)}`;
}

type LineProps = Readonly<{
  line: BasketLine;
  lang: Language;
  /** The only line of an order being changed: it cannot be taken out (cancel the order instead). */
  locked: boolean;
  /** Plan 111: this line's note ('' = none). */
  note: string;
  onQty: (itemId: string, qty: number) => void;
  onNote: (itemId: string, note: string) => void;
}>;

const BasketLineRow = memo(function BasketLineRow({
  line,
  lang,
  locked,
  note,
  onQty,
  onNote,
}: LineProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { item, qty, lineCents } = line;
  const own = pickText(item.name, lang);
  const name = line.groupName ? `${pickText(line.groupName, lang)} · ${own}` : own;
  const [editing, setEditing] = useState(false);
  const closeNote = useCallback(() => setEditing(false), []);
  const saveNote = useCallback(
    (text: string) => {
      onNote(item.id, text);
      setEditing(false);
    },
    [onNote, item.id],
  );
  const max = line.max ?? MAX_QTY;
  const less = useCallback(() => onQty(item.id, qty - 1), [onQty, item.id, qty]);
  const more = useCallback(() => onQty(item.id, qty + 1), [onQty, item.id, qty]);
  const removing = qty === 1;
  return (
    <LineRow>
      <LineText>
        <LineName>{name}</LineName>
        <LineMeta>
          {t('basket.each', { price: formatMoney(item.priceCents, lang) })} ·{' '}
          <b>{formatMoney(lineCents, lang)}</b>
        </LineMeta>
        {note ? <LineNote>{note}</LineNote> : null}
      </LineText>
      <LineEnd>
        <NoteButton
          type="button"
          $has={note !== ''}
          aria-label={t(note ? 'lineNote.change' : 'lineNote.add', { name })}
          aria-haspopup="dialog"
          onClick={() => setEditing(true)}
        >
          <MenuIcon name="pencil" />
        </NoteButton>
        <Group role="group" aria-label={name}>
          <Round
            type="button"
            aria-label={removing ? t('checkout.remove', { name }) : t('menu.decrease', { name })}
            disabled={removing && locked}
            onClick={less}
          >
            <MenuIcon name={removing ? 'bin' : 'minus'} />
          </Round>
          <Qty aria-live="polite">{qty}</Qty>
          <Round
            type="button"
            aria-label={t('menu.increase', { name })}
            disabled={qty >= max}
            onClick={more}
          >
            <MenuIcon name="plus" />
          </Round>
        </Group>
      </LineEnd>
      {editing ? <NoteSheet name={name} note={note} onSave={saveNote} onClose={closeNote} /> : null}
    </LineRow>
  );
});

export type ClosedReason = 'closed_by_seller' | 'cutoff_passed';

type BasketProps = Readonly<{
  data: MenuResponse;
  lang: Language;
  lines: ReadonlyArray<BasketLine>;
  totalCents: number;
  fulfilment: Fulfilment;
  /** The pickup place chosen (or the order's own, when it is being changed). */
  pickupId: string | undefined;
  editing: boolean;
  /** What changed in the basket since the customer added things (a banner each). */
  notices: ReadonlyArray<BasketNotice>;
  /** Ordering is off: paused by the seller or the cut-off has passed (a banner; Next is off). */
  closed: ClosedReason | null;
  /** The server turned the order down for stock, but nothing in the basket could be adjusted. */
  stockProblem: boolean;
  /** Plan 111: the note per line (itemId to text). */
  notes?: Readonly<Record<string, string>>;
  onQty: (itemId: string, qty: number) => void;
  onNote?: (itemId: string, note: string) => void;
  onFulfilment: (value: Fulfilment) => void;
  onChangePlace: () => void;
  onNext: () => void;
  onBack: () => void;
  /** Plan 071: the delivery address section (under the Delivery choice) and whether it still blocks Next. */
  addressSlot?: ReactNode;
  addressBlocked?: boolean;
}>;

export function BasketView({
  data,
  lang,
  lines,
  totalCents,
  fulfilment,
  pickupId,
  editing,
  notices,
  closed,
  stockProblem,
  notes = NO_NOTES,
  onQty,
  onNote = noNote,
  onFulfilment,
  onChangePlace,
  onNext,
  onBack,
  addressSlot,
  addressBlocked = false,
}: BasketProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { week, seller } = data;
  const cook = seller.name || t('states.theSeller');
  const total = formatMoney(totalCents, lang);
  const points = week.pickupPoints;
  const pickup = points.find((point) => point.id === pickupId) ?? points[0];
  const canChange = !editing && points.length > 1;
  const labelId = useId();
  return (
    <CustomerPage
      title={editing ? t('basket.editTitle') : t('basket.title')}
      backLabel={editing ? t('checkout.backOrder') : t('checkout.backDishes')}
      onBack={onBack}
    >
      <Body>
        {notices.map((notice) => (
          <AlertBanner
            key={`${notice.itemId}-${notice.kind}`}
            lead={t(notice.kind === 'sold_out' ? 'checkout.soldOutLead' : 'checkout.fewerLead', {
              dish: pickText(notice.name, lang),
              count: notice.qty,
            })}
            rest={t(notice.kind === 'sold_out' ? 'checkout.soldOutRest' : 'checkout.fewerRest', {
              total,
            })}
          />
        ))}
        {closed === 'closed_by_seller' ? (
          <AlertBanner lead={t('checkout.pausedLead')} rest={t('checkout.pausedRest', { cook })} />
        ) : null}
        {closed === 'cutoff_passed' ? (
          <AlertBanner
            lead={t('checkout.closedLead', { date: formatCookingDate(week.cookingDate, lang) })}
            rest={t('checkout.closedRest', { dateTime: formatCutoff(week.cutoffAt, lang), cook })}
          />
        ) : null}
        {stockProblem && notices.length === 0 ? (
          <AlertBanner lead={t('checkout.stockLead')} rest={t('checkout.stockRest')} />
        ) : null}
        <Lines>
          {lines.map((line) => (
            <BasketLineRow
              key={line.item.id}
              line={line}
              lang={lang}
              locked={editing && lines.length === 1}
              note={notes[line.item.id] ?? ''}
              onQty={onQty}
              onNote={onNote}
            />
          ))}
        </Lines>
        <TotalRow>
          <span>{t('basket.total')}</span>
          <span>{total}</span>
        </TotalRow>
        <SectionLabel id={labelId}>{t('basket.how')}</SectionLabel>
        <Track role="radiogroup" aria-labelledby={labelId}>
          {fulfilmentOptions(week).map((value) => (
            <Segment
              key={value}
              type="button"
              role="radio"
              aria-checked={fulfilment === value}
              onClick={() => onFulfilment(value)}
            >
              {t(`basket.${value}`)}
            </Segment>
          ))}
        </Track>
        {addressSlot ? (
          addressSlot
        ) : fulfilment === 'delivery' ? (
          <DeliveryNote>
            <MenuIcon name="chat" />
            <span>{t('basket.deliveryNote')}</span>
          </DeliveryNote>
        ) : null}
        {fulfilment === 'delivery' ? null : pickup ? (
          canChange ? (
            <PlaceButton type="button" onClick={onChangePlace}>
              <MenuIcon name="pin" size="1.5rem" />
              <PlaceText>
                <b>{pickup.place}</b>
                <small>{whenAndWhere(pickup, week.cookingDate, lang)}</small>
              </PlaceText>
              <ChangeText>
                {t('checkout.change')}
                <MenuIcon name="chevron" />
              </ChangeText>
            </PlaceButton>
          ) : (
            <PlaceRow>
              <MenuIcon name="pin" size="1.5rem" />
              <PlaceText>
                <b>{pickup.place}</b>
                <small>{whenAndWhere(pickup, week.cookingDate, lang)}</small>
              </PlaceText>
            </PlaceRow>
          )
        ) : null}
      </Body>
      <Footer>
        <MainButton type="button" disabled={closed !== null || addressBlocked} onClick={onNext}>
          {t('checkout.nextName')}
          <MenuIcon name="chevron" />
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}

/** "Your basket is empty" with a way back (never a blank page). */
export function EmptyBasketView({ onBack }: Readonly<{ onBack: () => void }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <CustomerPage title={t('basket.title')} backLabel={t('checkout.backDishes')} onBack={onBack}>
      <Quiet role="status">{t('basket.empty')}</Quiet>
      <Footer>
        <MainButton type="button" onClick={onBack}>
          {t('basket.backToMenu')}
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}
