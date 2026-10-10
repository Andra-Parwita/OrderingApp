import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerDevice, signInWithPassword } from '../../api/auth';
import { checkPassword, type Me } from '../../../shared/authContract';
import { Button } from '../../ui';
import { failureMessage, guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';
import {
  AuthForm,
  AuthNote,
  AuthPanel,
  AuthTitle,
  BackButton,
  BigAction,
  DeviceNameField,
  ErrorText,
  PasswordField,
  useDeviceName,
} from './parts';

export type PasswordSetupScreenProps = Readonly<{
  onDone: (me: Me) => void;
  /** Optional way back to the passkey help. */
  onUsePasskey?: () => void;
  /** The setup session's `Me`; with `hasPassword` the screen signs in instead of setting one. */
  setup?: Me | undefined;
}>;

/**
 * Plan 025: the account already has a password (add-device code), so the person types it and the
 * normal password sign-in runs for this kitchen. It adds this device as a new one.
 */
function ExistingPasswordSignIn({
  slug,
  chefId,
  onDone,
  onUsePasskey,
}: Readonly<{
  slug: string;
  chefId?: string | undefined;
  onDone: (me: Me) => void;
  onUsePasskey?: (() => void) | undefined;
}>) {
  const { t } = useTranslation(AUTH_NS);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (password === '') {
      setError(t('signIn.empty'));
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signInWithPassword({
      slug,
      password,
      deviceName: t(`deviceName.${guessDevice()}`),
      ...(chefId ? { chefId } : {}),
    });
    setBusy(false);
    if (result.ok) onDone(result.data.me);
    else setError(failureMessage(t, result));
  }, [chefId, onDone, password, slug, t]);

  return (
    <AuthPanel>
      {onUsePasskey ? <BackButton onClick={onUsePasskey} /> : null}
      <AuthTitle>{t('signIn.passwordTitle')}</AuthTitle>
      <AuthForm
        onSubmit={(event: { preventDefault: () => void }) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <PasswordField
          label={t('signIn.passwordLabel')}
          value={password}
          onChange={(next) => {
            setPassword(next);
            setError(null);
          }}
          autoComplete="current-password"
          {...(error ? { error } : {})}
        />
        <BigAction>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('signIn.working') : t('signIn.submit')}
          </Button>
        </BigAction>
      </AuthForm>
    </AuthPanel>
  );
}

/** A2b: a password of at least 10 characters, typed twice (or the existing one, plan 025). */
export function PasswordSetupScreen({ setup, ...rest }: PasswordSetupScreenProps) {
  return setup?.hasPassword === true && setup.slug ? (
    <ExistingPasswordSignIn slug={setup.slug} chefId={setup.chefId} {...rest} />
  ) : (
    <NewPasswordForm {...rest} />
  );
}

function NewPasswordForm({ onDone, onUsePasskey }: Omit<PasswordSetupScreenProps, 'setup'>) {
  const { t } = useTranslation(AUTH_NS);
  const device = useDeviceName();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = checkPassword(password);
  const passwordError =
    tried && strength !== 'ok'
      ? t(strength === 'too_short' ? 'password.tooShort' : 'password.tooLong')
      : undefined;
  const confirmError =
    tried && strength === 'ok' && confirm !== password ? t('password.mismatch') : undefined;
  const nameError = tried && device.name.trim() === '' ? t('deviceName.empty') : undefined;

  const save = useCallback(async () => {
    setTried(true);
    setError(null);
    const deviceName = device.name.trim();
    if (checkPassword(password) !== 'ok' || confirm !== password || deviceName === '') return;
    setBusy(true);
    const result = await registerDevice({ kind: 'password', password, deviceName });
    setBusy(false);
    if (result.ok) onDone(result.data.me);
    else setError(failureMessage(t, result));
  }, [confirm, device.name, onDone, password, t]);

  return (
    <AuthPanel>
      {onUsePasskey ? <BackButton onClick={onUsePasskey} /> : null}
      <AuthTitle>{t('password.title')}</AuthTitle>
      <AuthForm
        onSubmit={(event: { preventDefault: () => void }) => {
          event.preventDefault();
          void save();
        }}
        noValidate
      >
        <PasswordField
          label={t('password.label')}
          helper={t('password.helper')}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          {...(passwordError ? { error: passwordError } : {})}
        />
        <PasswordField
          label={t('password.confirm')}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          {...(confirmError ? { error: confirmError } : {})}
        />
        <DeviceNameField
          value={device.name}
          onChange={device.setName}
          {...(nameError ? { error: nameError } : {})}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <BigAction>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('password.working') : t('password.submit')}
          </Button>
        </BigAction>
        <AuthNote>{t('password.later')}</AuthNote>
      </AuthForm>
    </AuthPanel>
  );
}
