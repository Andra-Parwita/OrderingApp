import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { localDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { MAX_MENU_ITEMS, MAX_QTY } from '../../../shared/limits';
import type { Dish } from '../../../shared/menusContract';
import { formatMoney } from '../../../shared/money';
import { priceInputOf } from '../../../shared/priceInput';
import { deviceZone } from '../../../shared/zone';
import { Button, Icon, PageHeader, Segmented, Stepper, TextArea, TextField } from '../../ui';
import { PRIVATE_NS } from './i18n/register';
import type { PrivateMenuData, PrivateMenuSlots } from './slots';
import {
  createRequestOf,
  draftErrors,
  draftLineCents,
  draftOf,
  draftStillToPay,
  draftTotalCents,
  emptyDraft,
  updateRequestOf,
  type DraftError,
  type PrivateDraft,
} from './model';
import { Card, ErrorLine, Muted, Page, useLang } from './privateShared';
import {
  actionCleared,
  detailClosed,
  detailOpened,
  saveRequested,
  type PrivateRootState,
} from './privateSlice';
import { usePrivatePolling } from './usePrivateDue';

// Plan 081: make or edit a private order (owners only). Dishes come from the dish library with a
// quantity and a price for this order; "New dish" saves to the library; payment is Paid / Not paid
// plus an optional deposit, with what is still to pay worked out.

const Section = styled.h2`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: 0.9375rem;

  &:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Label = styled.span`
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-size: 0.8125rem;
  font-weight: 600;
`;
const Select = styled.select`
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Chosen = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.tint};

  .price {
    width: 7rem;
  }
  .sum {
    margin-left: auto;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`;
const Row = styled.div<{ $tone?: 'warn' | 'ok' | 'plain' }>`
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tone }) =>
    $tone === 'warn' ? theme.c.warn : $tone === 'ok' ? theme.c.atext : theme.c.text};
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`;

function EditorForm({
  data,
  initial,
  code,
  menu,
}: Readonly<{
  data: PrivateMenuData;
  initial: PrivateDraft;
  code: string | null;
  menu: PrivateMenuSlots;
}>) {
  const { t } = useTranslation(PRIVATE_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const action = useSelector((state: PrivateRootState) => state.sellerPrivate.action);
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const tools = menu.useDishTools((dishId) => setAwaiting(dishId));
  const errors = draftErrors(draft);
  const err = (key: DraftError) =>
    submitted && errors[key] ? t(`editor.errors.${key}`) : undefined;
  const set = <K extends keyof PrivateDraft>(key: K, value: PrivateDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const saving = action.status === 'saving';

  // A dish made here is saved to the library; once the library has it, it joins this order.
  const awaited =
    awaiting === null ? undefined : data.dishes.find((candidate) => candidate.id === awaiting);
  if (awaited) {
    setAwaiting(null);
    setDraft((previous) =>
      previous.lines.some((line) => line.dishId === awaited.id) ||
      previous.lines.length >= MAX_MENU_ITEMS
        ? previous
        : {
            ...previous,
            lines: [
              ...previous.lines,
              { dishId: awaited.id, qty: 1, price: priceInputOf(awaited.priceCents) },
            ],
          },
    );
  }

  // Saved: on to the order.
  useEffect(() => {
    if (action.status === 'done' && action.kind === 'save') {
      dispatch(actionCleared());
      void navigate(`/seller/private/${action.order.code}`, { replace: true });
    }
  }, [action, dispatch, navigate]);
  useEffect(
    () => () => {
      dispatch(actionCleared());
    },
    [dispatch],
  );

  const toggle = (dish: Dish) =>
    setDraft((previous) =>
      previous.lines.some((line) => line.dishId === dish.id)
        ? { ...previous, lines: previous.lines.filter((line) => line.dishId !== dish.id) }
        : {
            ...previous,
            lines: [
              ...previous.lines,
              { dishId: dish.id, qty: 1, price: priceInputOf(dish.priceCents) },
            ],
          },
    );
  const setLine = (dishId: string, change: { qty?: number; price?: string }) =>
    setDraft((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => (line.dishId === dishId ? { ...line, ...change } : line)),
    }));

  const save = () => {
    setSubmitted(true);
    const request = code === null ? createRequestOf(draft) : updateRequestOf(draft);
    if (!request) return;
    dispatch(saveRequested({ code, request }));
  };

  const total = draftTotalCents(draft);
  const still = draftStillToPay(draft);
  const back = () => void navigate(code === null ? '/seller/private' : `/seller/private/${code}`);
  const languages: ReadonlyArray<{ value: Language; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Indonesia' },
  ];

  return (
    <>
      <PageHeader
        title={t(code === null ? 'editor.titleNew' : 'editor.titleEdit')}
        backLabel={t('back')}
        onBack={back}
      />
      <Page>
        <Card
          as="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Section>{t('editor.when')}</Section>
          <Two>
            <TextField
              label={t('editor.date')}
              type="date"
              value={draft.eventDate}
              onChange={(event) => set('eventDate', event.target.value)}
              {...(err('date') ? { error: err('date') } : {})}
            />
            <TextField
              label={`${t('editor.time')} ${t('editor.optional')}`}
              type="time"
              value={draft.eventTime}
              onChange={(event) => set('eventTime', event.target.value)}
              {...(err('time') ? { error: err('time') } : {})}
            />
          </Two>
          <div>
            <Label>{t('editor.how')}</Label>
            <Segmented
              options={[
                { value: 'pickup', label: t('pickup') },
                { value: 'delivery', label: t('delivery') },
              ]}
              value={draft.fulfilment}
              onChange={(next) => set('fulfilment', next)}
              label={t('editor.how')}
            />
          </div>
          {draft.fulfilment === 'pickup' ? (
            <div>
              <Label as="label" htmlFor="private-place">
                {t('editor.place')}
              </Label>
              <Select
                id="private-place"
                value={draft.pickupPlaceId}
                onChange={(event) => set('pickupPlaceId', event.target.value)}
              >
                {data.places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.place}
                  </option>
                ))}
              </Select>
              {err('place') ? <ErrorLine role="alert">{err('place')}</ErrorLine> : null}
            </div>
          ) : (
            <>
              <TextField
                label={t('editor.street')}
                value={draft.street}
                autoComplete="off"
                onChange={(event) => set('street', event.target.value)}
                {...(err('street') ? { error: err('street') } : {})}
              />
              <Two>
                <TextField
                  label={`${t('editor.suburb')} ${t('editor.optional')}`}
                  value={draft.suburb}
                  autoComplete="off"
                  onChange={(event) => set('suburb', event.target.value)}
                />
                <TextField
                  label={`${t('editor.postcode')} ${t('editor.optional')}`}
                  value={draft.postcode}
                  autoComplete="off"
                  inputMode="numeric"
                  onChange={(event) => set('postcode', event.target.value)}
                />
              </Two>
              <TextField
                label={`${t('editor.addressNotes')} ${t('editor.optional')}`}
                value={draft.addressNotes}
                autoComplete="off"
                onChange={(event) => set('addressNotes', event.target.value)}
              />
              <Muted>
                <Icon name="lock" /> {t('editor.addressPrivacy')}
              </Muted>
            </>
          )}

          <Section>{t('editor.customer')}</Section>
          <TextField
            label={t('editor.name')}
            value={draft.firstName}
            autoComplete="off"
            maxLength={40}
            onChange={(event) => set('firstName', event.target.value)}
            {...(err('name') ? { error: err('name') } : {})}
          />
          <div>
            <Label>{t('editor.language')}</Label>
            <Segmented
              options={languages}
              value={draft.language}
              onChange={(next) => set('language', next)}
              label={t('editor.language')}
              compact
            />
          </div>
          <TextArea
            label={`${t('editor.note')} ${t('editor.optional')}`}
            value={draft.note}
            maxLength={200}
            onChange={(event) => set('note', event.target.value)}
            {...(err('note') ? { error: err('note') } : {})}
          />

          <Section>{t('editor.dishes')}</Section>
          <Muted>{t('editor.dishesHelp')}</Muted>
          {tools.picker({
            dishes: data.dishes,
            lang,
            selected: draft.lines.map((line) => line.dishId),
            full: draft.lines.length >= MAX_MENU_ITEMS,
            onToggle: toggle,
            renderSelected: (dish) => {
              const line = draft.lines.find((candidate) => candidate.dishId === dish.id);
              if (!line) return null;
              const name = dish.name[lang] || dish.name.en;
              return (
                <Chosen>
                  <Stepper
                    value={line.qty}
                    min={1}
                    max={MAX_QTY}
                    label={t('editor.qtyOf', { name })}
                    decreaseLabel={t('editor.less', { name })}
                    increaseLabel={t('editor.more', { name })}
                    onChange={(qty) => setLine(dish.id, { qty })}
                  />
                  <div className="price">
                    <TextField
                      label={t('editor.price')}
                      aria-label={t('editor.priceOf', { name })}
                      inputMode="decimal"
                      value={line.price}
                      onChange={(event) => setLine(dish.id, { price: event.target.value })}
                    />
                  </div>
                  <span className="sum">{formatMoney(draftLineCents(line), lang)}</span>
                </Chosen>
              );
            },
          })}
          <Muted>{t('editor.newDishNote')}</Muted>
          {err('lines') ? <ErrorLine role="alert">{err('lines')}</ErrorLine> : null}
          {err('price') ? <ErrorLine role="alert">{err('price')}</ErrorLine> : null}
          <Row>
            <span>{t('editor.total')}</span>
            <span>{formatMoney(total, lang)}</span>
          </Row>

          <Section>{t('editor.payment')}</Section>
          <Segmented
            options={[
              { value: 'unpaid', label: t('editor.notPaid') },
              { value: 'paid', label: t('editor.paid') },
            ]}
            value={draft.paid ? 'paid' : 'unpaid'}
            onChange={(next) => set('paid', next === 'paid')}
            label={t('editor.payment')}
          />
          {draft.paid ? null : (
            <TextField
              label={`${t('editor.deposit')} ${t('editor.optional')}`}
              inputMode="decimal"
              placeholder="0.00"
              value={draft.deposit}
              onChange={(event) => set('deposit', event.target.value)}
              {...(err('deposit') || err('depositOver')
                ? { error: err('deposit') ?? err('depositOver') }
                : {})}
            />
          )}
          <Row $tone={still > 0 ? 'warn' : 'ok'}>
            <span>{still > 0 ? t('editor.still') : t('editor.nothingToPay')}</span>
            <span>{formatMoney(still, lang)}</span>
          </Row>
          <Muted>{t('editor.paymentHelp')}</Muted>

          {action.status === 'error' ? (
            <ErrorLine role="alert">{t('editor.saveError')}</ErrorLine>
          ) : null}
          <Actions>
            <Button variant="primary" type="submit" fullWidth disabled={saving}>
              {saving ? t('editor.saving') : t('editor.save')}
            </Button>
            <Button type="button" fullWidth onClick={back}>
              {t('editor.cancel')}
            </Button>
          </Actions>
          <Muted>
            <Icon name="lock" /> {t('editor.ownerOnly')}
          </Muted>
        </Card>
      </Page>
      {tools.editor}
    </>
  );
}

/** `code` null makes a new order; a code edits that one. Owners only (the route says so too). */
export function PrivateEditorScreen({
  code,
  menu,
}: Readonly<{ code: string | null; menu: PrivateMenuSlots }>) {
  const { t } = useTranslation(PRIVATE_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const { data, status } = menu.useMenuData();
  const detail = useSelector((state: PrivateRootState) => state.sellerPrivate.detail);
  usePrivatePolling();
  useEffect(() => {
    if (code === null) return undefined;
    dispatch(detailOpened(code));
    return () => {
      dispatch(detailClosed());
    };
  }, [dispatch, code]);

  const order = code !== null && detail && detail.code === code ? detail : null;
  const ready = data !== null && (code === null || order !== null);
  const loading = (
    <>
      <PageHeader title={t(code === null ? 'editor.titleNew' : 'editor.titleEdit')} />
      <Page>{status ?? <Muted role="status">{t('loading')}</Muted>}</Page>
    </>
  );
  if (!ready || data === null) return loading;
  const first = data.places[0]?.id ?? '';
  const initial = order
    ? draftOf(order, first)
    : emptyDraft(localDate(new Date(), deviceZone()), lang, first);
  return (
    <EditorForm key={order?.code ?? 'new'} data={data} initial={initial} code={code} menu={menu} />
  );
}
