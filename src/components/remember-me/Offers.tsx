import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { rememberMeSupported, restoreWithPasskey } from '../../api/customer/rememberMe';
import { activeOrders } from '../../api/device/myOrders';
import { enablePush } from '../install/pushBrowser';
import { Button } from '../../ui';
import { useRememberAction, useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { ErrorLine } from './parts';
import { JoinSheet } from './PhoneSheets';

// The quiet offer on an empty My orders (plan 087, worded in plan 096): "Turned on Remember me
// before? Restore your orders". It hides itself when Remember me is on or the browser cannot make a
// passkey. (The menu chip and the line after the 2nd order are gone: plan 096 pills instead.)

const LinkButton = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  max-width: 18rem;
`;

/** Empty My orders: "Turned on Remember me before? Restore your orders". */
export function RestoreOrders() {
  const { t } = useTranslation(REMEMBER_NS);
  const on = useRememberMeLocal() !== null;
  const { busy, error, run } = useRememberAction();
  const [restored, setRestored] = useState<number | null>(null);
  const [join, setJoin] = useState(false);
  const [pushed, setPushed] = useState(false);
  if (!rememberMeSupported() && restored === null) return null;
  if (on && restored === null) return null;
  const active = activeOrders();
  const canPush = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  return (
    <Box>
      {restored === null ? (
        <>
          <strong>{t('restoreQ')}</strong>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void run(restoreWithPasskey).then((outcome) => {
                if (outcome.ok) setRestored(outcome.restored);
              });
            }}
          >
            {busy ? t('working') : t('restoreDo')}
          </Button>
          <LinkButton
            type="button"
            onClick={() => {
              setJoin(true);
            }}
          >
            {t('useCode')}
          </LinkButton>
          {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
        </>
      ) : (
        <>
          <span role="status">
            {restored > 0 ? t('restored', { count: restored }) : t('restoredNone')}
          </span>
          {canPush && active.length > 0 && !pushed ? (
            <Button
              variant="secondary"
              onClick={() => {
                void enablePush(active.map((order) => order.token)).then(() => {
                  setPushed(true);
                });
              }}
            >
              {t('pushAgain')}
            </Button>
          ) : null}
          {pushed ? <span role="status">{t('pushDone')}</span> : null}
        </>
      )}
      {join ? (
        <JoinSheet
          onClose={() => {
            setJoin(false);
          }}
        />
      ) : null}
    </Box>
  );
}
