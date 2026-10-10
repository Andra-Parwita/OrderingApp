import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import {
  THEMES,
  type MenuDefaults,
  type Preferences,
  type ThemeName,
} from '../../../shared/menusContract';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPreferences } from '../../api/menus';
import { updatePreferences } from '../../api/settings';
import { setSoundPreference, useSoundPreference } from '../../components/chime';
import { Button, Segmented, TextField, type SegmentedOption } from '../../ui';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from '../../theme/themePreference';
import { makeColors } from '../../theme/designTokens';
import { SETTINGS_NS } from './i18n/register';
import { ErrorLine, GroupTitle, Muted, PaneForm, PaneGroup, Two } from './paneParts';

type Loaded = Readonly<{ preferences: Preferences | null; failed: boolean; retry: () => void }>;

/** The kitchen's preferences (`/preferences`): the theme and the menu defaults. */
function usePreferences(): Loaded & { set: (next: Preferences) => void } {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    void fetchPreferences(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      if (result.ok) {
        setPreferences(result.data.preferences);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [round]);
  const retry = useCallback(() => {
    setFailed(false);
    setRound((n) => n + 1);
  }, []);
  return { preferences, failed, retry, set: setPreferences };
}

function Gate({
  loaded,
  failMessage,
  children,
}: Readonly<{
  loaded: Loaded;
  failMessage: string;
  children: (preferences: Preferences) => ReactNode;
}>) {
  const { t } = useTranslation(SETTINGS_NS);
  if (loaded.failed) {
    return (
      <ErrorLine role="alert">
        {failMessage}{' '}
        <Button variant="quiet" onClick={loaded.retry}>
          {t('retry')}
        </Button>
      </ErrorLine>
    );
  }
  if (!loaded.preferences) return <Muted role="status">{t('loading')}</Muted>;
  return <>{children(loaded.preferences)}</>;
}

// ---- Menu defaults ----

type DefaultsFormProps = Readonly<{
  defaults: MenuDefaults;
  onSaved: (next: MenuDefaults) => void;
  onToast: () => void;
}>;

function DefaultsForm({ defaults, onSaved, onToast }: DefaultsFormProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const [days, setDays] = useState(String(defaults.cutoffDaysBefore));
  const [time, setTime] = useState(defaults.cutoffTime);
  const [available, setAvailable] = useState(defaults.delivery.available);
  const [noteEn, setNoteEn] = useState(defaults.delivery.note.en);
  const [noteId, setNoteId] = useState(defaults.delivery.note.id);
  const [state, setState] = useState<'idle' | 'saving' | 'invalid' | 'failed'>('idle');

  const options: ReadonlyArray<SegmentedOption<'on' | 'off'>> = [
    { value: 'on', label: t('defaults.deliveryOn') },
    { value: 'off', label: t('defaults.deliveryOff') },
  ];
  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const n = Number(days);
    if (!/^\d{1,2}$/.test(days) || n > 14 || !/^\d{2}:\d{2}$/.test(time)) {
      setState('invalid');
      return;
    }
    setState('saving');
    const next: MenuDefaults = {
      cutoffDaysBefore: n,
      cutoffTime: time,
      delivery: { available, note: { en: noteEn.trim(), id: noteId.trim() } },
    };
    const result = await updatePreferences({ menuDefaults: next }, undefined, currentSellerSlug());
    if (result.ok) {
      setState('idle');
      onSaved(result.data.preferences.menuDefaults);
      onToast();
    } else setState(result.error === 'invalid_request' ? 'invalid' : 'failed');
  };

  return (
    <PaneForm onSubmit={(event) => void submit(event)} noValidate>
      <Muted>{t('defaults.intro')}</Muted>
      <PaneGroup>
        <GroupTitle>{t('defaults.cutoffTitle')}</GroupTitle>
        <Two>
          <TextField
            label={t('defaults.daysBefore')}
            helper={t('defaults.daysHelper')}
            type="number"
            inputMode="numeric"
            min={0}
            max={14}
            value={days}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDays(event.target.value)}
          />
          <TextField
            label={t('defaults.time')}
            type="time"
            value={time}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTime(event.target.value)}
          />
        </Two>
      </PaneGroup>
      <PaneGroup>
        <GroupTitle>{t('defaults.deliveryTitle')}</GroupTitle>
        <div>
          <Segmented
            options={options}
            value={available ? 'on' : 'off'}
            onChange={(next) => setAvailable(next === 'on')}
            label={t('defaults.deliveryTitle')}
          />
        </div>
        <Two>
          <TextField
            label={t('defaults.noteEn')}
            value={noteEn}
            maxLength={200}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNoteEn(event.target.value)}
          />
          <TextField
            label={t('defaults.noteId')}
            value={noteId}
            maxLength={200}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNoteId(event.target.value)}
          />
        </Two>
      </PaneGroup>
      {state === 'invalid' ? <ErrorLine role="alert">{t('defaults.invalid')}</ErrorLine> : null}
      {state === 'failed' ? <ErrorLine role="alert">{t('saveFailed')}</ErrorLine> : null}
      <div>
        <Button type="submit" variant="primary" disabled={state === 'saving'}>
          {state === 'saving' ? t('saving') : t('save')}
        </Button>
      </div>
    </PaneForm>
  );
}

