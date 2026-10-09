import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { adminSetup, passkeysSupported, registerDevice } from '../../api/auth';
import { Button, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, FormSection, Message, Muted, Narrow, Section, Sub, Title } from './shared';

export type AdminSetupScreenProps = Readonly<{
  /** The admin passkey exists and this device is signed in. */
  onDone: () => void;
}>;

type Step = 'key' | 'passkey' | 'done';

/** First-time admin setup: the setup key, then a passkey. Route-agnostic. */
export function AdminSetupScreen({ onDone }: AdminSetupScreenProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [step, setStep] = useState<Step>('key');
  const [key, setKey] = useState('');
  const [deviceName, setDeviceName] = useState(() => t('setup.deviceDefault'));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submitKey = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (key.trim() === '') return;
      setBusy(true);
      setProblem(null);
      const result = await adminSetup(key.trim());
      setBusy(false);
      if (result.ok) setStep('passkey');
      else setProblem(failureText(t, result));
    },
    [key, t],
  );

  const createPasskey = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (deviceName.trim() === '') return;
      setBusy(true);
      setProblem(null);
      const result = await registerDevice({ kind: 'passkey', deviceName: deviceName.trim() });
      setBusy(false);
      if (result.ok) setStep('done');
      else setProblem(failureText(t, result));
    },
    [deviceName, t],
  );

  return (
    <Narrow>
      <Title>{t('setup.title')}</Title>
      {step === 'key' ? (
        <FormSection onSubmit={(event) => void submitKey(event)}>
          <Sub>{t('setup.keyTitle')}</Sub>
          <TextField
            label={t('setup.keyLabel')}
            helper={t('setup.keyHelper')}
            value={key}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setKey(event.target.value)}
          />
          {problem ? <Message $bad>{problem}</Message> : null}
          <Button type="submit" variant="primary" disabled={busy || key.trim() === ''}>
            {t('setup.continue')}
          </Button>
          <Muted>{t('setup.closes')}</Muted>
        </FormSection>
      ) : null}
      {step === 'passkey' && !passkeysSupported() ? (
        <Section>
          <Sub>{t('setup.passkeyTitle')}</Sub>
          <Message $bad>{t('setup.noPasskeysHere')}</Message>
        </Section>
      ) : null}
      {step === 'passkey' && passkeysSupported() ? (
        <FormSection onSubmit={(event) => void createPasskey(event)}>
          <Sub>{t('setup.passkeyTitle')}</Sub>
          <Muted>{t('setup.passkeyText')}</Muted>
          <TextField
            label={t('setup.deviceLabel')}
            value={deviceName}
            maxLength={40}
            onChange={(event) => setDeviceName(event.target.value)}
          />
          {problem ? <Message $bad>{problem}</Message> : null}
          <Button type="submit" variant="primary" disabled={busy || deviceName.trim() === ''}>
            {t('setup.create')}
          </Button>
        </FormSection>
      ) : null}
      {step === 'done' ? (
        <Section>
          <Sub>{t('setup.doneTitle')}</Sub>
          <Muted>{t('setup.doneText')}</Muted>
          <Button variant="primary" onClick={onDone}>
            {t('setup.open')}
          </Button>
        </Section>
      ) : null}
    </Narrow>
  );
}
