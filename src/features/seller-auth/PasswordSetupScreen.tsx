import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerDevice } from '../../api/auth';
import { checkPassword, type Me } from '../../../shared/authContract';
import { Button } from '../../ui';
import { failureMessage } from './authText';
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
}>;

/** A2b: a password of at least 10 characters, typed twice. */
export function PasswordSetupScreen({ onDone, onUsePasskey }: PasswordSetupScreenProps) {
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
