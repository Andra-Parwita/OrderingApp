import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { restoreWithPasskey } from '../../api/customer/rememberMe';
import { BottomSheet, Button, Icon } from '../../ui';
import { usePrfSupport, useRememberAction } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { Actions, ErrorLine, Heading, Text, Ticks } from './parts';
import { TurnOnSheet } from './TurnOnSheet';

const ADVANTAGES = ['adv1', 'adv2', 'adv3'] as const;
const REASONS = ['why1', 'why2', 'why3', 'why4'] as const;

/**
 * The explanation first (what you get, why it is safe, what a passkey is), then "Turn on". Opened by
 * the chip, the Settings card and the line after an order. "Not now" only closes it.
 */
export function RememberMeSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const { busy, error, run } = useRememberAction();
  const prf = usePrfSupport();
  const [turning, setTurning] = useState(false);
  const go = (action: typeof restoreWithPasskey) => {
    void run(action).then((outcome) => {
      if (outcome.ok) onClose();
    });
  };
  if (turning) return <TurnOnSheet onClose={onClose} />;
  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <Text>{t('intro')}</Text>
      <Ticks>
        {ADVANTAGES.map((key) => (
          <li key={key}>
            <Icon name="check" />
            <span>{t(key)}</span>
          </li>
        ))}
      </Ticks>
      <Heading>{t('whyH')}</Heading>
      <Ticks>
        {REASONS.map((key) => (
          <li key={key}>
            <Icon name="lock" />
            <span>{t(key)}</span>
          </li>
        ))}
      </Ticks>
      <Heading>{t('passkeyH')}</Heading>
      <Text>{t('passkeyP')}</Text>
      {prf === false ? <Text role="note">{t('noPrf')}</Text> : null}
      <Text>{t('note')}</Text>
      {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
      <Actions>
        <Button
          fullWidth
          disabled={busy}
          onClick={() => {
            setTurning(true);
          }}
        >
          {t('turnOn')}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          disabled={busy}
          onClick={() => {
            go(restoreWithPasskey);
          }}
        >
          {t('already')}
        </Button>
        <Button fullWidth variant="quiet" onClick={onClose}>
          {t('notNow')}
        </Button>
      </Actions>
    </BottomSheet>
  );
}
