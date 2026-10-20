import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { MenuNoticeStatus } from '../../../shared/menuNoticeContract';
import { fetchMenuNoticeStatus, sendMenuNotice } from '../../api/menuNotices';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Icon, IconButton, Tooltip } from '../../ui';
import { MENU_NS } from './i18n/register';
import { useLang } from './menuShared';
import { NotifySheet } from './NotifySheet';
import { sentWhen } from './notifyText';

// Plan 112 (D-113): the bell on Home and in the Menu toolbar. Only the owner, and only while the menu
// is live and orders are open: anyone else (or a closed menu) sees nothing. A send is recorded with
// the menu; the number beside the bell says how many times this menu has been sent.

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Count = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  font-variant-numeric: tabular-nums;
`;

export function NotifyBell({ now }: Readonly<{ now?: Date }>) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const [status, setStatus] = useState<MenuNoticeStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchMenuNoticeStatus(currentSellerSlug());
    setStatus(result.ok ? result.data : null);
  }, []);
  useEffect(() => {
    // A call that sets state after a network round trip, started once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const send = useCallback(
    async (again: boolean) => {
      setSaving(true);
      setFailed(false);
      const result = await sendMenuNotice(again, currentSellerSlug());
      setSaving(false);
      if (result.ok) {
        setStatus(result.data);
        setOpen(false);
      } else if (result.status === 409) {
        // Closed meanwhile, or sent from another device: show what is true now.
        setOpen(false);
        await load();
      } else {
        setFailed(true);
      }
    },
    [load],
  );

  if (!status?.canSend) return null;
  const { phones, sends } = status;
  const last = sends[sends.length - 1];
  const label = t('notify.bell', { count: phones });
  const notified =
    last === undefined
      ? undefined
      : t('notify.notified', {
          count: sends.length,
          when: sentWhen(t, last.sentAt, lang, now ?? new Date()),
        });
  return (
    <>
      <Tooltip text={notified ?? label}>
        <Wrap>
          <IconButton
            label={notified ? `${label} · ${notified}` : label}
            onClick={() => {
              setFailed(false);
              setOpen(true);
            }}
          >
            <Icon name="bell" />
          </IconButton>
          {sends.length > 0 ? <Count aria-hidden="true">{sends.length}×</Count> : null}
        </Wrap>
      </Tooltip>
      {open ? (
        <NotifySheet
          status={status}
          saving={saving}
          failed={failed}
          onSend={(again) => void send(again)}
          onClose={() => {
            setOpen(false);
          }}
          {...(now ? { now } : {})}
        />
      ) : null}
    </>
  );
}
