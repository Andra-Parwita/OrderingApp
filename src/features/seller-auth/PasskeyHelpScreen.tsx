import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { passkeysSupported, registerDevice } from '../../api/auth';
import type { Me } from '../../../shared/authContract';
import { Button, Segmented } from '../../ui';
import { guessDevice, helpTabFor, failureMessage, type HelpTab } from './authText';
import { AUTH_NS } from './i18n/register';
import {
  Actions,
  Body,
  DeviceNameField,
  Failure,
  Hint,
  Page,
  Section,
  SectionTitle,
  Steps,
  Title,
  useDeviceName,
} from './parts';

export type PasskeyHelpScreenProps = Readonly<{
  /** Shown as "Hi <name>" (the seller's or chef's name). */
  name?: string;
  /** The device is registered: a full session now exists. */
  onDone: (me: Me) => void;
  /** This phone can't make a passkey. */
  onUsePassword: () => void;
}>;

const TABS: ReadonlyArray<HelpTab> = ['iphone', 'android', 'computer'];

/**
 * A2: how to make a passkey on this kind of device, then the button that makes it. On an
 * IP-address web address passkeys cannot work (D-046), so this only offers the password.
 */
export function PasskeyHelpScreen({ name, onDone, onUsePassword }: PasskeyHelpScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const supported = passkeysSupported();
  const [tab, setTab] = useState<HelpTab>(() => helpTabFor(guessDevice()));
  const device = useDeviceName();
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    const deviceName = device.name.trim();
    if (deviceName === '') {
      setNameError(t('deviceName.empty'));
      return;
    }
    setNameError(null);
    setError(null);
    setBusy(true);
    const result = await registerDevice({ kind: 'passkey', deviceName });
    setBusy(false);
    if (result.ok) onDone(result.data.me);
    else setError(failureMessage(t, result));
  }, [device.name, onDone, t]);

  if (!supported) {
    return (
      <Page>
        <Title>{t('passkey.title')}</Title>
        <Body>
          {name ? <Hint>{t('passkey.greeting', { name })}</Hint> : null}
          <Hint>{t('passkey.unavailable')}</Hint>
          <Actions>
            <Button variant="primary" fullWidth onClick={onUsePassword}>
              {t('password.title')}
            </Button>
          </Actions>
        </Body>
      </Page>
    );
  }

  return (
    <Page>
      <Title>{t('passkey.title')}</Title>
      <Body>
        {name ? <Hint>{t('passkey.greeting', { name })}</Hint> : null}
        <Section>
          <SectionTitle>{t('passkey.deviceLabel')}</SectionTitle>
          <Segmented
            label={t('passkey.deviceGroup')}
            value={tab}
            onChange={setTab}
            options={TABS.map((value) => ({ value, label: t(`passkey.${value}`) }))}
          />
          <Steps>
            {(['1', '2', '3'] as const).map((step) => (
              <li key={step}>{t(`passkey.steps.${tab}.${step}`)}</li>
            ))}
          </Steps>
          <Hint>{t(`passkey.note.${tab}`)}</Hint>
        </Section>
        <Section>
          <DeviceNameField
            value={device.name}
            onChange={device.setName}
            {...(nameError ? { error: nameError } : {})}
          />
          {error ? <Failure role="alert">{error}</Failure> : null}
          <Actions>
            <Button variant="primary" fullWidth disabled={busy} onClick={() => void create()}>
              {busy ? t('passkey.working') : t('passkey.submit')}
            </Button>
            <Button variant="quiet" fullWidth onClick={onUsePassword}>
              {t('passkey.usePassword')}
            </Button>
          </Actions>
        </Section>
      </Body>
    </Page>
  );
}
