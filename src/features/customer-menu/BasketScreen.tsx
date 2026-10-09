import { memo, useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Fulfilment, Language } from '../../../shared/domain';
import { FIRST_NAME_MAX, LOW_STOCK, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import {
  Button,
  PageHeader,
  Segmented,
  Stepper,
  TextArea,
  TextField,
  type SegmentedOption,
} from '../../ui';
import {
  editCleared,
  editRequested,
  menuRequested,
  placeRequested,
  placeReset,
  quantitySet,
  updateRequested,
  type FailureCode,
} from './customerSlice';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { CUSTOMER_NS } from './i18n/register';
import { Block, Muted, Page, StateMessage, Strong, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import {
  selectBasketLines,
  selectBasketTotalCents,
  selectEdit,
  selectMenu,
  selectMenuSlug,
  selectPlace,
  selectUpdate,
  type BasketLine,
} from './selectors';

const Line = styled.li`
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
`;

const LineTotal = styled(Strong)`
  min-width: calc(${({ theme }) => theme.spacing.xxl} * 2);
  text-align: right;
`;

const Lines = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Total = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Alert = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.status.cancelled.bg};
  color: ${({ theme }) => theme.status.cancelled.fg};
`;

const Places = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PlaceChoice = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
`;

const Centered = styled(Muted)`
  text-align: center;
`;

type LineRowProps = Readonly<{
  line: BasketLine;
  lang: Language;
  onQty: (itemId: string, qty: number) => void;
}>;

const BasketLineRow = memo(function BasketLineRow({ line, lang, onQty }: LineRowProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { item, qty, lineCents } = line;
  const onChange = useCallback((next: number) => onQty(item.id, next), [onQty, item.id]);
  const name = pickText(item.name, lang);
  const each = t('basket.each', { price: formatMoney(item.priceCents, lang) });
  return (
    <Line>
      <div>
        <Strong>{name}</Strong>
        <Muted>
          {each}
          {item.remaining != null && item.remaining > 0 && item.remaining <= LOW_STOCK
            ? ` · ${t('menu.left', { count: item.remaining })}`
            : ''}
        </Muted>
      </div>
      <Stepper
        value={qty}
        onChange={onChange}
        label={name}
        decreaseLabel={t('menu.decrease', { name })}
        increaseLabel={t('menu.increase', { name })}
        max={line.max}
      />
      <LineTotal>{formatMoney(lineCents, lang)}</LineTotal>
    </Line>
  );
});

function placeErrorKey(code: FailureCode): string {
  switch (code) {
    case 'sold_out':
    case 'exceeds_remaining':
    case 'cutoff_passed':
    case 'order_locked':
    case 'ordering_closed':
      return `basket.errors.${code}`;
    default:
      return 'basket.errors.other';
  }
}

type Props = Readonly<{
  /** The seller whose menu this basket is for (from the route); an edited order uses its own. */
  slug?: string;
  onBack: () => void;
  onPlaced: (token: string) => void;
  /** Edit mode: the private token of the order being changed (its lines load into the basket). */
  editToken?: string;
  /** Edit mode: called once the change is saved. */
  onUpdated?: (token: string) => void;
}>;

function BasketContent({ slug, onBack, onPlaced, editToken, onUpdated }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const lines = useSelector(selectBasketLines);
  const totalCents = useSelector(selectBasketTotalCents);
  const place = useSelector(selectPlace);
  const edit = useSelector(selectEdit);
  const update = useSelector(selectUpdate);
  const editing = editToken !== undefined;

  // What the customer picked; until then an edited order shows its own fulfilment and note.
  const [fulfilmentPick, setFulfilment] = useState<Fulfilment | null>(null);
  const [firstName, setFirstName] = useState('');
  const [notePick, setNote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [placePick, setPlacePick] = useState<string | null>(null);

  // The kitchen's colours (D-064).
  const theme = menu.status === 'ready' ? (menu.data.theme ?? 'onde') : undefined;
  useEffect(() => {
    if (theme !== undefined) setKitchenBrand(theme);
  }, [theme]);

  // A previous attempt's error must not greet a new visit.
  useEffect(() => {
    dispatch(placeReset());
  }, [dispatch]);

  // Edit mode: load the order's lines into the basket; leaving empties the basket again.
  useEffect(() => {
    if (editToken === undefined) return undefined;
    dispatch(editRequested(editToken));
    return () => {
      dispatch(editCleared());
    };
  }, [dispatch, editToken]);

  const editOrder = edit.status === 'ready' ? edit.order : null;
  const fulfilment: Fulfilment = fulfilmentPick ?? editOrder?.fulfilment ?? 'pickup';
  const note = notePick ?? editOrder?.note ?? '';

  const updatedToken = update.status === 'done' && editToken !== undefined ? editToken : null;
  useEffect(() => {
    if (updatedToken !== null) onUpdated?.(updatedToken);
  }, [updatedToken, onUpdated]);

  // The menu of the seller in the route, or of the order being edited once it has loaded.
  const menuSlug = useSelector(selectMenuSlug);
  const wantedSlug = editing ? editOrder?.seller.slug : slug;
  useEffect(() => {
    if (wantedSlug !== undefined && wantedSlug !== menuSlug) dispatch(menuRequested(wantedSlug));
  }, [dispatch, wantedSlug, menuSlug]);

  const placedToken = place.status === 'placed' ? place.token : null;
  useEffect(() => {
    if (placedToken !== null) onPlaced(placedToken);
  }, [placedToken, onPlaced]);

  const retryMenu = useCallback(() => {
    if (wantedSlug !== undefined) dispatch(menuRequested(wantedSlug));
  }, [dispatch, wantedSlug]);

  const onQty = useCallback(
    (itemId: string, qty: number) => {
      if (qty === 0 && lines.length === 1) {
        // The last line of an existing order stays: to remove it all, cancel the order instead.
        if (editing) return;
        dispatch(quantitySet({ itemId, qty }));
        onBack();
        return;
      }
      dispatch(quantitySet({ itemId, qty }));
    },
    [dispatch, lines.length, onBack, editing],
  );
  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value),
    [],
  );
  const onNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );

  // The menu's places with their times for this menu. One place: shown as before; more: the customer picks.
  const points = menu.status === 'ready' ? menu.data.week.pickupPoints : [];
  const choosing = !editing && points.length > 1;
  const pickupId =
    (placePick !== null && points.some((point) => point.id === placePick)
      ? placePick
      : undefined) ??
    (editing ? editOrder?.pickupPlaceId : undefined) ??
    points[0]?.id;

  const nameError =
    submitted && firstName.trim() === '' ? t('basket.firstNameRequired') : undefined;

  const submit = useCallback(() => {
    if (editing) {
      dispatch(updateRequested({ fulfilment, note }));
      return;
    }
    setSubmitted(true);
    if (firstName.trim() === '') return;
    dispatch(
      placeRequested({
        firstName,
        language: lang,
        fulfilment,
        note,
        ...(fulfilment === 'pickup' && pickupId !== undefined ? { pickupPlaceId: pickupId } : {}),
      }),
    );
  }, [dispatch, editing, firstName, lang, fulfilment, note, pickupId]);

  const options: ReadonlyArray<SegmentedOption<Fulfilment>> =
    menu.status === 'ready' && !menu.data.week.delivery.available
      ? [{ value: 'pickup', label: t('basket.pickup') }]
      : [
          { value: 'pickup', label: t('basket.pickup') },
          { value: 'delivery', label: t('basket.delivery') },
        ];

  const header = (
    <PageHeader
      title={editing ? t('basket.editTitle') : t('basket.title')}
      backLabel={t('common.back')}
      onBack={onBack}
      trailing={<LanguageSwitch compact />}
    />
  );

  if (menu.status === 'error' || edit.status === 'error') {
    return (
      <Page>
        {header}
        <StateMessage
          alert
          text={edit.status === 'error' ? t('basket.errors.editLoad') : t('menu.loadError')}
          onRetry={retryMenu}
        />
      </Page>
    );
  }
  if (menu.status !== 'ready' || (editing && edit.status !== 'ready')) {
    return (
      <Page>
        {header}
        <StateMessage text={t('common.loading')} />
      </Page>
    );
  }
  if (lines.length === 0 && placedToken === null) {
    return (
      <Page>
        {header}
        <StateMessage text={t('basket.empty')} />
        <Block>
          <Button onClick={onBack}>{t('basket.backToMenu')}</Button>
        </Block>
      </Page>
    );
  }

  const { week } = menu.data;
  const pickup = week.pickupPoints.find((point) => point.id === pickupId) ?? week.pickupPoints[0];
  const submitting = place.status === 'submitting' || update.status === 'submitting';
  const failure = editing ? update : place;

  return (
    <Page>
      {header}
      <Block>
        <Lines>
          {lines.map((line) => (
            <BasketLineRow key={line.item.id} line={line} lang={lang} onQty={onQty} />
          ))}
        </Lines>
        <Total>
          <span>{t('basket.total')}</span>
          <span>{formatMoney(totalCents, lang)}</span>
        </Total>
      </Block>
      <Block>
        <Strong>{t('basket.howTitle')}</Strong>
        <Segmented
          options={options}
          value={fulfilment}
          onChange={setFulfilment}
          label={t('basket.howTitle')}
        />
        {fulfilment === 'delivery' ? (
          <Muted>{t('basket.deliveryNote')}</Muted>
        ) : choosing ? (
          <Places>
            <legend>
              <Strong>{t('basket.pickupPlace')}</Strong>
            </legend>
            {week.pickupPoints.map((point) => (
              <PlaceChoice key={point.id}>
                <input
                  type="radio"
                  name="pickup-place"
                  checked={point.id === pickup?.id}
                  onChange={() => setPlacePick(point.id)}
                />
                <span>
                  <Strong>{point.place}</Strong>
                  <Muted>
                    {formatCookingDate(week.cookingDate, lang)},{' '}
                    {formatWindow(point.window.start, point.window.end, lang)}
                  </Muted>
                  {point.id === pickup?.id ? (
                    <Muted>{pickText(point.directions, lang)}</Muted>
                  ) : null}
                </span>
              </PlaceChoice>
            ))}
          </Places>
        ) : pickup ? (
          <>
            <Muted>
              {t('basket.pickupWhen', {
                when: `${formatCookingDate(week.cookingDate, lang)}, ${formatWindow(pickup.window.start, pickup.window.end, lang)}`,
                place: pickup.place,
              })}
            </Muted>
            <Muted>{pickText(pickup.directions, lang)}</Muted>
          </>
        ) : null}
      </Block>
      {editing ? null : (
        <Block>
          <TextField
            label={t('basket.firstName')}
            helper={t('basket.firstNameHelper')}
            error={nameError}
            value={firstName}
            onChange={onName}
            maxLength={FIRST_NAME_MAX}
            autoComplete="given-name"
            required
          />
        </Block>
      )}
      <Block>
        <TextArea
          label={t('basket.note')}
          helper={t('basket.noteHelper')}
          value={note}
          onChange={onNote}
          maxLength={NOTE_MAX}
          showCounter
        />
      </Block>
      <Block>
        {failure.status === 'failed' ? (
          <Alert role="alert">{t(placeErrorKey(failure.code))}</Alert>
        ) : null}
        <Button variant="primary" fullWidth onClick={submit} disabled={submitting}>
          {submitting
            ? editing
              ? t('basket.updating')
              : t('basket.placing')
            : t(editing ? 'basket.update' : 'basket.place', {
                total: formatMoney(totalCents, lang),
              })}
        </Button>
        <Centered>{t('basket.changeUntil', { when: formatCutoff(week.cutoffAt, lang) })}</Centered>
      </Block>
    </Page>
  );
}

export function BasketScreen(props: Props) {
  return (
    <ScreenBoundary>
      <BasketContent {...props} />
    </ScreenBoundary>
  );
}
