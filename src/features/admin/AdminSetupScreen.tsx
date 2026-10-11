import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { adminSetup, passkeysSupported, registerDevice, signOut } from '../../api/auth';
import { guessDevice } from '../../api/device/guessDevice';
import type { Me } from '../../../shared/authContract';
import { Button, Segmented, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { failureText, FormSection, Message, Muted, Narrow, Section, Sub, Title } from './shared';

export type AdminSetupScreenProps = Readonly<{
  /** The admin passkey exists and this device is signed in. */
  onDone: () => void;
  /** A link under the key form ("Already set up? Sign in"). */
  footer?: ReactNode;
  /** Which tab opens first: the setup key, or the 6-digit code from another admin device. */
  initialMethod?: Method;
  /** The 6-digit code screen, supplied by the app layer (a feature may not import another). */
  codeScreen?: (props: {
    onSession: (me: Me) => void;
    onUseKey: () => void;
    footer?: ReactNode;
  }) => ReactNode;
}>;

type Method = 'key' | 'code';
type Step = 'key' | 'passkey' | 'done';

/** First-time admin setup: the setup key, then a passkey. Route-agnostic. */
export function AdminSetupScreen({
  onDone,
  footer,
  initialMethod = 'key',
  codeScreen,
}: AdminSetupScreenProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [step, setStep] = useState<Step>('key');
  const [method, setMethod] = useState<Method>(initialMethod);
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

  // The code of a kitchen is refused here: end that session and say where it belongs.
  const codeAccepted = useCallback(
    async (me: Me) => {
      if (me.role !== 'admin') {
        await signOut();
        setProblem(t('setup.notAdminCode'));
        return;
      }
      setProblem(null);
      setDeviceName(t(`setup.deviceGuess.${guessDevice()}`));
      setStep('passkey');
    },
    [t],
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
      {step === 'key' && method === 'key' && codeScreen ? (
        <Segmented
          label={t('setup.method')}
          value={method}
          onChange={(next) => {
            setMethod(next);
            setProblem(null);
          }}
          options={[
            { value: 'key', label: t('setup.tabKey') },
            { value: 'code', label: t('setup.tabCode') },
          ]}
        />
      ) : null}
      {step === 'key' && method === 'code' && codeScreen ? (
        <>
          {problem ? <Message $bad>{problem}</Message> : null}
          {codeScreen({
            onSession: (me) => void codeAccepted(me),
            onUseKey: () => setMethod('key'),
            footer,
          })}
        </>
      ) : null}
      {step === 'key' && method === 'key' ? (
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
          {footer}
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
