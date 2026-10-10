import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Fulfilment, Language, SellerMenuItemView } from '../../../shared/domain';
import { FIRST_NAME_MAX, LOW_STOCK, MAX_QTY, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { normaliseAuMobile } from '../../../shared/phone';
import { pickText } from '../../../shared/text';
import { currentSellerSlug } from '../../api/device/sellerContext';
import {
  Button,
  Icon,
  Segmented,
  Stepper,
  TextArea,
  TextField,
  type SegmentedOption,
} from '../../ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { ContactFields, saveContact } from './contacts';
import { FeedbackHost } from './FeedbackHost';
import { SELLER_NS } from './i18n/register';
import { useLang } from './orderText';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectCreate, selectCurrent, selectMenu } from './sellerOrdersSelectors';
import {
  createOrderRequested,
  createReset,
  currentRequested,
  menuRequested,
  pollingStarted,
  pollingStopped,
} from './sellerOrdersSlice';
import { openOrderLink } from './whatsappLink';

// New order on a phone (plan 001 stage 11; handoff, New order): the tablet slide-over's fields,
// full screen, plus the customer's number and delivery address. Those two are saved on this phone
// only (D-059) and are never part of the create request. "Create & send link on WhatsApp" is the
// main button; "Create only" is quiet.

export type NewOrderScreenProps = Readonly<{
  onBack: () => void;
  onDone: () => void;
  /** On a desktop the rail holds the one language switch. */
  hideLanguage?: boolean;
}>;

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.size.pagePadPhone}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Title = styled.h1`
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
`;
const Form = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Label = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Names = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const Select = styled.select`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Foot = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    calc(${({ theme }) => theme.spacing.sm} + env(safe-area-inset-bottom));
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};
`;
const Sum = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.c.muted};

  strong {
    color: ${({ theme }) => theme.c.text};
    font-variant-numeric: tabular-nums;
  }
