import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Fulfilment, Language } from '../../../shared/domain';
import { LOW_STOCK, MAX_QTY } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { DRAFT_NS, DraftNotice } from '../../components/draft';
import { Segmented, SlideOverEditor, Stepper, Button } from '../../ui';
import type { SegmentedOption } from '../../ui';
import { SELLER_NS } from './i18n/register';
import {
  ErrorText,
  Field,
  Label,
  LineNoteField,
  Muted,
  NameField,
  NoteField,
  Names,
  Row,
  Select,
} from './orderFormParts';
import { useLang } from './orderText';
import { pickableItems } from './pickItems';
import { useOrderDraft, type YesNo } from './useOrderDraft';
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
const Total = styled(Row)`
  border-bottom: 0;
  font-weight: 700;
`;

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

  const ids = useMemo(() => (menu.status === 'ready' ? menu.items.map((i) => i.id) : null), [menu]);
  // Plan 061: what is typed survives a reload or a closed panel, until Create or Discard.
  const form = useOrderDraft(ids);
  const { firstName, customerLang, how, qtys, note, confirmNow, paid } = form.values;
  const setFirstName = (v: string) => form.set('firstName', v);
  const setCustomerLang = (v: Language) => form.set('customerLang', v);
  const setHow = (v: string) => form.set('how', v);
  const setNote = (v: string) => form.set('note', v);
  const setConfirmNow = (v: YesNo) => form.set('confirmNow', v);
  const setPaid = (v: YesNo) => form.set('paid', v);
  const { t: tDraft } = useTranslation(DRAFT_NS);
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
  const items = useMemo(() => (menu.status === 'ready' ? pickableItems(menu.items) : []), [menu]);
  const { lineNotes } = form.values;
  const lines = useMemo(
    () =>
      items
        .filter((item) => (qtys[item.id] ?? 0) > 0)
        .map((item) => {
          const lineNote = lineNotes?.[item.id]?.trim();
          return {
            itemId: item.id,
            qty: qtys[item.id] ?? 0,
            ...(lineNote ? { note: lineNote } : {}),
          };
        }),
    [items, qtys, lineNotes],
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
    form.draft.clear();
    dispatch(createReset());
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const dirty = form.dirty;
  const saving = create.status === 'saving';
  return (
    <SlideOverEditor
      title={t('newPanel.title')}
      dirty={dirty}
      saveLabel={t('newPanel.createSend')}
      saving={saving || menu.status !== 'ready'}
      onCancel={onClose}
      onDiscard={() => {
        form.draft.discard();
        onClose();
      }}
      keepDraftLabel={tDraft('keepDraft')}
      onSave={onSend}
      secondaryAction={{
        label: t('newPanel.createOnly'),
        disabled: saving || menu.status !== 'ready',
        onClick: onOnly,
      }}
    >
      <Form>
        <DraftNotice draft={form.draft} />
        {form.dropped ? <Muted role="status">{tDraft('droppedDishes')}</Muted> : null}
        <NameField
          value={firstName}
          onChange={setFirstName}
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
              <Fragment key={item.id}>
                <Row>
                  <Names>
                    <span>{name}</span>
                    <small>
                      {formatMoney(item.priceCents, lang)}
                      {hint ? ` · ${hint}` : ''}
                    </small>
                  </Names>
                  <Stepper
                    value={qtys[item.id] ?? 0}
                    onChange={(next: number) => form.setQty(item.id, next)}
                    label={name}
                    decreaseLabel={t('new.decrease', { name })}
                    increaseLabel={t('new.increase', { name })}
                    max={max}
                  />
                </Row>
                {(qtys[item.id] ?? 0) > 0 ? (
                  <LineNoteField
                    name={name}
                    value={lineNotes?.[item.id] ?? ''}
                    onChange={(next) => form.setLineNote(item.id, next)}
                  />
                ) : null}
              </Fragment>
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
        <NoteField value={note} onChange={setNote} />
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