export function DefaultsPane({ onToast }: Readonly<{ onToast: () => void }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const loaded = usePreferences();
  const { set } = loaded;
  return (
    <Gate loaded={loaded} failMessage={t('defaults.loadFailed')}>
      {(preferences) => (
        <DefaultsForm
          defaults={preferences.menuDefaults}
          onToast={onToast}
          onSaved={(menuDefaults) => set({ ...preferences, menuDefaults })}
        />
      )}
    </Gate>
  );
}

// ---- Appearance: light / dark / auto (this device) and the colour theme (the kitchen) ----

const Themes = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const ThemeButton = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm};
  border: ${({ theme, $selected }) => ($selected ? theme.border.focus : theme.border.hairline)}
    solid ${({ theme, $selected }) => ($selected ? theme.c.fill : theme.c.line)};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const Swatches = styled.span`
  display: flex;
  overflow: hidden;
  height: 2rem;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
`;
const Swatch = styled.span<{ $colour: string }>`
  flex: 1;
  background: ${({ $colour }) => $colour};
`;

function ThemePicker({
  value,
  mode,
  busy,
  onPick,
}: Readonly<{
  value: ThemeName;
  mode: 'light' | 'dark';
  busy: boolean;
  onPick: (next: ThemeName) => void;
}>) {
  const { t } = useTranslation(SETTINGS_NS);
  return (
    <Themes role="radiogroup" aria-label={t('look.themeTitle')}>
      {THEMES.map((name) => {
        const c = makeColors(name, mode);
        return (
          <ThemeButton
            key={name}
            type="button"
            role="radio"
            aria-checked={name === value}
            $selected={name === value}
            disabled={busy}
            onClick={() => onPick(name)}
          >
            <Swatches aria-hidden="true">
              <Swatch $colour={c.panel} />
              <Swatch $colour={c.fill} />
              <Swatch $colour={c.surf2} />
              <Swatch $colour={c.text} />
            </Swatches>
            {t(`look.themes.${name}`)}
          </ThemeButton>
        );
      })}
    </Themes>
  );
}

export function AppearancePane({ onToast }: Readonly<{ onToast: () => void }>) {
  const { t } = useTranslation(SETTINGS_NS);
  const preference = useThemePreference();
  const loaded = usePreferences();
  const { set } = loaded;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const modes: ReadonlyArray<SegmentedOption<ThemePreference>> = [
    { value: 'light', label: t('look.light') },
    { value: 'dark', label: t('look.dark') },
    { value: 'auto', label: t('look.auto') },
  ];
  const sound = useSoundPreference();
  const soundOptions: ReadonlyArray<SegmentedOption<'on' | 'off'>> = [
    { value: 'on', label: t('look.soundOn') },
    { value: 'off', label: t('look.soundOff') },
  ];
  // The picker's swatches follow the mode in use; "auto" reads the device.
  const dark =
    preference === 'dark' ||
    (preference === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const pick = async (preferences: Preferences, next: ThemeName) => {
    if (next === preferences.theme) return;
    setBusy(true);
    setFailed(false);
    const result = await updatePreferences({ theme: next }, undefined, currentSellerSlug());
    setBusy(false);
    if (result.ok) {
      set(result.data.preferences);
      // Recolours the seller app straight away (AppThemeProvider reads it).
      setKitchenBrand(result.data.preferences.theme);
      onToast();
    } else setFailed(true);
  };

  return (
    <>
      <PaneGroup>
        <GroupTitle>{t('look.modeTitle')}</GroupTitle>
        <div>
          <Segmented
            options={modes}
            value={preference}
            onChange={setThemePreference}
            label={t('look.modeTitle')}
          />
        </div>
        <Muted>{t('look.modeHelper')}</Muted>
      </PaneGroup>
      <PaneGroup>
        <GroupTitle>{t('look.soundTitle')}</GroupTitle>
        <div>
          <Segmented
            options={soundOptions}
            value={sound ? 'on' : 'off'}
            onChange={(next) => setSoundPreference(next === 'on')}
            label={t('look.soundTitle')}
          />
        </div>
        <Muted>{t('look.soundHelper')}</Muted>
      </PaneGroup>
      <PaneGroup>
        <GroupTitle>{t('look.themeTitle')}</GroupTitle>
        <Gate loaded={loaded} failMessage={t('look.loadFailed')}>
          {(preferences) => (
            <>
              <ThemePicker
                value={preferences.theme}
                mode={dark ? 'dark' : 'light'}
                busy={busy}
                onPick={(next) => void pick(preferences, next)}
              />
              <Muted>{t('look.themeHelper')}</Muted>
              {failed ? <ErrorLine role="alert">{t('saveFailed')}</ErrorLine> : null}
            </>
          )}
        </Gate>
      </PaneGroup>
    </>
  );
}