`;
const Main = styled(Button)`
  min-height: ${({ theme }) => theme.size.mainAction + 4}px;
  font-size: 1rem;
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
  const left = item.remaining;
  const max = item.soldOut ? 0 : Math.min(left ?? MAX_QTY, MAX_QTY);
  const hint = item.soldOut
    ? t('newPanel.soldOut')
    : left !== null && left > 0 && left <= LOW_STOCK
      ? t('new.left', { count: left })
      : null;
  return (
    <Row>
      <Names>
        <span>{name}</span>
        <small>
          {formatMoney(item.priceCents, lang)}
          {hint ? ` · ${hint}` : ''}
        </small>
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

function FormView({ onDone }: Readonly<{ onDone: () => void }>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const create = useSelector(selectCreate);
  const current = useSelector(selectCurrent);

  const [firstName, setFirstName] = useState('');
  const [customerLang, setCustomerLang] = useState<Language>('id');
  const [how, setHow] = useState('pickup');
  const [qtys, setQtys] = useState<Readonly<Record<string, number>>>({});
  const [note, setNote] = useState('');
  const [confirmNow, setConfirmNow] = useState<YesNo>('yes');
  const [paid, setPaid] = useState<YesNo>('no');
  // Device only (D-059): kept here, saved on this phone once the order exists, never sent.
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // True after "Create & send link on WhatsApp": the saved order opens WhatsApp, then we leave.
  const sendAfter = useRef(false);

  const view = current.status === 'ready' ? current.view : null;
  const places = view?.pickupPoints ?? [];
  const deliveryOn = view?.menu.delivery.available === true;
  const items = useMemo(() => (menu.status === 'ready' ? menu.items : []), [menu]);
  const lines = useMemo(
    () =>
      items
        .filter((item) => (qtys[item.id] ?? 0) > 0)
        .map((item) => ({ itemId: item.id, qty: qtys[item.id] ?? 0 })),
    [items, qtys],
  );
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.priceCents * (qtys[item.id] ?? 0), 0),
    [items, qtys],
  );
  const langOptions = useMemo<Array<SegmentedOption<Language>>>(
    () => [
      { value: 'id', label: t('panel.langId') },
      { value: 'en', label: t('panel.langEn') },
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

  const digits = phone.trim() === '' ? null : normaliseAuMobile(phone);
  const phoneInvalid = phone.trim() !== '' && digits === null;
  const delivery = how === 'delivery';

  // Saved: keep the number and address on this phone, open WhatsApp if asked, then leave.
  useEffect(() => {
    if (create.status !== 'saved') return;
    saveContact(currentSellerSlug(), create.order.code, {
      phone,
      address: delivery ? address : '',
    });
    if (sendAfter.current) openOrderLink(i18n, create.order, digits);
    sendAfter.current = false;
    dispatch(createReset());
    onDone();
    // The fields are read once, at the moment the order is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create]);

  const nameMissing = firstName.trim() === '';
  const noItems = lines.length === 0;
  const saving = create.status === 'saving';
  const submit = useCallback(
    (send: boolean) => {
      setSubmitted(true);
      if (nameMissing || noItems || phoneInvalid) return;
      sendAfter.current = send;
      const fulfilment: Fulfilment = delivery ? 'delivery' : 'pickup';
      const placeId = how.startsWith('place:') ? how.slice('place:'.length) : undefined;
      const trimmedNote = note.trim();
      // The phone number and address are not part of the request (D-059).
      dispatch(
        createOrderRequested({
          firstName: firstName.trim(),
          language: customerLang,
          lines,
          fulfilment,
          ...(placeId ? { pickupPlaceId: placeId } : {}),
          ...(trimmedNote !== '' ? { note: trimmedNote } : {}),
          confirmNow: confirmNow === 'yes',
          paid: paid === 'yes',
        }),
      );
    },
    [
      dispatch,
      nameMissing,
      noItems,
      phoneInvalid,
      delivery,
      how,
      note,
      firstName,
      customerLang,
      lines,
      confirmNow,
      paid,
    ],
  );
  const onSend = useCallback(() => submit(true), [submit]);
  const onOnly = useCallback(() => submit(false), [submit]);
  const onQty = useCallback(
    (itemId: string, qty: number) => setQtys((old) => ({ ...old, [itemId]: qty })),
    [],
  );
  const retryMenu = useCallback(() => dispatch(menuRequested()), [dispatch]);
  const blocked = saving || menu.status !== 'ready';

  return (
    <>
      <Form>
        <TextField
          label={t('new.name')}
          value={firstName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value)}
          maxLength={FIRST_NAME_MAX}
          autoComplete="off"
          {...(submitted && nameMissing ? { error: t('new.nameRequired') } : {})}
        />
        <Field>
          <Label>{t('new.language')}</Label>
          <Segmented
            options={langOptions}
            value={customerLang}
            onChange={setCustomerLang}
            label={t('new.language')}
          />
        </Field>
        <Field>
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
            <ItemLine
              key={item.id}
              item={item}
              qty={qtys[item.id] ?? 0}
              lang={lang}
              onQty={onQty}
            />
          ))}
          {submitted && noItems ? (
            <ErrorText role="alert">{t('new.itemsRequired')}</ErrorText>
          ) : null}
        </Field>
        <Field>
          <Label as="label" htmlFor="new-order-how">
            {t('new.fulfilment')}
          </Label>
          <Select id="new-order-how" value={how} onChange={(event) => setHow(event.target.value)}>
            {places.length === 0 ? <option value="pickup">{t('fulfilment.pickup')}</option> : null}
            {places.map((place) => (
              <option key={place.id} value={`place:${place.id}`}>
                {t('fulfilment.pickup')} · {place.place} ({place.window.start}–{place.window.end})
              </option>
            ))}
            {deliveryOn ? <option value="delivery">{t('fulfilment.delivery')}</option> : null}
          </Select>
        </Field>
        <ContactFields
          phone={phone}
          address={address}
          onPhone={setPhone}
          onAddress={setAddress}
          phoneInvalid={submitted && phoneInvalid}
          showAddress={delivery}
        />
        <TextArea
          label={t('new.note')}
          helper={t('new.noteHelper')}
          value={note}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
          maxLength={NOTE_MAX}
          showCounter
        />
        <Field>
          <Row>
            <Label>{t('newPanel.confirmNow')}</Label>
            <Segmented
              options={yesNo}
              value={confirmNow}
              onChange={setConfirmNow}
              label={t('newPanel.confirmNow')}
            />
          </Row>
          <Row>
            <Label>{t('newPanel.alreadyPaid')}</Label>
            <Segmented
              options={yesNo}
              value={paid}
              onChange={setPaid}
              label={t('newPanel.alreadyPaid')}
            />
          </Row>
        </Field>
        {create.status === 'error' ? (
          <ErrorText role="alert">{t(errorKey(create.error))}</ErrorText>
        ) : null}
      </Form>
      <Foot>
        <Sum>
          <span>{t('phone.itemsCount', { count: itemCount })}</span>
          <strong>
            {t('new.total')} {formatMoney(totalCents, lang)}
          </strong>
        </Sum>
        <Main variant="primary" fullWidth disabled={blocked} onClick={onSend}>
          <Icon name="chat" />
          {t('newPanel.createSend')}
        </Main>
        <Button variant="quiet" fullWidth disabled={blocked} onClick={onOnly}>
          {t('newPanel.createOnly')}
        </Button>
      </Foot>
    </>
  );
}

function NewOrderContent({ onBack, onDone, hideLanguage = false }: NewOrderScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(createReset());
    dispatch(menuRequested());
    // The pickup places and the delivery switch come from the current menu.
    dispatch(currentRequested());
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  return (
    <Page>
      <FeedbackHost />
      <Bar>
        <Button variant="quiet" onClick={onBack}>
          {t('phone.cancel')}
        </Button>
        <Title>{t('new.title')}</Title>
        {hideLanguage ? <span /> : <LanguageSwitch />}
      </Bar>
      <FormView onDone={onDone} />
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
