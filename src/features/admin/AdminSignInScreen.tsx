import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetPasskey, passkeysSupported, signInWithPasskey, signOut } from '../../api/auth';
import { getCredentialId } from '../../api/device/session';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, Message, Muted, Narrow, Section, Title } from './shared';

export type AdminSignInScreenProps = Readonly<{
  onSignedIn: () => void;
}>;

/** Admin sign-in: the passkey only; admins have no password (D-011). */
export function AdminSignInScreen({ onSignedIn }: AdminSignInScreenProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setProblem(null);
    // The admin's passkey id is kept on the device that registered it; without it there is nothing to offer.
    if (getCredentialId() === null) {
      setProblem(t('error.noPasskey'));
      return;
    }
    setBusy(true);
    const result = await signInWithPasskey();
    if (result.ok && result.data.me.role === 'admin') {
      setBusy(false);
      onSignedIn();
      return;
    }
    if (result.ok) {
      // A seller's passkey on this browser: not an admin, so end that session again.
      await signOut();
      forgetPasskey();
      setProblem(t('error.noPasskey'));
    } else {
      setProblem(
        result.error === 'invalid_credentials' ? t('error.noPasskey') : failureText(t, result),
      );
    }
    setBusy(false);
  }, [onSignedIn, t]);

  return (
    <Narrow>
      <Title>{t('signIn.title')}</Title>
      <Section>
        <Muted>{t('signIn.text')}</Muted>
        {problem ? <Message $bad>{problem}</Message> : null}
        {passkeysSupported() ? (
          <Button variant="primary" disabled={busy} onClick={() => void signIn()}>
            {t('signIn.button')}
          </Button>
        ) : (
          <Message $bad>{t('signIn.noPasskeysHere')}</Message>
        )}
      </Section>
    </Narrow>
  );
}
