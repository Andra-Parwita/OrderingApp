import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithPasskey, signInWithPassword } from '../../api/auth';
import { getCredentialId } from '../../api/device/session';
import type { Me } from '../../../shared/authContract';
import { Button } from '../../ui';
import { failureMessage, guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';
import { Actions, Body, Failure, Hint, Page, PasswordField, Section, Title } from './parts';

export type SignInScreenProps = Readonly<{
  /** The kitchen the person signs in to (the password check needs it). */
  slug: string;
  /** Shown above the sign-in (the kitchen's name). */
  kitchenName?: string;
  /** A chef signs in to the seller's kitchen with their own password. */
  chefId?: string;
  onSignedIn: (me: Me) => void;
  /** A link shown directly under the sign-in options (e.g. first-time setup). */
  footer?: ReactNode;
}>;

/** A3: sign in with the passkey this device kept, or with a password. */
export function SignInScreen({ slug, kitchenName, chefId, onSignedIn, footer }: SignInScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const withPasskey = useCallback(async () => {
    setError(null);
    if (getCredentialId() === null) {
      setError(t('signIn.noPasskey'));
      setShowPassword(true);
      return;
    }
    setBusy(true);
    const result = await signInWithPasskey();
    setBusy(false);
    if (result.ok) onSignedIn(result.data.me);
    else setError(failureMessage(t, result));
  }, [onSignedIn, t]);

  const withPassword = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (password === '') {
        setError(t('signIn.empty'));
        return;
      }
      setError(null);
      setBusy(true);
      // A returning device is added under its guessed name; Devices lets the person rename it.
      const result = await signInWithPassword({
        slug,
        password,
        deviceName: t(`deviceName.${guessDevice()}`),
        ...(chefId ? { chefId } : {}),
      });
      setBusy(false);
      if (result.ok) onSignedIn(result.data.me);
      else setError(failureMessage(t, result));
    },
    [chefId, onSignedIn, password, slug, t],
  );

  return (
    <Page>
      <Title>{kitchenName ?? t('signIn.title')}</Title>
      <Body>
        {kitchenName ? <Hint>{t('signIn.title')}</Hint> : null}
        <Actions>
          <Button variant="primary" fullWidth disabled={busy} onClick={() => void withPasskey()}>
            {t('signIn.passkey')}
          </Button>
          <Button
            fullWidth
            aria-expanded={showPassword}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? t('signIn.hidePassword') : t('signIn.usePassword')}
          </Button>
        </Actions>
        {showPassword ? (
          <Section as="form" onSubmit={(event: FormEvent) => void withPassword(event)} noValidate>
            <PasswordField
              label={t('signIn.passwordLabel')}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <Button type="submit" variant="primary" fullWidth disabled={busy}>
              {busy ? t('signIn.working') : t('signIn.submit')}
            </Button>
          </Section>
        ) : null}
        {error ? <Failure role="alert">{error}</Failure> : null}
        {footer}
        <Hint>{t('signIn.lost')}</Hint>
      </Body>
    </Page>
  );
}
