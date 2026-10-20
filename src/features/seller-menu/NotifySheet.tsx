import { useTranslation } from 'react-i18next';
import { keyframes, styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import { MENU_NOTICE_FREE_SENDS, type MenuNoticeStatus } from '../../../shared/menuNoticeContract';
import { menuNoticeBody } from '../../../shared/pushText';
import { BottomSheet, Button } from '../../ui';
import { MENU_NS } from './i18n/register';
import { howMany, sentTimes, sentWhen } from './notifyText';
import { useLang } from './menuShared';

// Plan 112: the window behind the bell. It says whether this menu was notified before, how many
// phones get the notice and what they will see; the third send for the same menu asks first.

const Line = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
`;
const Preview = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
const Go = styled(Button)`
  white-space: nowrap;
`;
const Problem = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  color: ${({ theme }) => theme.c.danger};
`;
const turn = keyframes`to { transform: rotate(360deg); }`;
const Spinner = styled.span.attrs({ 'aria-hidden': true })`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 0.125rem solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${turn} 0.8s linear infinite;
  }
`;

export type NotifySheetProps = Readonly<{
  status: MenuNoticeStatus;
  saving: boolean;
  failed: boolean;
  onSend: (again: boolean) => void;
  onClose: () => void;
  /** "Now", for tests. */
  now?: Date;
}>;

export function NotifySheet({ status, saving, failed, onSend, onClose, now }: NotifySheetProps) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const clock = now ?? new Date();
  const { sends, phones, kitchenName, cookingDate } = status;
  const again = sends.length >= MENU_NOTICE_FREE_SENDS;
  const last = sends[sends.length - 1];
  const send = (
    <Go variant="primary" disabled={saving} onClick={() => onSend(again)}>
      {saving ? (
        <>
          <Spinner />
          {t('notify.sending')}
        </>
      ) : again ? (
        t('notify.sendAnyway')
      ) : (
        t('notify.send')
      )}
    </Go>
  );
  const buttons = (
    <Two>
      <Go variant="quiet" disabled={saving} onClick={onClose}>
        {again ? t('notify.dontSend') : t('notify.cancel')}
      </Go>
      {send}
    </Two>
  );
  return (
    <BottomSheet
      title={again ? t('notify.againTitle') : t('notify.title')}
      onClose={saving ? () => undefined : onClose}
    >
      {again ? (
        <Line>
          {t('notify.againBody', {
            howMany: howMany(t, sends.length),
            times: sentTimes(
              sends.map((item) => item.sentAt),
              lang,
              clock,
            ),
          })}
        </Line>
      ) : (
        <>
          <Line>
            {last
              ? t('notify.sentOnce', {
                  when: sentWhen(t, last.sentAt, lang, clock),
                  count: last.reached,
                })
              : t('notify.never')}
          </Line>
          <Line>{t('notify.getNotices', { count: phones })}</Line>
          <Preview>
            <b>{kitchenName}</b>
            <span>{menuNoticeBody('en', formatCookingDate(cookingDate, 'en'))}</span>
          </Preview>
        </>
      )}
      {buttons}
      {failed ? <Problem role="alert">{t('notify.failed')}</Problem> : null}
    </BottomSheet>
  );
}
