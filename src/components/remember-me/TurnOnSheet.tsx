import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { customerLabel } from '../../../shared/passkeyLabels';
import { rememberFirstName, savedFirstName } from '../../api/device/firstName';
import { turnOnRememberMe } from '../../api/customer/rememberMe';
import { BottomSheet, Button, Icon, TextField } from '../../ui';
import { useRememberAction } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { Actions, ErrorLine, Text } from './parts';
import { HintBox, NoteLine } from './cardParts';

/**
 * Plan 092: "Turn on" asks for the first name before the passkey prompt (it names the passkey), says
 * why the address is kept, and where to save the passkey. Skip (only when no name is saved yet)
 * gives the generic name. The name is saved on this phone first, then the passkey is made.
 */
export function TurnOnSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const { busy, error, run } = useRememberAction();
  const [known] = useState(() => savedFirstName() !== '');
  const [name, setName] = useState(() => savedFirstName());
  const go = (withName: boolean) => {
    if (withName) rememberFirstName(name);
    void run(turnOnRememberMe).then((outcome) => {
      if (outcome.ok) onClose();
    });
  };
  const label = customerLabel(name);
  return (
    <BottomSheet title={t('turnOnT')} onClose={onClose}>
      <Text>{t('intro')}</Text>
      <TextField
        label={t('nameL')}
        value={name}
        autoComplete="given-name"
        maxLength={40}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Text>
        <Trans t={t} i18nKey="named" values={{ label }} components={{ b: <b /> }} />
      </Text>
      <HintBox>{t('keeperHint')}</HintBox>
      <NoteLine>
        <Icon name="check" />
        <span>{t('addrLine')}</span>
      </NoteLine>
      {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
      <Actions>
        <Button
          fullWidth
          disabled={busy}
          onClick={() => {
            go(true);
          }}
        >
          {busy ? t('working') : t('cont')}
        </Button>
        <Text>{t('contNote')}</Text>
        {known ? null : (
          <>
            <Button
              fullWidth
              variant="quiet"
              disabled={busy}
              onClick={() => {
                go(false);
              }}
            >
              {t('skip')}
            </Button>
            <Text>{t('skipNote', { label: customerLabel('') })}</Text>
          </>
        )}
      </Actions>
    </BottomSheet>
  );
}
