import { memo, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Fulfilment, Language, Order, SellerMenuItemView } from '../../../shared/domain';
import { FIRST_NAME_MAX, LOW_STOCK, MAX_QTY, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { normaliseAuMobile } from '../../../shared/phone';
import { pickText } from '../../../shared/text';
import { Button, Segmented, Stepper, TextArea, TextField, type SegmentedOption } from '../../ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { SELLER_NS } from './i18n/register';
import { actorLabel, orderTotalCents, useLang } from './orderText';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectCookingDate, selectCreate, selectMenu } from './sellerOrdersSelectors';
import {
  createOrderRequested,
  createReset,
  menuRequested,
  pollingStarted,
  pollingStopped,
} from './sellerOrdersSlice';

export type NewOrderScreenProps = Readonly<{
  onBack: () => void;
  onDone: () => void;
  /** On a desktop the rail holds the one language switch. */
  hideLanguage?: boolean;
}>;

const Page = styled.main`
  max-width: min(100%, 45rem);
  margin: 0 auto;
  padding-bottom: ${({ theme }) => theme.spacing.xxl};
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;
const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Label = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.status.cancelled.fg};
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Names = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;
const Total = styled(Row)`
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const BigCode = styled.p`
  margin: 0;
  text-align: center;
  font-size: 2.125rem;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  letter-spacing: 0.04em;
`;
const Centre = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

type ItemLineProps = Readonly<{
  item: SellerMenuItemView;
  qty: number;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
}>;

const ItemLine = memo(function ItemLine({ item, qty, lang, onQty }: ItemLineProps) {
  const { t } = useTranslation(SELLER_NS);
  const onChange = useCallback((next: number) => onQty(item.id, next), [onQty, item.id]);
  const name = pickText(item.name, lang);
  const max = item.soldOut ? 0 : Math.min(item.remaining ?? MAX_QTY, MAX_QTY);
  const left = item.remaining ?? 0;
  const showLeft = item.remaining !== null && left > 0 && left <= LOW_STOCK;
  return (
    <Row>
      <Names>
        <Label>{name}</Label>
        <Muted>
          {formatMoney(item.priceCents, lang)}
          {showLeft ? ` · ${t('new.left', { count: left })}` : ''}
        </Muted>
      </Names>
      <Stepper
        value={qty}
        onChange={onChange}
        label={name}
        decreaseLabel={t('new.decrease', { name })}
        increaseLabel={t('new.increase', { name })}
        max={max}
      />
    </Row>
  );
});

type YesNo = 'yes' | 'no';

function errorKey(error: string): string {
  return error === 'sold_out' || error === 'exceeds_remaining' || error === 'ordering_closed'
    ? `new.error.${error}`
    : 'new.error.other';
}

