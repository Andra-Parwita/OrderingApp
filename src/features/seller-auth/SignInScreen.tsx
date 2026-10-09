import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { passkeysSupported, signInWithPasskey, signInWithPassword, signOut } from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { Button } from '../../ui';
import { failureMessage, guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';
import { Actions, Body, Failure, Hint, Page, PasswordField, Section, Title } from './parts';

export type SignInScreenProps = Readonly<{
  /**
   * The kitchen the person signs in to (the password check needs it). Without one only the
   * passkey works: a device that kept a passkey but not the kitchen (D-050).
   */
  slug?: string | undefined;
  /** Shown above the sign-in (the kitchen's name). */
  kitchenName?: string;
  /** A chef signs in to the seller's kitchen with their own password. */
  chefId?: string;
  onSignedIn: (me: Me) => void;
  /** A link shown directly under the sign-in options (e.g. first-time setup). */
  footer?: ReactNode;
  /**
   * "Switch person" (D-050): start the passkey prompt on arrival with no passkey pre-selected, so
   * the person picks their own. If they cancel, the screen is the normal one.
   */
  switchPerson?: boolean;
}>;

/**
 * A3: sign in with the passkey this device kept, or with a password. On an IP-address web address
 * (the home Wi-Fi test of a phone) passkeys cannot work (D-046): only the password shows.
 */
export function SignInScreen({
  slug,
  kitchenName,
  chefId,
  onSignedIn,
  footer,
  switchPerson = false,
}: SignInScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const passkeys = passkeysSupported();
  const canUsePassword = slug !== undefined;
  const [showPassword, setShowPassword] = useState(!passkeys && canUsePassword);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const withPasskey = useCallback(
    async (discoverable = false) => {
      setError(null);
      setBusy(true);
      // The kept seller id is only a hint; with none, the browser offers every passkey for this site.
      const result = await signInWithPasskey('staff', discoverable);
      if (result.ok && result.data.me.role === 'admin') {
        // The admin's passkey was picked: end that session; the admin has their own page.
        await signOut();
        setBusy(false);
        setError(t('signIn.adminPasskey'));
        return;
      }
      setBusy(false);
      if (result.ok) onSignedIn(result.data.me);
      else if (result.error === 'invalid_credentials') {
        setError(t('signIn.noPasskey'));
        setShowPassword(canUsePassword);
      } else {
        setError(failureMessage(t, result));
        if (result.error === 'passkey_cancelled') setShowPassword(canUsePassword); // no passkey, or prompt closed
      }
    },
    [canUsePassword, onSignedIn, t],
  );

  // Once per arrival (a ref also covers React's double effect run in development).
  const started = useRef(false);
  useEffect(() => {
    if (!switchPerson || !passkeys || started.current) return;
    started.current = true;
    void withPasskey(true);
  }, [switchPerson, passkeys, withPasskey]);

  const withPassword = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (slug === undefined) return;
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
        {passkeys ? (
          <Actions>
            <Button
              variant="primary"
              fullWidth
              disabled={busy}
              onClick={() => void withPasskey(switchPerson)}
            >
              {t('signIn.passkey')}
            </Button>
            {canUsePassword ? (
              <Button
                fullWidth
                aria-expanded={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? t('signIn.hidePassword') : t('signIn.usePassword')}
              </Button>
            ) : null}
          </Actions>
        ) : (
          <Hint>{t('signIn.noPasskeysHere')}</Hint>
        )}
        {showPassword && canUsePassword ? (
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
