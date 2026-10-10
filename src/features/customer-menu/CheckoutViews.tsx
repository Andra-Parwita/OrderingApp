import { memo, useCallback, useId, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css, keyframes, styled } from 'styled-components';
import type { Fulfilment, Language, PickupPoint } from '../../../shared/domain';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { FIRST_NAME_MAX, MAX_QTY, NOTE_MAX } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { CustomerPage } from '../../components/CustomerPage';
import { Group, Qty, Round } from './DishesView';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { MainButton } from './menuParts';
import type { BasketNotice } from './customerSlice';
import type { BasketLine } from './selectors';

// The three checkout pages (spec §4.2): basket, pickup place, your name. Presentational: the routed
// screen (BasketScreen) and the fixtures page both feed them; nothing here fetches or navigates.

const Body = styled.div`
  /* Room for the pinned footer. */
  padding-bottom: calc(10rem + var(--sab));
`;
const Footer = styled.div`
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
const FooterNote = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const spin = keyframes`
  to { transform: rotate(360deg); }
`;
const Spinner = styled.span`
  width: 1.1rem;
  height: 1.1rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.9s linear infinite;
`;

// ---- Banners ----

const Banner = styled.section`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0 ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.4;

  svg {
    margin-top: 0.125rem;
    color: ${({ theme }) => theme.c.warn};
  }
  b {
    font-weight: 700;
  }
