import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { Button, Icon, WarningDialog } from '../../ui';
import type { MenuSlots } from './slots';
import { MENU_NS } from './i18n/register';
import { NoticeAsk } from './NoticeAsk';
import { useLeaveGuard } from './phone/leaveGuard';
import { ShareLayer } from './phone/ShareLayer';
import { usePhone } from './phone/usePhone';
import { useMenuNotice } from './NotifyBell';
import { Dialog } from './PublishDialog';
import { ErrorText, Muted, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';
import { worries } from './worry';

// Step 4: Publish menu, then the post to share. An empty menu is a warning with a way ahead, not
// a block (D-062).

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 40rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;

  h2 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    font-size: 1.375rem;
  }
  @media (max-width: 37.4375rem) {
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadPhone}px;

    h2 {
      font-size: 1.25rem;
    }
    /* The main button is the width of the page. */
    > div > button {
      width: 100%;
    }
  }
`;

const Notice = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.tint};
`;

const Choices = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  border: 0;
`;

const Choice = styled.label<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ $on, theme }) => ($on ? theme.c.fill : theme.c.line)};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ $on, theme }) => ($on ? theme.c.tint : 'transparent')};
  cursor: pointer;

  input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
  span {
    display: flex;
    flex-direction: column;
  }
  strong {
    font-weight: 600;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;

/** Plan 133: the question after Publish; it has its own send state so it only loads when asked. */
function AskAfterPublish({
  layout,
  onClose,
}: Readonly<{ layout: 'sheet' | 'box'; onClose: () => void }>) {
  const { saving, failed, send, needsAgain } = useMenuNotice();
  return (
    <NoticeAsk
      layout={layout}
      saving={saving}
      failed={failed}
      onSend={() => void send(needsAgain).then((sent) => sent && onClose())}
      onClose={onClose}
    />
  );
}

export function PublishStep({
  data,
  lang,
  onGoToOrders,
  renderShare,
}: Readonly<{
  data: MenuData;
  lang: Language;
  onGoToOrders: () => void;
  renderShare: MenuSlots['share'];
}>) {
  const { t } = useTranslation(MENU_NS);
  const { run, busy } = useRunOp();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [askNotice, setAskNotice] = useState(false);
  // Plan 134 (phone): after the question the phone's Share menu opens; closing it goes to Orders.
  const phone = usePhone();
  const [sharing, setSharing] = useState(false);
  const name = useId();
  const { menu, dishes } = data.view;
  // Android Back from the live page goes to Orders, not back to a step of a menu that is now live.
  // While the notice question is up, Back only closes the question (it counts as "Not now").
  useLeaveGuard(phone && menu.state === 'live', () =>
    askNotice ? setAskNotice(false) : onGoToOrders(),
  );
  useOpWatch(['publish'], {
    onDone: () => {
      setFailed(false);
      setAsking(false);
      setAskNotice(true);
    },
    onFail: (result) => {
      if (result.warning?.code === 'no_dishes') setAsking(true);
      else setFailed(true);
    },
  });
  // Plan 133: the question shows over whichever page is up (the menu turns live a moment later).
  const withAsk = (page: ReactNode) => (
    <>
      {page}
      {askNotice ? (
        <AskAfterPublish
          layout={phone ? 'sheet' : 'box'}
          onClose={() => {
            setAskNotice(false);
            setSharing(true);
          }}
        />
      ) : null}
      {phone && sharing && !askNotice ? <ShareLayer onClose={onGoToOrders} /> : null}
    </>
  );
  if (menu.state === 'live') {
    return withAsk(
      <Wrap>
        <h2>
          <Icon name="check" />
          {t('publish.live')}
        </h2>
        <Muted>{t('publish.liveHelp', { date: formatCookingDate(menu.cookingDate, lang) })}</Muted>
        {menu.takingOrders ? null : <Notice role="status">{t('publish.pausedNotice')}</Notice>}
        {phone ? (
          <>
            <div>
              <Button variant="primary" onClick={() => setSharing(true)}>
                {t('publish.shareMenu')}
              </Button>
            </div>
            <div>
              <Button onClick={onGoToOrders}>{t('publish.toOrders')}</Button>
            </div>
          </>
        ) : (
          renderShare({ onGoToOrders })
        )}
      </Wrap>,
    );
  }
  const count = worries(data.view, new Date()).length;
  return withAsk(
    <Wrap>
      <h2>{t('publish.ready')}</h2>
      <Muted>
        {t('publish.summary', {
          count: dishes.length,
          date: formatCookingDate(menu.cookingDate, lang),
        })}
      </Muted>
      {count > 0 ? <Muted>{t('publish.worries', { count })}</Muted> : null}
      <div>
        <Button variant="primary" disabled={busy} onClick={() => setChoosing(true)}>
          {t('publish.button')}
        </Button>
      </div>
      <Muted>{t('publish.after')}</Muted>
      {failed ? <ErrorText role="alert">{t('genericError')}</ErrorText> : null}
      {choosing ? (
        <Dialog
          title={t('publish.modalTitle', { date: formatCookingDate(menu.cookingDate, lang) })}
          width="32.5rem"
          onClose={() => setChoosing(false)}
          footer={
            <>
              <Button variant="quiet" onClick={() => setChoosing(false)}>
                {t('publish.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setChoosing(false);
                  run({ kind: 'publish', takingOrders: !paused });
                }}
              >
                {t(paused ? 'publish.confirmPaused' : 'publish.confirmNow')}
              </Button>
            </>
          }
        >
          <Choices aria-label={t('publish.choiceLegend')}>
            {[false, true].map((isPaused) => (
              <Choice key={String(isPaused)} $on={paused === isPaused}>
                <input
                  type="radio"
                  name={name}
                  checked={paused === isPaused}
                  onChange={() => setPaused(isPaused)}
                  data-autofocus={isPaused ? undefined : true}
                />
                <span>
                  <strong>{t(isPaused ? 'publish.pausedTitle' : 'publish.nowTitle')}</strong>
                  <small>{t(isPaused ? 'publish.pausedNote' : 'publish.nowNote')}</small>
                </span>
              </Choice>
            ))}
          </Choices>
        </Dialog>
      ) : null}
      {asking ? (
        <WarningDialog
          title={t('publish.emptyTitle')}
          cancelLabel={t('publish.addDishes')}
          continueLabel={t('publish.emptyAnyway')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            run({ kind: 'publish', force: true, takingOrders: !paused });
          }}
        >
          {t('publish.emptyBody')}
        </WarningDialog>
      ) : null}
    </Wrap>,
  );
}
