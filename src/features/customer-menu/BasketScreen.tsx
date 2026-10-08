import { memo, useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Fulfilment, Language } from '../../../shared/domain';
import { FIRST_NAME_MAX, LOW_STOCK, NOTE_MAX } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button, Segmented, Stepper, TextArea, TextField, type SegmentedOption } from '../../ui';
import {
  menuRequested,
  placeRequested,
  placeReset,
  quantitySet,
  type FailureCode,
} from './customerSlice';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { CUSTOMER_NS } from './i18n/register';
import { Block, Muted, Page, StateMessage, Strong, Title, TopBar, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import {
  selectBasketLines,
  selectBasketTotalCents,
  selectMenu,
  selectPlace,
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
        max={item.remaining ?? undefined}
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
      return `basket.errors.${code}`;
    default:
      return 'basket.errors.other';
  }
}

type Props = Readonly<{ onBack: () => void; onPlaced: (token: string) => void }>;

function BasketContent({ onBack, onPlaced }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const lines = useSelector(selectBasketLines);
  const totalCents = useSelector(selectBasketTotalCents);
  const place = useSelector(selectPlace);

  const [fulfilment, setFulfilment] = useState<Fulfilment>('pickup');
  const [firstName, setFirstName] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // A previous attempt's error must not greet a new visit.
  useEffect(() => {
    dispatch(placeReset());
  }, [dispatch]);

  const menuIdle = menu.status === 'idle';
  useEffect(() => {
    if (menuIdle) dispatch(menuRequested());
  }, [dispatch, menuIdle]);

  const placedToken = place.status === 'placed' ? place.token : null;
  useEffect(() => {
    if (placedToken !== null) onPlaced(placedToken);
  }, [placedToken, onPlaced]);

  const retryMenu = useCallback(() => dispatch(menuRequested()), [dispatch]);

  const onQty = useCallback(
    (itemId: string, qty: number) => {
      dispatch(quantitySet({ itemId, qty }));
      if (qty === 0 && lines.length === 1) onBack();
    },
    [dispatch, lines.length, onBack],
  );
  const onName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value),
    [],
  );
  const onNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );

  const nameError =
    submitted && firstName.trim() === '' ? t('basket.firstNameRequired') : undefined;

  const submit = useCallback(() => {
    setSubmitted(true);
    if (firstName.trim() === '') return;
    dispatch(placeRequested({ firstName, language: lang, fulfilment, note }));
  }, [dispatch, firstName, lang, fulfilment, note]);

  const options: ReadonlyArray<SegmentedOption<Fulfilment>> =
    menu.status === 'ready' && !menu.data.week.delivery.available
      ? [{ value: 'pickup', label: t('basket.pickup') }]
      : [
          { value: 'pickup', label: t('basket.pickup') },
          { value: 'delivery', label: t('basket.delivery') },
        ];

  const header = (
    <TopBar>
      <Button variant="quiet" onClick={onBack} aria-label={t('common.back')}>
        ‹
      </Button>
      <Title>{t('basket.title')}</Title>
      <LanguageSwitch />
    </TopBar>
  );

  if (menu.status === 'error') {
    return (
      <Page>
        {header}
        <StateMessage alert text={t('menu.loadError')} onRetry={retryMenu} />
      </Page>
    );
  }
  if (menu.status !== 'ready') {
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
  const pickup = week.pickupPoints[0];
  const submitting = place.status === 'submitting';

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
        ) : pickup ? (
          <Muted>
            {t('basket.pickupWhen', {
              when: `${formatCookingDate(week.cookingDate, lang)}, ${formatWindow(pickup.window.start, pickup.window.end, lang)}`,
              place: pickup.place,
            })}
          </Muted>
        ) : null}
      </Block>
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
        {place.status === 'failed' ? (
          <Alert role="alert">{t(placeErrorKey(place.code))}</Alert>
        ) : null}
        <Button variant="primary" fullWidth onClick={submit} disabled={submitting}>
          {submitting
            ? t('basket.placing')
            : t('basket.place', { total: formatMoney(totalCents, lang) })}
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
