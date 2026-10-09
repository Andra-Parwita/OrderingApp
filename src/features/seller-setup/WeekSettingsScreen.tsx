import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language, Week } from '../../../shared/domain';
import { formatCutoff } from '../../../shared/dates';
import { Button, Segmented, TextArea, TextField, Toast, type SegmentedOption } from '../../ui';
import { SETUP_NS } from './i18n/register';
import { Body, Centered, Failure, Hint, Page, Row, Section, SectionTitle, Title } from './parts';
import {
  toastDismissed,
  weekRequested,
  weekSaveRequested,
  type SetupRootState,
} from './setupSlice';
import {
  PLACE_LIMIT,
  TEXT_LIMIT,
  toDraft,
  toRequest,
  validate,
  type WeekDraft,
  type WeekErrors,
} from './weekForm';

const Status = styled.span`
  align-self: flex-start;
  margin: 0 ${({ theme }) => theme.spacing.lg};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const SettingsLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type FormProps = Readonly<{
  week: Week;
  lang: Language;
  settingsHref: string | undefined;
}>;

function WeekForm({ week, lang, settingsHref }: FormProps) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const { saving, failure } = useSelector((state: SetupRootState) => state.sellerSetup.week);
  const [draft, setDraft] = useState<WeekDraft>(() => toDraft(week));
  const [submitted, setSubmitted] = useState(false);
  const errors: WeekErrors = validate(draft);

  const set = (key: keyof WeekDraft) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }));
  const setText = (key: keyof WeekDraft) => (event: ChangeEvent<HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }));
  const message = (key: keyof WeekErrors): string | undefined => {
    const code = errors[key];
    if (!submitted || !code) return undefined;
    if (code === 'tooLong') {
      return t('week.errors.tooLong', { max: key === 'place' ? PLACE_LIMIT : TEXT_LIMIT });
    }
    return t(code === 'required' ? `week.errors.${key}` : `week.errors.${code}`);
  };

  const deliveryOptions: ReadonlyArray<SegmentedOption<'yes' | 'no'>> = [
    { value: 'yes', label: t('week.deliveryYes') },
    { value: 'no', label: t('week.deliveryNo') },
  ];

  const onSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      if (Object.keys(validate(draft)).length > 0) return;
      dispatch(weekSaveRequested(toRequest(draft, week.pickupPoints[0]?.id)));
    },
    [dispatch, draft, week.pickupPoints],
  );

  return (
    <Body as="form" onSubmit={onSubmit} noValidate>
      <Row>
        <TextField
          label={t('week.cookingDate')}
          type="date"
          value={draft.cookingDate}
          error={message('cookingDate')}
          onChange={set('cookingDate')}
        />
      </Row>
      <Row>
        <TextField
          label={t('week.cutoffDate')}
          type="date"
          value={draft.cutoffDate}
          error={message('cutoffDate')}
          onChange={set('cutoffDate')}
        />
        <TextField
          label={t('week.cutoffTime')}
          helper={t('week.cutoffHelper')}
          type="time"
          value={draft.cutoffTime}
          error={message('cutoffTime')}
          onChange={set('cutoffTime')}
        />
      </Row>
      <Hint>{t('week.closesAt', { cutoff: formatCutoff(week.cutoffAt, lang) })}</Hint>
      {settingsHref ? <SettingsLink href={settingsHref}>{t('week.ordering')}</SettingsLink> : null}

      <Section>
        <SectionTitle>{t('week.pickup')}</SectionTitle>
        <TextField
          label={t('week.place')}
          value={draft.place}
          maxLength={PLACE_LIMIT}
          error={message('place')}
          onChange={set('place')}
        />
        <TextArea
          label={t('week.directionsEn')}
          helper={t('week.directionsHelper')}
          value={draft.directionsEn}
          maxLength={TEXT_LIMIT}
          showCounter
          error={message('directionsEn')}
          onChange={setText('directionsEn')}
        />
        <TextArea
          label={t('week.directionsId')}
          value={draft.directionsId}
          maxLength={TEXT_LIMIT}
          showCounter
          error={message('directionsId')}
          onChange={setText('directionsId')}
        />
        <Row>
          <TextField
            label={t('week.from')}
            type="time"
            value={draft.start}
            onChange={set('start')}
          />
          <TextField
            label={t('week.to')}
            type="time"
            value={draft.end}
            error={message('window')}
            onChange={set('end')}
          />
        </Row>
      </Section>

      <Section>
        <SectionTitle>{t('week.delivery')}</SectionTitle>
        <div>
          <Segmented
            options={deliveryOptions}
            value={draft.delivery ? 'yes' : 'no'}
            onChange={(next) => setDraft((d) => ({ ...d, delivery: next === 'yes' }))}
            label={t('week.deliveryAvailable')}
          />
        </div>
        <TextArea
          label={t('week.noteEn')}
          value={draft.noteEn}
          maxLength={TEXT_LIMIT}
          showCounter
          error={message('noteEn')}
          onChange={setText('noteEn')}
        />
        <TextArea
          label={t('week.noteId')}
          value={draft.noteId}
          maxLength={TEXT_LIMIT}
          showCounter
          error={message('noteId')}
          onChange={setText('noteId')}
        />
      </Section>

      {failure ? <Failure role="alert">{t('week.saveFailed')}</Failure> : null}
      <Button type="submit" variant="primary" fullWidth disabled={saving}>
        {saving ? t('week.saving') : t('week.save')}
      </Button>
    </Body>
  );
}

/**
 * Week settings (S9), route-agnostic: cooking date, cut-off, the pickup point and delivery.
 * The ordering open/closed switch stays in Settings; pass `settingsHref` to link to it.
 */
export function WeekSettingsScreen({ settingsHref }: Readonly<{ settingsHref?: string }>) {
  const { t, i18n } = useTranslation(SETUP_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const { load, data, version } = useSelector((state: SetupRootState) => state.sellerSetup.week);
  const toast = useSelector((state: SetupRootState) => state.sellerSetup.toast);

  useEffect(() => {
    dispatch(weekRequested());
  }, [dispatch]);

  const retry = useCallback(() => dispatch(weekRequested()), [dispatch]);
  const dismiss = useCallback(() => dispatch(toastDismissed()), [dispatch]);

  return (
    <Page>
      <Title>{t('week.title')}</Title>
      {data ? <Status>{t(`week.${data.status}`)}</Status> : null}
      {load === 'loading' && !data ? <Centered role="status">{t('loading')}</Centered> : null}
      {load === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {data ? (
        // A fresh form per saved version: the server's values replace the draft.
        <WeekForm key={version} week={data} lang={lang} settingsHref={settingsHref} />
      ) : null}
      <Toast message={toast ? t('saved') : null} onDismiss={dismiss} />
    </Page>
  );
}
