import { useCallback, useId, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Fulfilment, Language } from '../../../shared/domain';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { YourTime } from '../../components/YourTime';
import { FIRST_NAME_MAX, NOTE_MAX } from '../../../shared/limits';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { CustomerPage } from '../../components/CustomerPage';
import { RememberMeTick } from '../../components/remember-me';
import { Body, Footer, FooterNote, Spinner } from './CheckoutViews';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { MainButton } from './menuParts';

// The pickup-place and your-name checkout pages (spec §4.2), split from CheckoutViews.tsx.

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
  const { week } = data;
  const groupName = useId();
  return (
    <CustomerPage
      title={t('checkout.pickupTitle')}
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
                    {formatWindow(point.window.start, point.window.end, lang, week.cookingDate)} ·{' '}
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
export const Input = styled.input`
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
export const Area = styled.textarea`
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

export function Field({
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
  /** Plan 071: a delivery address is needed and not complete yet. */
  addressBlocked?: boolean;
  /** Plan 071: the address, as one line, when one will be sent. */
  addressLine?: string | undefined;
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
  addressBlocked = false,
  addressLine,
  onFirstName,
  onNote,
  onSubmit,
  onBack,
}: NameProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { week } = data;
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
          {editing ? null : <RememberMeTick />}
          <Field
            label={t('checkout.note')}
            optional={t('checkout.optional')}
            help={t(
              data.addresses && fulfilment === 'delivery'
                ? 'checkout.noteHelpAddress'
                : 'checkout.noteHelp',
            )}
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
                ? (addressLine ?? t('checkout.deliveryShort'))
                : pickup
                  ? `${pickup.place} · ${formatWindow(pickup.window.start, pickup.window.end, lang, week.cookingDate)}`
                  : ''}
            </dd>
          </Summary>
        </Form>
      </Body>
      <Footer>
        <FooterNote>
          {t('checkout.changeUntil', { when: formatCutoff(week.cutoffAt, lang) })}
          <YourTime label={t('home.yourTime')} />
        </FooterNote>
        <MainButton type="submit" form="your-name-form" disabled={placing || addressBlocked}>
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
