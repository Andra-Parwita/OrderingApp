import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { rememberMeSupported } from '../../api/customer/rememberMe';
import { BottomSheet, Icon } from '../../ui';
import { useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { Heading, Text, Ticks } from './parts';
import { setWantsRememberMe, wantsRememberMe } from './pendingTurnOn';

// Plan 096: on the name step, one quiet row under the first-name field: "[ ] Remember me on all my
// phones (?)". Off by default; the "?" slides up the explanation. Ticked: the turn-on starts once the
// order is placed. Hidden when Remember me is on or the browser cannot make a passkey.

const Row = styled.div`
  display: flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Label = styled.label`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  cursor: pointer;

  input {
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    margin: 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Help = styled.button`
  flex: none;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  cursor: pointer;

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: ${({ theme }) => theme.border.focus} solid currentColor;
    border-radius: 50%;
    font-size: ${({ theme }) => theme.type.size.sm};
    font-weight: 700;
  }
`;

const ADVANTAGES = ['adv1', 'adv2', 'adv3'] as const;
const REASONS = ['why1', 'why2', 'why3', 'why4'] as const;

/** The explanation only (no buttons to turn on): what it keeps, why it is safe, the passkey, "ordering works without it". */
export function RememberMeHelpSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(REMEMBER_NS);
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
      <Text>
        <b>{t('note')}</b>
      </Text>
    </BottomSheet>
  );
}

export function RememberMeTick() {
  const { t } = useTranslation(REMEMBER_NS);
  const id = useId();
  const on = useRememberMeLocal() !== null;
  const [ticked, setTicked] = useState(() => wantsRememberMe());
  const [help, setHelp] = useState(false);
  if (on || !rememberMeSupported()) return null;
  return (
    <>
      <Row>
        <Label htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={ticked}
            onChange={(event) => {
              setTicked(event.target.checked);
              setWantsRememberMe(event.target.checked);
            }}
          />
          {t('tick')}
        </Label>
        <Help
          type="button"
          aria-label={t('tickHelp')}
          onClick={() => {
            setHelp(true);
          }}
        >
          <span aria-hidden="true">?</span>
        </Help>
      </Row>
      {help ? (
        <RememberMeHelpSheet
          onClose={() => {
            setHelp(false);
          }}
        />
      ) : null}
    </>
  );
}
