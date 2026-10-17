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
} from '../../api/customer/rememberMe';
import { Button, Icon, WarningDialog } from '../../ui';
import { useRememberAction, useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import {
  ActionList,
  ActionRow,
  CodeBlock,
  HintBox,
  LinkButton,
  LinkHint,
  Links,
  NoteLine,
} from './cardParts';
import { Actions, ErrorLine, Text } from './parts';
import { AddPhoneSheet, JoinSheet } from './PhoneSheets';
import { RememberMeSheet } from './RememberMeSheet';
import { TurnOnSheet } from './TurnOnSheet';

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
  justify-content: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
`;
const OnTag = styled.span`
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.md};
`;
type Ask = 'signOut' | 'delete' | null;
type Sheet = 'explain' | 'turnOn' | 'addPhone' | 'join' | null;

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
        {on ? <OnTag>· {t('on')}</OnTag> : null}
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
                setSheet('turnOn');
              }}
            >
              {t('turnOn')}
            </Button>
          </Actions>
          <Links>
            <LinkButton
              type="button"
              disabled={busy}
              onClick={() => {
                void run(restoreWithPasskey);
              }}
            >
              {busy ? t('working') : t('already')}
            </LinkButton>
            <LinkHint>{t('alreadyHint')}</LinkHint>
            <LinkButton
              type="button"
              onClick={() => {
                setSheet('join');
              }}
            >
              {t('useCode')}
            </LinkButton>
            <LinkButton
              type="button"
              onClick={() => {
                setSheet('explain');
              }}
            >
              {t('learn')}
            </LinkButton>
          </Links>
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
          {code ? (
            <CodeBlock>
              <b>{kitchenName ? t('codeAt', { kitchen: kitchenName }) : t('codeHere')}</b>
              <output>{code}</output>
              <Text>{t('codeHint')}</Text>
            </CodeBlock>
          ) : null}
          <NoteLine role="note">
            <Icon name={local.sealing ? 'lock' : 'info'} />
            <span>{local.sealing ? t('locked') : t('noPrf')}</span>
          </NoteLine>
          {local.sealing ? null : <HintBox>{t('keeperHint')}</HintBox>}
          <ActionList>
            <ActionRow
              type="button"
              onClick={() => {
                setSheet('addPhone');
              }}
            >
              <span>{t('addPhone')}</span>
              <Icon name="plus" />
            </ActionRow>
            <ActionRow
              type="button"
              onClick={() => {
                setAsk('signOut');
              }}
            >
              <span>{t('signOut')}</span>
              <Icon name="signout" />
            </ActionRow>
            <ActionRow
              type="button"
              $danger
              onClick={() => {
                setAsk('delete');
              }}
            >
              <span>{t('delAll')}</span>
              <Icon name="x" />
            </ActionRow>
          </ActionList>
          <Text>{t('delNote')}</Text>
        </>
      )}
      {sheet === 'explain' ? (
        <RememberMeSheet
          onClose={() => {
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === 'turnOn' ? (
        <TurnOnSheet
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