function FormView() {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const create = useSelector(selectCreate);

  const [firstName, setFirstName] = useState('');
  const [customerLang, setCustomerLang] = useState<Language>('id');
  const [fulfilment, setFulfilment] = useState<Fulfilment>('pickup');
  const [qtys, setQtys] = useState<Readonly<Record<string, number>>>({});
  const [note, setNote] = useState('');
  const [confirmNow, setConfirmNow] = useState<YesNo>('yes');
  const [paid, setPaid] = useState<YesNo>('no');
  const [submitted, setSubmitted] = useState(false);

  const items = useMemo(() => (menu.status === 'ready' ? menu.items : []), [menu]);
  const lines = useMemo(
    () =>
      items
        .filter((item) => (qtys[item.id] ?? 0) > 0)
        .map((item) => ({ itemId: item.id, qty: qtys[item.id] ?? 0 })),
    [items, qtys],
  );
  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.priceCents * (qtys[item.id] ?? 0), 0),
    [items, qtys],
  );

  const langOptions = useMemo<Array<SegmentedOption<Language>>>(
    () => [
      { value: 'en', label: 'EN' },
      { value: 'id', label: 'ID' },
    ],
    [],
  );
  const fulfilmentOptions = useMemo<Array<SegmentedOption<Fulfilment>>>(
    () => [
      { value: 'pickup', label: t('fulfilment.pickup') },
      { value: 'delivery', label: t('fulfilment.delivery') },
    ],
    [t],
  );
  const yesNo = useMemo<Array<SegmentedOption<YesNo>>>(
    () => [
      { value: 'yes', label: t('new.yes') },
      { value: 'no', label: t('new.no') },
    ],
    [t],
  );

  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value),
    [],
  );
  const onNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );
  const onQty = useCallback(
    (itemId: string, qty: number) => setQtys((current) => ({ ...current, [itemId]: qty })),
    [],
  );
  const retryMenu = useCallback(() => dispatch(menuRequested()), [dispatch]);

  const nameMissing = firstName.trim() === '';
  const noItems = lines.length === 0;
  const saving = create.status === 'saving';
  const onCreate = useCallback(() => {
    setSubmitted(true);
    if (nameMissing || noItems) return;
    const trimmedNote = note.trim();
    dispatch(
      createOrderRequested({
        firstName: firstName.trim(),
        language: customerLang,
        lines,
        fulfilment,
        ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
        confirmNow: confirmNow === 'yes',
        paid: paid === 'yes',
      }),
    );
  }, [
    dispatch,
    nameMissing,
    noItems,
    note,
    firstName,
    customerLang,
    lines,
    fulfilment,
    confirmNow,
    paid,
  ]);

  return (
    <>
      <Section>
        <TextField
          label={t('new.name')}
          value={firstName}
          onChange={onName}
          maxLength={FIRST_NAME_MAX}
          autoComplete="off"
          {...(submitted && nameMissing ? { error: t('new.nameRequired') } : {})}
        />
        <Row>
          <Label>{t('new.language')}</Label>
          <Segmented
            options={langOptions}
            value={customerLang}
            onChange={setCustomerLang}
            label={t('new.language')}
          />
        </Row>
        <Row>
          <Label>{t('new.fulfilment')}</Label>
          <Segmented
            options={fulfilmentOptions}
            value={fulfilment}
            onChange={setFulfilment}
            label={t('new.fulfilment')}
          />
        </Row>
      </Section>
      <Section>
        <Label>{t('new.items')}</Label>
        {menu.status === 'loading' ? <Muted role="status">{t('new.loading')}</Muted> : null}
        {menu.status === 'error' ? (
          <>
            <ErrorText role="alert">{t('new.menuError')}</ErrorText>
            <div>
              <Button onClick={retryMenu}>{t('error.retry')}</Button>
            </div>
          </>
        ) : null}
        {items.map((item) => (
          <ItemLine key={item.id} item={item} qty={qtys[item.id] ?? 0} lang={lang} onQty={onQty} />
        ))}
        {submitted && noItems ? <ErrorText role="alert">{t('new.itemsRequired')}</ErrorText> : null}
        <Total>
          <span>{t('new.total')}</span>
          <span>{formatMoney(totalCents, lang)}</span>
        </Total>
      </Section>
      <Section>
        <TextArea
          label={t('new.note')}
          helper={t('new.noteHelper')}
          value={note}
          onChange={onNote}
          maxLength={NOTE_MAX}
          showCounter
        />
      </Section>
      <Section>
        <Row>
          <Label>{t('new.confirmNow')}</Label>
          <Segmented
            options={yesNo}
            value={confirmNow}
            onChange={setConfirmNow}
            label={t('new.confirmNow')}
          />
        </Row>
        <Row>
          <Label>{t('new.paid')}</Label>
          <Segmented options={yesNo} value={paid} onChange={setPaid} label={t('new.paid')} />
        </Row>
        {create.status === 'error' ? (
          <ErrorText role="alert">{t(errorKey(create.error))}</ErrorText>
        ) : null}
        <Button
          variant="primary"
          fullWidth
          disabled={saving || menu.status !== 'ready'}
          onClick={onCreate}
        >
          {t('new.create')}
        </Button>
      </Section>
    </>
  );
}

