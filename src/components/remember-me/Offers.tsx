import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { hideChip, hideNudge } from '../../api/customer/state';
import { readMyOrders } from '../../api/device/myOrders';
import { rememberMeSupported, restoreWithPasskey } from '../../api/customer/rememberMe';
import { activeOrders } from '../../api/device/myOrders';
import { enablePush } from '../install/pushBrowser';
import { Button, Icon } from '../../ui';
import { useChipHidden, useNudgeHidden, useRememberAction, useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { ErrorLine } from './parts';
import { JoinSheet } from './PhoneSheets';
import { RememberMeSheet } from './RememberMeSheet';

// The quiet offers (plan 087): a chip on the menu home (first time; the cross hides it for good),
// one line after the second order, and "Restore them" on an empty My orders. Each hides itself when
// Remember me is on or the browser cannot make a passkey.

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin: ${({ theme }) => theme.spacing.xs} 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const PillMain = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  cursor: pointer;
`;
const PillX = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${({ theme }) => theme.size.tap}px;
  min-height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;
const Line = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: ${({ theme }) => theme.spacing.md} 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
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

/** The menu home chip. Tapping the text opens the explanation first; the cross hides it for good. */
export function RememberMeChip() {
  const { t } = useTranslation(REMEMBER_NS);
  const on = useRememberMeLocal() !== null;
  const hidden = useChipHidden();
  const [open, setOpen] = useState(false);
  if (on || hidden || !rememberMeSupported()) return null;
  return (
    <>
      <Pill>
        <PillMain
          type="button"
          aria-label={t('chipOpen')}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Icon name="lock" />
          {t('chip')}
        </PillMain>
        <PillX type="button" aria-label={t('hide')} onClick={hideChip}>
          <Icon name="x" />
        </PillX>
      </Pill>
      {open ? (
        <RememberMeSheet
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** One line after the second order: "Remember me on all your phones? Learn more ✕". */
export function RememberMeNudge() {
  const { t } = useTranslation(REMEMBER_NS);
  const on = useRememberMeLocal() !== null;
  const hidden = useNudgeHidden();
  const [open, setOpen] = useState(false);
  if (on || hidden || !rememberMeSupported() || readMyOrders().length < 2) return null;
  return (
    <>
      <Line>
        {t('nudge')}
        <LinkButton
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('learn')}
        </LinkButton>
        <PillX type="button" aria-label={t('hide')} onClick={hideNudge}>
          <Icon name="x" />
        </PillX>
      </Line>
      {open ? (
        <RememberMeSheet
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Empty My orders: "Had orders on another phone or app? Restore them". */
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
