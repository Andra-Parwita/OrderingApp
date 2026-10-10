import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { KitchenSettings, Language } from '../../../shared/domain';
import { POST_TEXT_MAX } from '../../../shared/limits';
import { formatPhone } from '../../../shared/phone';
import { fetchMenu } from '../../api/client';
import { setKitchenName } from '../../api/kitchenName';
import { KITCHEN_NAME_MAX } from '../../../shared/setupContract';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, TextArea, TextField } from '../../ui';
import { SETTINGS_NS } from './i18n/register';
import { ErrorLine, GroupTitle, Muted, PaneForm, Two } from './paneParts';
import { phoneIsValid, toDraft, toSettings } from './settingsForm';
import { loadRequested, saveRequested, type SettingsRootState } from './settingsSlice';

const Preview = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
const PicturesBlock = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

/** Loads the kitchen settings and hands them to its children; shows the load states. */
function SettingsGate({
  children,
}: Readonly<{ children: (settings: KitchenSettings) => ReactNode }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const dispatch = useDispatch();
  const { load, settings, version } = useSelector(
    (state: SettingsRootState) => state.sellerSettings,
  );
  useEffect(() => {
    dispatch(loadRequested());
  }, [dispatch]);
  const retry = useCallback(() => dispatch(loadRequested()), [dispatch]);
  if (load === 'error') {
    return (
      <ErrorLine role="alert">
        {t('error')}{' '}
        <Button variant="quiet" onClick={retry}>
          {t('retry')}
        </Button>
      </ErrorLine>
    );
  }
  if (!settings) return <Muted role="status">{t('loading')}</Muted>;
  // A fresh form per saved version: the server's normalised values replace the draft.
  return <div key={version}>{children(settings)}</div>;
}

function SaveButton() {
  const { t } = useTranslation(SETTINGS_NS);
  const saving = useSelector(
    (state: SettingsRootState) => state.sellerSettings.save.status === 'saving',
  );
  return (
    <div>
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

function SaveFailure({ hideInvalid }: Readonly<{ hideInvalid?: boolean }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const save = useSelector((state: SettingsRootState) => state.sellerSettings.save);
  if (save.status !== 'error' || (hideInvalid && save.code === 'invalid_request')) return null;
  return <ErrorLine role="alert">{t('saveFailed')}</ErrorLine>;
}

// ---- Kitchen: name, WhatsApp number, pictures ----

/** The kitchen name: `name` is what the field shows, `saved` what the server has. */
function useKitchenName() {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchMenu(currentSellerSlug()).then((result) => {
      if (live && result.ok) {
        setName(result.data.kitchen.name);
        setSaved(result.data.kitchen.name);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return { name, setName, saved, setSaved, loaded };
}

function PhoneForm({ settings }: Readonly<{ settings: KitchenSettings }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const dispatch = useDispatch();
  const { name, setName, saved, setSaved, loaded } = useKitchenName();
  const [nameFailed, setNameFailed] = useState(false);
  const save = useSelector((state: SettingsRootState) => state.sellerSettings.save);
  const [phone, setPhone] = useState(() => toDraft(settings).phone);
  const [submitted, setSubmitted] = useState(false);
  const serverInvalid = save.status === 'error' && save.code === 'invalid_request';
  const error =
    (submitted && !phoneIsValid(phone)) || serverInvalid ? t('whatsapp.invalid') : undefined;
  // Until the name has loaded, the empty field is not the owner's doing: it is not checked.
  const nameInvalid = loaded && (name.trim() === '' || name.trim().length > KITCHEN_NAME_MAX);
  const nameError = (submitted && nameInvalid) || nameFailed ? t('kitchen.nameInvalid') : undefined;
  const onSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      if (!phoneIsValid(phone) || nameInvalid) return;
      const next = name.trim();
      if (next !== saved) {
        void setKitchenName(next).then((result) => {
          setNameFailed(!result.ok);
          if (result.ok) setSaved(result.data.name);
        });
      }
      dispatch(saveRequested(toSettings({ ...toDraft(settings), phone })));
    },
    [dispatch, phone, settings, name, nameInvalid, saved, setSaved],
  );
  return (
    <PaneForm onSubmit={onSubmit} noValidate>
      <Two>
        <TextField
          label={t('kitchen.name')}
          helper={t('kitchen.nameHelper')}
          error={nameError}
          value={name}
          maxLength={KITCHEN_NAME_MAX}
          autoComplete="off"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setNameFailed(false);
            setSubmitted(false);
            setName(event.target.value);
          }}
        />
        <TextField
          label={t('kitchen.phone')}
          helper={t('kitchen.phoneHelper')}
          error={error}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSubmitted(false);
            setPhone(event.target.value);
          }}
        />
      </Two>
      <SaveFailure hideInvalid />
      <SaveButton />
    </PaneForm>
  );
}

