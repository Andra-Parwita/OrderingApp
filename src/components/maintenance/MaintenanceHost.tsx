// Plan 046: the quiet "Maintenance on ..." bar (from the announcement until the window ends) and the
// full "Updating, back in a few minutes" screen (while maintenance is on, or after a call got a 503
// `maintenance`). It asks /api/status every 30 s while the screen is up and returns by itself; the
// rest of the time it asks every 5 minutes. The admin page never gets the screen (it must switch
// maintenance off).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { formatDay, formatTime } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { noticeVisible, type MaintenanceState } from '../../../shared/maintenance';
import { setBackupMinutes } from '../../api/backupMinutes';
import {
  isMaintenanceBlocked,
  setMaintenanceBlocked,
  watchMaintenanceBlocked,
} from '../../api/maintenanceState';
import { fetchStatus } from '../../api/status';
import { useTopBar } from '../../theme/topBars';
import { NoticeSlot, Pill, PillBody, PillClose, PillRow } from '../notice/NoticePill';
import { MAINTENANCE_NS } from './i18n/register';

export const SCREEN_POLL_MS = 30_000;
export const QUIET_POLL_MS = 5 * 60 * 1000;
export const NOTICE_BAR_HEIGHT_VAR = '--notice-bar-height';

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
  font-family: ${({ theme }) => theme.font.ui};
  text-align: center;
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Text = styled.p`
  margin: 0;
  max-width: 28rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: ${({ theme }) => theme.type.lineHeight.normal};
`;

export type MaintenanceHostProps = Readonly<{
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Where we are; the admin page (`/admin...`) never shows the screen. */
  pathname?: () => string;
}>;

function useBlocked(): boolean {
  return useSyncExternalStore(watchMaintenanceBlocked, isMaintenanceBlocked, () => false);
}

export function MaintenanceHost({
  fetchImpl,
  now = () => Date.now(),
  pathname = () => window.location.pathname,
}: MaintenanceHostProps) {
  const { t, i18n } = useTranslation(MAINTENANCE_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const blocked = useBlocked();
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  const screenUp = (state?.maintenance ?? false) || blocked;

  // Ask now and then; faster while the screen is up. A "back" answer clears the blocked flag.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const status = await fetchStatus(fetchImpl);
      if (!live) return;
      if (status) {
        setBackupMinutes(status.backupMinutes);
        setState({ maintenance: status.maintenance, notice: status.notice });
        if (!status.maintenance) setMaintenanceBlocked(false);
      }
      timer = setTimeout(
        () => void check(),
        screenUp || status?.maintenance ? SCREEN_POLL_MS : QUIET_POLL_MS,
      );
    };
    void check();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
    // `tick` restarts the loop when a call has just been refused.
  }, [fetchImpl, screenUp, tick]);
  useEffect(() => watchMaintenanceBlocked(() => setTick((n) => n + 1)), []);

  const showBar = state !== null && !dismissed && noticeVisible(state, now());
  // The page and the offline banner sit below this bar (plan 080): its height goes to CSS variables.
  const barRoot = useRef<HTMLDivElement>(null);
  const barUp = showBar && !!state?.notice && !(screenUp && !pathname().startsWith('/admin'));
  useTopBar('notice', barRoot, barUp, NOTICE_BAR_HEIGHT_VAR);

  if (screenUp && !pathname().startsWith('/admin')) {
    return (
      <Screen role="alert">
        <Title>{t('title')}</Title>
        <Text>{t('text')}</Text>
      </Screen>
    );
  }
  if (!showBar || !state?.notice) return null;
  const { from, until, noteEn, noteId } = state.notice;
  const note = lang === 'id' ? noteId : noteEn;
  const text =
    t('notice', {
      day: formatDay(from, lang),
      start: formatTime(from, lang),
      end: formatTime(until, lang),
    }) + (note ? ` ${note}` : '');
  return (
    <NoticeSlot ref={barRoot} role="status" $top="var(--update-bar-height, 0rem)" $z={998}>
      <Pill $kind="maint">
        <PillRow>
          <PillBody text={text} />
        </PillRow>
        <PillClose
          type="button"
          $kind="maint"
          aria-label={t('dismiss')}
          onClick={() => setDismissed(true)}
        >
          ✕
        </PillClose>
      </Pill>
    </NoticeSlot>
  );
}
