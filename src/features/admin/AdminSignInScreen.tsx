import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetPasskey, signInWithPasskey, signOut } from '../../api/auth';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, Message, Muted, Narrow, Section, Title } from './shared';

export type AdminSignInScreenProps = Readonly<{
  onSignedIn: () => void;
}>;

/** Admin sign-in: the (simulated) passkey only; admins have no password (D-011). */
export function AdminSignInScreen({ onSignedIn }: AdminSignInScreenProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setBusy(true);
    setProblem(null);
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
        <Button variant="primary" disabled={busy} onClick={() => void signIn()}>
          {t('signIn.button')}
        </Button>
        <Muted>{t('signIn.simulated')}</Muted>
      </Section>
    </Narrow>
  );
}
