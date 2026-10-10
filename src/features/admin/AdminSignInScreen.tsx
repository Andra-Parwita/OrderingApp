import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { passkeysSupported, signInWithPasskey, signOut } from '../../api/auth';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, Message, Muted, Narrow, Section, Title } from './shared';

export type AdminSignInScreenProps = Readonly<{
  onSignedIn: () => void;
  /** Start the passkey prompt on arrival (from "Already set up? Sign in"). */
  autoStart?: boolean;
}>;

/** Admin sign-in: the passkey only; admins have no password (D-011). */
export function AdminSignInScreen({ onSignedIn, autoStart = false }: AdminSignInScreenProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setProblem(null);
    setBusy(true);
    // The kept admin id is only a hint; with none, the browser offers every passkey for this site.
    let result = await signInWithPasskey('admin');
    let wrongRole = false;
    if (result.ok && result.data.me.role !== 'admin') {
      // A seller's passkey was picked: end that session, say so, and ask once more with the full
      // list. Nothing is forgotten: the seller keeps its own passkey hint.
      await signOut();
      wrongRole = true;
      setProblem(t('error.sellerPasskey'));
      result = await signInWithPasskey('admin', true);
      if (result.ok && result.data.me.role !== 'admin') await signOut();
    }
    setBusy(false);
    if (result.ok && result.data.me.role === 'admin') {
      setProblem(null);
      onSignedIn();
    } else if (!result.ok) {
      if (wrongRole && result.error === 'passkey_cancelled') return; // keep the clearer message
      setProblem(
        result.error === 'passkey_cancelled' || result.error === 'invalid_credentials'
          ? t('error.noPasskey')
          : failureText(t, result),
      );
    }
  }, [onSignedIn, t]);

  // Once per arrival (a ref also covers React's double effect run in development).
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !passkeysSupported() || started.current) return;
    started.current = true;
    void signIn();
  }, [autoStart, signIn]);

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