`;

function AlertBanner({ lead, rest }: Readonly<{ lead: string; rest: string }>) {
  return (
    <Banner role="alert">
      <MenuIcon name="warning" />
      <p style={{ margin: 0 }}>
        <b>{lead}</b> {rest}
      </p>
    </Banner>
  );
}

// ---- Basket ----

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

/** What the pickup place row shows: where, and when. */
function whenAndWhere(point: PickupPoint, cookingDate: string, lang: Language): string {
  return `${formatCookingDate(cookingDate, lang)} · ${formatWindow(point.window.start, point.window.end, lang)}`;
}

type LineProps = Readonly<{
  line: BasketLine;
  lang: Language;
  /** The only line of an order being changed: it cannot be taken out (cancel the order instead). */
  locked: boolean;
  onQty: (itemId: string, qty: number) => void;
}>;

const BasketLineRow = memo(function BasketLineRow({ line, lang, locked, onQty }: LineProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { item, qty, lineCents } = line;
  const name = pickText(item.name, lang);
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
      </LineText>
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
  onQty: (itemId: string, qty: number) => void;
  onFulfilment: (value: Fulfilment) => void;
  onChangePlace: () => void;
  onNext: () => void;
  onBack: () => void;
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
  onQty,
  onFulfilment,
  onChangePlace,
  onNext,
  onBack,
}: BasketProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen, week, seller } = data;
  const cook = seller.name || t('states.theSeller');
  const total = formatMoney(totalCents, lang);
  const points = week.pickupPoints;
  const pickup = points.find((point) => point.id === pickupId) ?? points[0];
  const delivery = week.delivery.available;
  const canChange = !editing && points.length > 1;
  const labelId = useId();
  return (
    <CustomerPage
      title={editing ? t('basket.editTitle') : t('basket.title')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage ?? undefined}
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
              onQty={onQty}
            />
          ))}
        </Lines>
        <TotalRow>
          <span>{t('basket.total')}</span>
          <span>{total}</span>
        </TotalRow>
        <SectionLabel id={labelId}>{t('basket.how')}</SectionLabel>
        <Track role="radiogroup" aria-labelledby={labelId}>
          {(delivery ? (['pickup', 'delivery'] as const) : (['pickup'] as const)).map((value) => (
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
        {fulfilment === 'delivery' ? (
          <DeliveryNote>
            <MenuIcon name="chat" />
            <span>{t('basket.deliveryNote')}</span>
          </DeliveryNote>
        ) : pickup ? (
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
        <MainButton type="button" disabled={closed !== null} onClick={onNext}>
          {t('checkout.nextName')}
          <MenuIcon name="chevron" />
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}

/** "Your basket is empty" with a way back (never a blank page). */
export function EmptyBasketView({
  data,
  onBack,
}: Readonly<{ data: MenuResponse; onBack: () => void }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen } = data;
  return (
    <CustomerPage
      title={t('basket.title')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage ?? undefined}
      backLabel={t('checkout.backDishes')}
      onBack={onBack}
    >
      <Quiet role="status">{t('basket.empty')}</Quiet>
      <Footer>
        <MainButton type="button" onClick={onBack}>
          {t('basket.backToMenu')}
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}

// ---- Pickup place ----

const Sub = styled.p`
  margin: -${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;
const Options = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Option = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;
const Choice = styled.label`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;
  cursor: pointer;
`;
const RadioInput = styled.input`
  position: absolute;
  width: ${({ theme }) => theme.border.hairline};
  height: ${({ theme }) => theme.border.hairline};
  opacity: 0;
`;
const RadioMark = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 50%;

  ${RadioInput}:checked + & {
    border-color: ${({ theme }) => theme.c.fill};
  }
  ${RadioInput}:checked + &::after {
    content: '';
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.fill};
  }
  ${RadioInput}:focus-visible + & {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const OptionText = styled.span`
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
const DirectionsLink = styled.a`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.atext};
`;

type PickupProps = Readonly<{
  data: MenuResponse;
  lang: Language;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onDone: () => void;
  onBack: () => void;
}>;

export function PickupPlaceView({ data, lang, selectedId, onSelect, onDone, onBack }: PickupProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen, week } = data;
  const groupName = useId();
  return (
    <CustomerPage
      title={t('checkout.pickupTitle')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage ?? undefined}
      backLabel={t('checkout.backBasket')}
      onBack={onBack}
    >
      <Body>
        <Sub>{t('checkout.pickupSub', { date: formatCookingDate(week.cookingDate, lang) })}</Sub>
        <Options role="radiogroup" aria-label={t('checkout.pickupTitle')}>
          {week.pickupPoints.slice(0, 5).map((point) => (
            <Option key={point.id}>
              <Choice>
                <RadioInput
                  type="radio"
                  name={groupName}
                  checked={point.id === selectedId}
                  onChange={() => onSelect(point.id)}
                />
                <RadioMark aria-hidden="true" />
                <OptionText>
                  <b>{point.place}</b>
                  <small>
                    {formatWindow(point.window.start, point.window.end, lang)} ·{' '}
                    {pickText(point.directions, lang)}
                  </small>
                </OptionText>
              </Choice>
              <DirectionsLink
                href={`https://maps.google.com/?q=${encodeURIComponent(point.place)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('checkout.directions', { place: point.place })}
              >
                <MenuIcon name="navigate" />
              </DirectionsLink>
            </Option>
          ))}
        </Options>
      </Body>
      <Footer>
        <MainButton type="button" onClick={onDone}>
          {t('checkout.done')}
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}

// ---- Your name ----

const Form = styled.form<{ $busy: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  opacity: ${({ $busy }) => ($busy ? 0.55 : 1)};
`;
const FieldBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Label = styled.label`
  font-weight: 700;

  span {
    color: ${({ theme }) => theme.c.muted};
    font-weight: 400;
  }
`;
const inputStyle = `
  box-sizing: border-box;
  width: 100%;
  padding: 0 0.875rem;
  font: inherit;
  font-size: 1rem;
`;
const Input = styled.input`
  ${inputStyle}
  min-height: 3rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus-visible {
    border-color: ${({ theme }) => theme.c.fill};
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
  &[readonly] {
    background: ${({ theme }) => theme.c.surf2};
    color: ${({ theme }) => theme.c.muted};
  }
  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.c.danger};
  }
`;
const Area = styled.textarea`
  ${inputStyle}
  min-height: 5.75rem;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  resize: none;

  &:focus-visible {
    border-color: ${({ theme }) => theme.c.fill};
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const HelpRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};

  output {
    flex: none;
    font-variant-numeric: tabular-nums;
  }
