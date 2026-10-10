import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { passkeysSupported, signInWithPasskey, signInWithPassword, signOut } from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { Button } from '../../ui';
import { failureMessage, guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';
import {
  Actions,
  AuthForm,
  AuthNote,
  AuthPanel,
  AuthTitle,
  BackButton,
  BigAction,
  Divider,
  ErrorText,
  FaceIcon,
  PasswordField,
} from './parts';

export type SignInScreenProps = Readonly<{
  /**
   * The kitchen the person signs in to (the password check needs it). Without one only the
   * passkey works: a device that kept a passkey but not the kitchen (D-050).
   */
  slug?: string | undefined;
  /** The frame above shows the kitchen's logo and name; kept so callers need not change. */
  kitchenName?: string;
  /** A chef signs in to the seller's kitchen with their own password. */
  chefId?: string;
  onSignedIn: (me: Me) => void;
  /** A link shown under the sign-in options (first time on this device, "Use your invite key"). */
  footer?: ReactNode;
  /**
   * "Switch person" (D-050): start the passkey prompt on arrival with no passkey pre-selected, so
   * the person picks their own. If they cancel, the screen is the normal one.
   */
  switchPerson?: boolean;
}>;

/**
 * Sign in: the passkey this device kept (one big button), or the kitchen's password on a second
 * step. On an IP-address web address (the home Wi-Fi test of a phone) passkeys cannot work (D-046):
 * only the password shows. The seller API takes no username: the kitchen (and a chef's id) is
 * already known, so the password step asks for the password alone.
 */
export function SignInScreen({
  slug,
  chefId,
  onSignedIn,
  footer,
  switchPerson = false,
}: SignInScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const passkeys = passkeysSupported();
  const canUsePassword = slug !== undefined;
  const [step, setStep] = useState<'main' | 'password'>(
    !passkeys && canUsePassword ? 'password' : 'main',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // under the big button
  const [passwordError, setPasswordError] = useState<string | null>(null); // under the password
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
      if (result.ok) {
        onSignedIn(result.data.me);
        return;
      }
      // No passkey, or the prompt was closed: say so, and open the password step when there is one.
      const message =
        result.error === 'invalid_credentials' ? t('signIn.noPasskey') : failureMessage(t, result);
      if (
        canUsePassword &&
        (result.error === 'invalid_credentials' || result.error === 'passkey_cancelled')
      ) {
        setStep('password');
        setPasswordError(message);
      } else setError(message);
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
        setPasswordError(t('signIn.empty'));
        return;
      }
      setPasswordError(null);
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
      else setPasswordError(failureMessage(t, result));
    },
    [chefId, onSignedIn, password, slug, t],
  );

  const goTo = (next: 'main' | 'password') => {
    setError(null);
    setPasswordError(null);
    setStep(next);
  };

  if (step === 'password' && canUsePassword) {
    return (
      <AuthPanel>
        {passkeys ? <BackButton onClick={() => goTo('main')} /> : null}
        <AuthTitle>{t('signIn.passwordTitle')}</AuthTitle>
        {!passkeys ? <AuthNote>{t('signIn.noPasskeysHere')}</AuthNote> : null}
        <AuthForm onSubmit={(event: FormEvent) => void withPassword(event)} noValidate>
          <PasswordField
            label={t('signIn.passwordLabel')}
            value={password}
            onChange={(next) => {
              setPassword(next);
              setPasswordError(null);
            }}
            autoComplete="current-password"
            {...(passwordError ? { error: passwordError } : {})}
          />
          <BigAction>
            <Button type="submit" variant="primary" fullWidth disabled={busy}>
              {busy ? t('signIn.working') : t('signIn.submit')}
            </Button>
          </BigAction>
        </AuthForm>
        {!passkeys ? (
          <>
            <Divider />
            {footer}
            <AuthNote>{t('signIn.lost')}</AuthNote>
          </>
        ) : null}
      </AuthPanel>
    );
  }

  return (
    <AuthPanel>
      <AuthTitle>{t('signIn.title')}</AuthTitle>
      {passkeys ? (
        <Actions>
          <BigAction>
            <Button
              variant="primary"
              fullWidth
              disabled={busy}
              onClick={() => void withPasskey(switchPerson)}
            >
              <FaceIcon />
              {t('signIn.passkey')}
            </Button>
          </BigAction>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {canUsePassword ? (
            <Button fullWidth onClick={() => goTo('password')}>
              {t('signIn.usePassword')}
            </Button>
          ) : null}
        </Actions>
      ) : (
        <AuthNote>{t('signIn.noPasskeysHere')}</AuthNote>
      )}
      <Divider />
      {footer}
      <AuthNote>{t('signIn.lost')}</AuthNote>
    </AuthPanel>
  );
}
