import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { KitchenSettings, Language } from '../../../shared/domain';
import { formatCutoff } from '../../../shared/dates';
import { POST_TEXT_MAX } from '../../../shared/limits';
import { Button, Segmented, TextArea, TextField, Toast, type SegmentedOption } from '../../ui';
import { SETTINGS_NS } from './i18n/register';
import { phoneIsValid, toDraft, toSettings, type Draft } from './settingsForm';
import {
  loadRequested,
  saveRequested,
  toastDismissed,
  type SettingsRootState,
} from './settingsSlice';

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: min(100%, 45rem);
  margin: 0 auto;
`;
const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xxl};
`;
const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Label = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Hint = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Failure = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.status.cancelled.fg};
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;

type FormProps = Readonly<{
  settings: KitchenSettings;
  cutoffAt: string;
  lang: Language;
}>;

function SettingsForm({ settings, cutoffAt, lang }: FormProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const dispatch = useDispatch();
  const save = useSelector((state: SettingsRootState) => state.sellerSettings.save);
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [submitted, setSubmitted] = useState(false);

  const orderingOptions: ReadonlyArray<SegmentedOption<'open' | 'closed'>> = [
    { value: 'open', label: t('ordering.open') },
    { value: 'closed', label: t('ordering.closed') },
  ];
  const onOrdering = useCallback(
    (next: 'open' | 'closed') => setDraft((d) => ({ ...d, orderingOpen: next === 'open' })),
    [],
  );
  const onPhone = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSubmitted(false);
    setDraft((d) => ({ ...d, phone: event.target.value }));
  }, []);
  const text =
    (field: 'greeting' | 'closing', lng: Language) => (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [field]: { ...d[field], [lng]: event.target.value } }));

  const clientInvalid = !phoneIsValid(draft.phone);
  // The server has the final say (it also normalises); its refusal shows on the same field.
  const serverInvalid = save.status === 'error' && save.code === 'invalid_request';
  const numberError =
    (submitted && clientInvalid) || serverInvalid ? t('whatsapp.invalid') : undefined;

  const onSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      if (!phoneIsValid(draft.phone)) return;
      dispatch(saveRequested(toSettings(draft)));
    },
    [dispatch, draft],
  );

  return (
    <Form onSubmit={onSubmit} noValidate>
      <Group>
        <Label>{t('ordering.label')}</Label>
        <div>
          <Segmented
            options={orderingOptions}
            value={draft.orderingOpen ? 'open' : 'closed'}
            onChange={onOrdering}
            label={t('ordering.label')}
          />
        </div>
        <Hint>{t('ordering.cutoff', { cutoff: formatCutoff(cutoffAt, lang) })}</Hint>
      </Group>

      <TextField
        label={t('whatsapp.label')}
        helper={t('whatsapp.helper')}
        error={numberError}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={draft.phone}
        onChange={onPhone}
      />

      <TextArea
        label={t('greeting.en')}
        value={draft.greeting.en}
        maxLength={POST_TEXT_MAX}
        showCounter
        onChange={text('greeting', 'en')}
      />
      <TextArea
        label={t('greeting.id')}
        value={draft.greeting.id}
        maxLength={POST_TEXT_MAX}
        showCounter
        onChange={text('greeting', 'id')}
      />
      <TextArea
        label={t('closing.en')}
        helper={t('closing.helper')}
        value={draft.closing.en}
        maxLength={POST_TEXT_MAX}
        showCounter
        onChange={text('closing', 'en')}
      />
      <TextArea
        label={t('closing.id')}
        helper={t('closing.helper')}
        value={draft.closing.id}
        maxLength={POST_TEXT_MAX}
        showCounter
        onChange={text('closing', 'id')}
      />

      {save.status === 'error' && !serverInvalid ? (
        <Failure role="alert">{t('saveFailed')}</Failure>
      ) : null}
      <Button type="submit" variant="primary" fullWidth disabled={save.status === 'saving'}>
        {save.status === 'saving' ? t('saving') : t('save')}
      </Button>
    </Form>
  );
}

/**
 * Minimal settings (stage 4.3b), route-agnostic. Branding, images and devices come in
 * batches 3 and 4.
 */
export function SettingsScreen({ children }: Readonly<{ children?: ReactNode }>) {
  const { t, i18n } = useTranslation(SETTINGS_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const { load, settings, cutoffAt, version, toast } = useSelector(
    (state: SettingsRootState) => state.sellerSettings,
  );

  useEffect(() => {
    dispatch(loadRequested());
  }, [dispatch]);

  const retry = useCallback(() => dispatch(loadRequested()), [dispatch]);
  const dismiss = useCallback(() => dispatch(toastDismissed()), [dispatch]);

  return (
    <Page>
      <Title>{t('title')}</Title>
      {load === 'loading' && !settings ? <Centered role="status">{t('loading')}</Centered> : null}
      {load === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {settings && cutoffAt ? (
        // A fresh form per saved version: the server's normalised values replace the draft.
        <SettingsForm key={version} settings={settings} cutoffAt={cutoffAt} lang={lang} />
      ) : null}
      {children}
      <Toast message={toast ? t('saved') : null} onDismiss={dismiss} />
    </Page>
  );
}
