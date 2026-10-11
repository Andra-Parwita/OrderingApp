import { useCallback, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  passkeysSupported,
  signInWithCode,
  signInWithKey,
  signInWithPasskey,
  signOut,
} from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { CODE_LENGTH } from '../../../shared/authContract';
import { Button, Segmented, TextField } from '../../ui';
import { cleanCode, cleanKey, failureMessage } from './authText';
import { CodeBoxes } from './CodeBoxes';
import { AUTH_NS } from './i18n/register';
import { Actions, AuthForm, AuthNote, AuthPanel, AuthTitle, BigAction, MonoField } from './parts';

type Method = 'key' | 'code';

/** The two ways in on a new device: the invite key, or the 6-digit code from another device. */
function MethodTabs({
  value,
  onChange,
  keyTabLabel,
}: Readonly<{ value: Method; onChange: (m: Method) => void; keyTabLabel?: string }>) {
  const { t } = useTranslation(AUTH_NS);
  return (
    <Segmented
      label={t('key.method')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'key', label: keyTabLabel ?? t('key.tab') },
        { value: 'code', label: t('code.tab') },
      ]}
    />
  );
}

export type SetupKeyScreenProps = Readonly<{
  /** The key was accepted: a short setup session now lets this person finish (passkey or password). */
  onSession: (me: Me) => void;
  /** The person picked the 6-digit code tab. */
  onUseCode: () => void;
  /** A link under the button ("Already set up? Sign in"). */
  footer?: ReactNode;
  /** The key from an invite link (read once from the address). */
  initialKey?: string;
  /** This browser has a person signed in: the key adds them to this kitchen ("Join <kitchen>"). */
  joinKitchen?: string;
}>;

/** First time on this device, invite key tab. The key is read with or without dashes and spaces. */
export function SetupKeyScreen({
  onSession,
  onUseCode,
  footer,
  initialKey = '',
  joinKitchen,
}: SetupKeyScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const [value, setValue] = useState(initialKey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const key = cleanKey(value);
      if (key === '') {
        setError(t('key.empty'));
        return;
      }
      setBusy(true);
      setError(null);
      const result = await signInWithKey(key);
      setBusy(false);
      if (result.ok) onSession(result.data.me);
      else setError(failureMessage(t, result));
    },
    [onSession, t, value],
  );

  /** "Already have a login?": the passkey signs in first, then the key joins as that person. */
  const signInToJoin = useCallback(async () => {
    const key = cleanKey(value);
    if (key === '') {
      setError(t('key.empty'));
      return;
    }
    setBusy(true);
    setError(null);
    const signedIn = await signInWithPasskey('staff', true);
    if (!signedIn.ok) {
      setBusy(false);
      setError(failureMessage(t, signedIn));
      return;
    }
    if (signedIn.data.me.role === 'admin') {
      await signOut();
      setBusy(false);
      setError(t('signIn.adminPasskey'));
      return;
    }
    const joined = await signInWithKey(key);
    setBusy(false);
    if (joined.ok) onSession(joined.data.me);
    else setError(failureMessage(t, joined));
  }, [onSession, t, value]);

  const joining = joinKitchen !== undefined;
  return (
    <AuthPanel>
      <AuthTitle>{joining ? t('join.title', { kitchen: joinKitchen }) : t('key.title')}</AuthTitle>
      <AuthForm onSubmit={(event: FormEvent) => void submit(event)} noValidate>
        {joining ? null : (
          <MethodTabs value="key" onChange={(next) => next === 'code' && onUseCode()} />
        )}
        <MonoField>
          <TextField
            label={t('key.label')}
            helper={t('key.helper')}
            value={value}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            {...(error ? { error } : {})}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
          />
        </MonoField>
        <BigAction>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('key.checking') : joining ? t('join.submit') : t('key.submit')}
          </Button>
        </BigAction>
        {!joining && passkeysSupported() ? (
          <Button fullWidth disabled={busy} onClick={() => void signInToJoin()}>
            {t('join.signInToJoin')}
          </Button>
        ) : null}
        {footer ? <Actions>{footer}</Actions> : null}
      </AuthForm>
    </AuthPanel>
  );
}

export type DeviceCodeScreenProps = Readonly<{
  onSession: (me: Me) => void;
  /** The person picked the invite key tab. */
  onUseKey: () => void;
  /** Overrides the "Invite key" tab label (the admin page calls it "Setup key"). */
  keyTabLabel?: string;
  footer?: ReactNode;
}>;

/** First time on this device, 6-digit code tab: the code made by "Add a device" on a signed-in device. */
export function DeviceCodeScreen({
  onSession,
  onUseKey,
  keyTabLabel,
  footer,
}: DeviceCodeScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const code = cleanCode(value);
      if (code.length !== CODE_LENGTH) {
        setError(t('code.empty'));
        return;
      }
      setBusy(true);
      setError(null);
      const result = await signInWithCode(code);
      setBusy(false);
      if (result.ok) onSession(result.data.me);
      else setError(failureMessage(t, result));
    },
    [onSession, t, value],
  );

  return (
    <AuthPanel>
      <AuthTitle>{t('key.title')}</AuthTitle>
      <AuthForm onSubmit={(event: FormEvent) => void submit(event)} noValidate>
        <MethodTabs
          value="code"
          onChange={(next) => next === 'key' && onUseKey()}
          keyTabLabel={keyTabLabel}
        />
        <CodeBoxes
          label={t('code.label')}
          value={value}
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
          error={error ?? undefined}
        />
        <AuthNote>{t('code.helper')}</AuthNote>
        <BigAction>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('key.checking') : t('code.submit')}
          </Button>
        </BigAction>
        {footer ? <Actions>{footer}</Actions> : null}
      </AuthForm>
    </AuthPanel>
  );
}
