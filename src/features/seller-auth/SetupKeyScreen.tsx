import { useCallback, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithCode, signInWithKey } from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { CODE_LENGTH } from '../../../shared/authContract';
import { Button, TextField } from '../../ui';
import { cleanCode, cleanKey, failureMessage } from './authText';
import { AUTH_NS } from './i18n/register';
import { Actions, Body, Page, Title } from './parts';

export type SetupKeyScreenProps = Readonly<{
  /** The key was accepted: a short setup session now lets this person finish (passkey or password). */
  onSession: (me: Me) => void;
  /** Switch to the 6-digit code from another device. */
  onUseCode: () => void;
  /** A link under the buttons ("Already set up? Sign in"). */
  footer?: ReactNode;
}>;

/** A1: "Enter the key you were sent". */
export function SetupKeyScreen({ onSession, onUseCode, footer }: SetupKeyScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const [value, setValue] = useState('');
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

  return (
    <Page>
      <Title>{t('key.title')}</Title>
      <Body as="form" onSubmit={(event: FormEvent) => void submit(event)} noValidate>
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
        <Actions>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('key.checking') : t('key.submit')}
          </Button>
          <Button variant="quiet" fullWidth onClick={onUseCode}>
            {t('key.useCode')}
          </Button>
        </Actions>
        {footer}
      </Body>
    </Page>
  );
}

export type DeviceCodeScreenProps = Readonly<{
  onSession: (me: Me) => void;
  /** Switch back to the key. */
  onUseKey: () => void;
  footer?: ReactNode;
}>;

/** A1, other way in: the 6-digit code made by "Add a device" on a signed-in device. */
export function DeviceCodeScreen({ onSession, onUseKey, footer }: DeviceCodeScreenProps) {
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
    <Page>
      <Title>{t('code.title')}</Title>
      <Body as="form" onSubmit={(event: FormEvent) => void submit(event)} noValidate>
        <TextField
          label={t('code.label')}
          helper={t('code.helper')}
          value={value}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          {...(error ? { error } : {})}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        />
        <Actions>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('key.checking') : t('code.submit')}
          </Button>
          <Button variant="quiet" fullWidth onClick={onUseKey}>
            {t('code.useKey')}
          </Button>
        </Actions>
        {footer}
      </Body>
    </Page>
  );
}