function SavedView({ order, onDone }: Readonly<{ order: Order; onDone: () => void }>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const lang = useLang();
  const cookingDate = useSelector(selectCookingDate);
  // Kept in this component only: the number is never saved or sent to the server (D-007).
  const [phone, setPhone] = useState('');
  const onPhone = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setPhone(event.target.value),
    [],
  );

  const digits = phone.trim() === '' ? null : normaliseAuMobile(phone);
  const invalid = phone.trim() !== '' && digits === null;
  const total = orderTotalCents(order);

  const onSend = useCallback(() => {
    // The message is in the customer's language, not the seller's.
    const fixed = i18n.getFixedT(order.language, SELLER_NS);
    const text = fixed('linkMsg', {
      name: order.firstName,
      code: formatOrderCode(order.code),
      items: order.lines
        .map((line) => `${line.qty}× ${pickText(line.name, order.language)}`)
        .join(', '),
      total: formatMoney(total, order.language),
      how: fixed(`fulfilment.${order.fulfilment}`),
      link: `${window.location.origin}/o/${order.token}`,
    });
    const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }, [i18n, order, digits, total]);

  const how = t(`fulfilment.${order.fulfilment}`);
  return (
    <>
      <Section>
        <Centre>
          <Muted>
            {t('new.savedSummary', {
              name: order.firstName,
              how: cookingDate !== null ? `${how} · ${formatDay(cookingDate, lang)}` : how,
            })}
          </Muted>
        </Centre>
        <BigCode>{formatOrderCode(order.code)}</BigCode>
      </Section>
      <Section>
        {order.lines.map((line) => (
          <Row key={line.itemId}>
            <span>
              {line.qty}× {pickText(line.name, lang)}
            </span>
            <strong>{formatMoney(line.priceCents * line.qty, lang)}</strong>
          </Row>
        ))}
        <Total>
          <span>{t('new.total')}</span>
          <span>{formatMoney(total, lang)}</span>
        </Total>
        <Muted>
          {t('new.status', { status: t(`status.${order.status}`) })}
          {order.enteredBy
            ? ` · ${t('orders.enteredBy', { name: actorLabel(order.enteredBy, t) })}`
            : ''}
        </Muted>
      </Section>
      <Section>
        <TextField
          label={t('new.whatsappLabel')}
          helper={t('new.whatsappHelper')}
          value={phone}
          onChange={onPhone}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          {...(invalid ? { error: t('new.whatsappInvalid') } : {})}
        />
        <Button variant="primary" fullWidth disabled={invalid} onClick={onSend}>
          {t('new.send')}
        </Button>
        <Button fullWidth onClick={onDone}>
          {t('new.done')}
        </Button>
      </Section>
    </>
  );
}

function NewOrderContent({ onBack, onDone, hideLanguage = false }: NewOrderScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const create = useSelector(selectCreate);

  useEffect(() => {
    dispatch(createReset());
    dispatch(menuRequested());
    // The cooking date for the saved screen comes from the list's poll.
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  const done = useCallback(() => {
    dispatch(createReset());
    onDone();
  }, [dispatch, onDone]);

  return (
    <Page>
      <Bar>
        {create.status === 'saved' ? (
          <Title>{t('new.saved')}</Title>
        ) : (
          <>
            <Button variant="quiet" onClick={onBack}>
              {t('new.back')}
            </Button>
            <Title>{t('new.title')}</Title>
          </>
        )}
        {hideLanguage ? null : <LanguageSwitch />}
      </Bar>
      {create.status === 'saved' ? <SavedView order={create.order} onDone={done} /> : <FormView />}
    </Page>
  );
}

export function NewOrderScreen(props: NewOrderScreenProps) {
  return (
    <ScreenErrorBoundary>
      <NewOrderContent {...props} />
    </ScreenErrorBoundary>
  );
}