`;
const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 600;
`;
const Summary = styled.dl`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  dt {
    color: ${({ theme }) => theme.c.muted};
  }
  dd {
    margin: 0;
  }
  dd.strong {
    font-weight: 700;
  }
`;
const FailureText = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
`;

function Field({
  label,
  optional,
  help,
  counter,
  error,
  children,
  htmlFor,
}: Readonly<{
  label: string;
  optional?: string;
  help: string;
  counter?: string;
  error?: string | undefined;
  htmlFor: string;
  children: ReactNode;
}>) {
  return (
    <FieldBox>
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span> {optional}</span> : null}
      </Label>
      {children}
      <HelpRow>
        <span>{help}</span>
        {counter ? <output>{counter}</output> : null}
      </HelpRow>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </FieldBox>
  );
}

type NameProps = Readonly<{
  data: MenuResponse;
  lang: Language;
  editing: boolean;
  firstName: string;
  note: string;
  nameError?: string | undefined;
  /** A plain-words failure shown above the form (anything that is not about the basket). */
  failure?: string | undefined;
  count: number;
  totalCents: number;
  fulfilment: Fulfilment;
  pickupId: string | undefined;
  placing: boolean;
  onFirstName: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}>;

export function YourNameView({
  data,
  lang,
  editing,
  firstName,
  note,
  nameError,
  failure,
  count,
  totalCents,
  fulfilment,
  pickupId,
  placing,
  onFirstName,
  onNote,
  onSubmit,
  onBack,
}: NameProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen, week } = data;
  const nameId = useId();
  const noteId = useId();
  const pickup = week.pickupPoints.find((point) => point.id === pickupId) ?? week.pickupPoints[0];
  const total = formatMoney(totalCents, lang);
  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onFirstName(event.target.value),
    [onFirstName],
  );
  const onNoteChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => onNote(event.target.value),
    [onNote],
  );
  const submit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      if (!placing) onSubmit();
    },
    [onSubmit, placing],
  );
  return (
    <CustomerPage
      title={editing ? t('basket.editTitle') : t('checkout.nameTitle')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage ?? undefined}
      backLabel={t('checkout.backBasket')}
      onBack={onBack}
    >
      <Body>
        <Form id="your-name-form" onSubmit={submit} $busy={placing} aria-busy={placing} noValidate>
          {failure ? <FailureText role="alert">{failure}</FailureText> : null}
          <Field
            label={t('checkout.firstName')}
            help={editing ? t('basket.editOnly') : t('basket.firstNameHelper')}
            error={nameError}
            htmlFor={nameId}
          >
            <Input
              id={nameId}
              value={firstName}
              onChange={onName}
              maxLength={FIRST_NAME_MAX}
              autoComplete="given-name"
              readOnly={editing}
              disabled={placing}
              required={!editing}
              aria-invalid={nameError ? true : undefined}
            />
          </Field>
          <Field
            label={t('checkout.note')}
            optional={t('checkout.optional')}
            help={t('checkout.noteHelp')}
            counter={`${String(note.length)}/${String(NOTE_MAX)}`}
            htmlFor={noteId}
          >
            <Area
              id={noteId}
              value={note}
              onChange={onNoteChange}
              maxLength={NOTE_MAX}
              disabled={placing}
            />
          </Field>
          <Summary>
            <dt>{t('menu.items', { count })}</dt>
            <dd className="strong">{total}</dd>
            <dt>{t(`basket.${fulfilment}`)}</dt>
            <dd>
              {fulfilment === 'delivery'
                ? t('checkout.deliveryShort')
                : pickup
                  ? `${pickup.place} · ${formatWindow(pickup.window.start, pickup.window.end, lang)}`
                  : ''}
            </dd>
          </Summary>
        </Form>
      </Body>
      <Footer>
        <FooterNote>
          {t('checkout.changeUntil', { when: formatCutoff(week.cutoffAt, lang) })}
        </FooterNote>
        <MainButton type="submit" form="your-name-form" disabled={placing}>
          {placing ? (
            <>
              <Spinner aria-hidden="true" />
              {t(editing ? 'basket.updating' : 'basket.placing')}
            </>
          ) : (
            t(editing ? 'basket.update' : 'basket.place', { total })
          )}
        </MainButton>
      </Footer>
    </CustomerPage>
  );
}
