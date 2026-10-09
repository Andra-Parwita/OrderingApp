import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Fulfilment, Language } from '../../../shared/domain';
import { FIRST_NAME_MAX, LOW_STOCK, MAX_QTY, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Segmented, SlideOverEditor, Stepper, TextArea, TextField, Button } from '../../ui';
import type { SegmentedOption } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { useLang } from './orderText';
import { openOrderLink } from './whatsappLink';
import { selectCreate, selectCurrent, selectMenu } from './sellerOrdersSelectors';
import { createOrderRequested, createReset, menuRequested } from './sellerOrdersSlice';

// New order on tablet and desktop (D-069 Q6): a 560 px slide-over with the phone form's fields.
// D-059: no phone or address fields here; the phone views keep those on the seller's phone only.

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
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
const Total = styled(Row)`
  border-bottom: 0;
  font-weight: 700;
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
const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

type YesNo = 'yes' | 'no';

function errorKey(error: string): string {
  return error === 'sold_out' || error === 'exceeds_remaining' || error === 'ordering_closed'
    ? `new.error.${error}`
    : 'new.error.other';
}

export type NewOrderPanelProps = Readonly<{ onClose: () => void }>;

export function NewOrderPanel({ onClose }: NewOrderPanelProps) {
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
  const [submitted, setSubmitted] = useState(false);
  // True after "Create & send link on WhatsApp": the saved order opens WhatsApp, then the panel closes.
  const sendAfter = useRef(false);

  useEffect(() => {
    dispatch(createReset());
    dispatch(menuRequested());
  }, [dispatch]);

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
  const yesNo = useMemo<Array<SegmentedOption<YesNo>>>(
    () => [
      { value: 'yes', label: t('new.yes') },
      { value: 'no', label: t('new.no') },
    ],
    [t],
  );

  // Done: send the link if asked, then close.
  useEffect(() => {
    if (create.status !== 'saved') return;
    if (sendAfter.current) openOrderLink(i18n, create.order);
    sendAfter.current = false;
    dispatch(createReset());
    onClose();
  }, [create, dispatch, i18n, onClose]);

  const nameMissing = firstName.trim() === '';
  const noItems = lines.length === 0;
  const submit = useCallback(
    (send: boolean) => {
      setSubmitted(true);
      if (nameMissing || noItems) return;
      sendAfter.current = send;
      const fulfilment: Fulfilment = how === 'delivery' ? 'delivery' : 'pickup';
      const placeId = how.startsWith('place:') ? how.slice('place:'.length) : undefined;
      const trimmedNote = note.trim();
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
    [dispatch, nameMissing, noItems, how, note, firstName, customerLang, lines, confirmNow, paid],
  );
  const onSend = useCallback(() => submit(true), [submit]);
  const onOnly = useCallback(() => submit(false), [submit]);
  const retryMenu = useCallback(() => dispatch(menuRequested()), [dispatch]);

  const dirty = firstName !== '' || note !== '' || lines.length > 0;
  const saving = create.status === 'saving';
  return (
    <SlideOverEditor
      title={t('newPanel.title')}
      dirty={dirty}
      saveLabel={t('newPanel.createSend')}
      saving={saving || menu.status !== 'ready'}
      onCancel={onClose}
      onSave={onSend}
      secondaryAction={{
        label: t('newPanel.createOnly'),
        disabled: saving || menu.status !== 'ready',
        onClick: onOnly,
      }}
    >
      <Form>
        <TextField
          label={t('new.name')}
          value={firstName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value)}
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
          {items.map((item) => {
            const name = pickText(item.name, lang);
            const left = item.remaining;
            const max = item.soldOut ? 0 : Math.min(left ?? MAX_QTY, MAX_QTY);
            const hint = item.soldOut
              ? t('newPanel.soldOut')
              : left !== null && left > 0 && left <= LOW_STOCK
                ? t('new.left', { count: left })
                : null;
            return (
              <Row key={item.id}>
                <Names>
                  <span>{name}</span>
                  <small>
                    {formatMoney(item.priceCents, lang)}
                    {hint ? ` · ${hint}` : ''}
                  </small>
                </Names>
                <Stepper
                  value={qtys[item.id] ?? 0}
                  onChange={(next: number) => setQtys((old) => ({ ...old, [item.id]: next }))}
                  label={name}
                  decreaseLabel={t('new.decrease', { name })}
                  increaseLabel={t('new.increase', { name })}
                  max={max}
                />
              </Row>
            );
          })}
          {submitted && noItems ? (
            <ErrorText role="alert">{t('new.itemsRequired')}</ErrorText>
          ) : null}
          <Total>
            <span>{t('new.total')}</span>
            <span>{formatMoney(totalCents, lang)}</span>
          </Total>
        </Field>
        <Field>
          <Label as="label" htmlFor="new-order-how">
            {t('newPanel.pickupPlace')}
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
    </SlideOverEditor>
  );
}