export function KitchenPane({ images }: Readonly<{ images: ReactNode }>) {
  return (
    <>
      <SettingsGate>{(settings) => <PhoneForm settings={settings} />}</SettingsGate>
      <PicturesBlock>{images}</PicturesBlock>
    </>
  );
}

// ---- WhatsApp post: greeting, closing and a preview ----

function PostForm({ settings }: Readonly<{ settings: KitchenSettings }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const dispatch = useDispatch();
  const [greeting, setGreeting] = useState(settings.postGreeting);
  const [closing, setClosing] = useState(settings.postClosing);
  const number = settings.whatsappNumber ? formatPhone(settings.whatsappNumber) : '';
  const onSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      dispatch(saveRequested(toSettings({ ...toDraft(settings), greeting, closing })));
    },
    [closing, dispatch, greeting, settings],
  );
  const text = (lng: Language) =>
    `${greeting[lng]}\n\n${t('post.menuHere')}\n\n${closing[lng].replaceAll('{phone}', number)}`;
  const edit =
    (set: typeof setGreeting, current: typeof greeting, lng: Language) =>
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      set({ ...current, [lng]: event.target.value });
  return (
    <PaneForm onSubmit={onSubmit} noValidate>
      <Two>
        <TextArea
          label={t('greeting.en')}
          value={greeting.en}
          maxLength={POST_TEXT_MAX}
          showCounter
          onChange={edit(setGreeting, greeting, 'en')}
        />
        <TextArea
          label={t('greeting.id')}
          value={greeting.id}
          maxLength={POST_TEXT_MAX}
          showCounter
          onChange={edit(setGreeting, greeting, 'id')}
        />
        <TextArea
          label={t('closing.en')}
          helper={t('closing.helper')}
          value={closing.en}
          maxLength={POST_TEXT_MAX}
          showCounter
          onChange={edit(setClosing, closing, 'en')}
        />
        <TextArea
          label={t('closing.id')}
          helper={t('closing.helper')}
          value={closing.id}
          maxLength={POST_TEXT_MAX}
          showCounter
          onChange={edit(setClosing, closing, 'id')}
        />
      </Two>
      <SaveFailure />
      <SaveButton />
      <GroupTitle>{t('post.preview')}</GroupTitle>
      <Muted>{t('post.previewHelper')}</Muted>
      <Two>
        <div>
          <Muted>{t('post.previewEn')}</Muted>
          <Preview aria-label={`${t('post.preview')} ${t('post.previewEn')}`}>{text('en')}</Preview>
        </div>
        <div>
          <Muted>{t('post.previewId')}</Muted>
          <Preview aria-label={`${t('post.preview')} ${t('post.previewId')}`}>{text('id')}</Preview>
        </div>
      </Two>
    </PaneForm>
  );
}

export function PostPane() {
  return <SettingsGate>{(settings) => <PostForm settings={settings} />}</SettingsGate>;
}
