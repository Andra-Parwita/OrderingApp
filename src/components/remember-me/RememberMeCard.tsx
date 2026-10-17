import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { lastKitchen } from '../../api/device/lastKitchen';
import {
  addThisPhonePasskey,
  deleteMySavedData,
  kitchenCode,
  rememberMeSupported,
  restoreWithPasskey,
  signOutHere,
  turnOnRememberMe,
} from '../../api/customer/rememberMe';
import { Button, Icon, WarningDialog } from '../../ui';
import { useRememberAction, useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { Actions, ErrorLine, Text } from './parts';
import { AddPhoneSheet, JoinSheet } from './PhoneSheets';
import { RememberMeSheet } from './RememberMeSheet';

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
const Head = styled.h2`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
`;
const OnTag = styled.span`
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Fact = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  b {
    font-size: ${({ theme }) => theme.type.size.md};
    font-weight: 600;
  }
  output {
    font-size: ${({ theme }) => theme.type.size.base};
    font-variant-numeric: tabular-nums;
  }
`;

type Ask = 'signOut' | 'delete' | null;
type Sheet = 'explain' | 'addPhone' | 'join' | null;

/**
 * The Settings card (plan 087). Off: what it is, with Turn on / I already use it. On: this phone, the
 * customer code for the current kitchen, Add another phone, Sign out (asks), Delete my saved data (asks).
 */
export function RememberMeCard({ kitchenName }: Readonly<{ kitchenName?: string }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const local = useRememberMeLocal();
  const { busy, error, run } = useRememberAction();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [code, setCode] = useState<string | null>(null);
  const [removed, setRemoved] = useState<'signalled' | 'byHand' | null>(null);
  const on = local !== null;
  useEffect(() => {
    if (!on) return;
    void kitchenCode(lastKitchen()).then(setCode);
  }, [on]);

  if (!rememberMeSupported() && !on) return null;

  const confirmDelete = () => {
    setAsk(null);
    void deleteMySavedData().then((result) => {
      if (result.ok) setRemoved(result.signalled ? 'signalled' : 'byHand');
    });
  };
  return (
    <Card aria-labelledby="remember-me-title">
      <Head id="remember-me-title">
        <span>{t('chip')}</span>
        {on ? <OnTag>{t('on')}</OnTag> : null}
      </Head>
      {local === null ? (
        <>
          <Text>{t('cardOffP')}</Text>
          {removed ? (
            <Text role="status">
              {t('deleted')} {t(removed === 'signalled' ? 'removeSignalled' : 'removeByHand')}
            </Text>
          ) : null}
          {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
          <Actions>
            <Button
              fullWidth
              disabled={busy}
              onClick={() => {
                void run(turnOnRememberMe);
              }}
            >
              {busy ? t('working') : t('turnOn')}
            </Button>
            <Button
              fullWidth
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void run(restoreWithPasskey);
              }}
            >
              {t('already')}
            </Button>
            <Button
              fullWidth
              variant="quiet"
              onClick={() => {
                setSheet('explain');
              }}
            >
              {t('learn')}
            </Button>
            <Button
              fullWidth
              variant="quiet"
              onClick={() => {
                setSheet('join');
              }}
            >
              {t('useCode')}
            </Button>
          </Actions>
        </>
      ) : local.setup ? (
        <>
          <Text>{t('setupP')}</Text>
          {error ? <ErrorLine role="alert">{error}</ErrorLine> : null}
          <Actions>
            <Button
              fullWidth
              disabled={busy}
              onClick={() => {
                void run(addThisPhonePasskey);
              }}
            >
              {t('setupDo')}
            </Button>
          </Actions>
        </>
      ) : (
        <>
          <Fact>
            <b>{t('thisPhone')}</b>
            <span>{t('thisPhoneV')}</span>
          </Fact>
          {code ? (
            <Fact>
              <b>{kitchenName ? t('codeAt', { kitchen: kitchenName }) : t('codeHere')}</b>
              <output>{code}</output>
              <Text>{t('codeHint')}</Text>
            </Fact>
          ) : null}
          <Text role="note">{local.sealing ? t('sealedOn') : t('noPrf')}</Text>
          <Actions>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setSheet('addPhone');
              }}
            >
              <Icon name="plus" />
              {t('addPhone')}
            </Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setAsk('signOut');
              }}
            >
              <Icon name="signout" />
              {t('signOut')}
            </Button>
            <Button
              fullWidth
              variant="quiet"
              onClick={() => {
                setAsk('delete');
              }}
            >
              {t('delAll')}
            </Button>
            <Text>{t('delNote')}</Text>
          </Actions>
        </>
      )}
      {sheet === 'explain' ? (
        <RememberMeSheet
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === 'addPhone' ? (
        <AddPhoneSheet
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === 'join' ? (
        <JoinSheet
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {ask === 'signOut' ? (
        <WarningDialog
          title={t('signOutAskTitle')}
          cancelLabel={t('cancel')}
          continueLabel={t('signOutDo')}
          onCancel={() => {
            setAsk(null);
          }}
          onContinue={() => {
            setAsk(null);
            void signOutHere();
          }}
        >
          {t('signOutAsk')}
        </WarningDialog>
      ) : null}
      {ask === 'delete' ? (
        <WarningDialog
          title={t('delAskTitle')}
          cancelLabel={t('cancel')}
          continueLabel={t('delDo')}
          onCancel={() => {
            setAsk(null);
          }}
          onContinue={confirmDelete}
        >
          {t('delAsk')}
        </WarningDialog>
      ) : null}
    </Card>
  );
}
