// Plan 046: the quiet "Maintenance on ..." bar (from the announcement until the window ends) and the
// full "Updating, back in a few minutes" screen (while maintenance is on, or after a call got a 503
// `maintenance`). It asks /api/status every 30 s while the screen is up and returns by itself; the
// rest of the time it asks every 5 minutes. The admin page never gets the screen (it must switch
// maintenance off).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { keyframes } from 'styled-components';
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
import { MAINTENANCE_NS } from './i18n/register';

export const SCREEN_POLL_MS = 30_000;
export const QUIET_POLL_MS = 5 * 60 * 1000;
export const NOTICE_BAR_HEIGHT_VAR = '--notice-bar-height';

const Bar = styled.div`
  position: fixed;
  top: var(--update-bar-height, 0rem);
  left: 0;
  right: 0;
  z-index: 998;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: calc(${({ theme }) => theme.spacing.xs} + env(safe-area-inset-top))
    ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

// Bobo says it (plan 080): the icon on the left, the message in a soft speech bubble whose tail
// points at Bobo.
const boboFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.1875rem); }
`;
const Bobo = styled.img`
  flex: none;
  width: 1.625rem;
  height: 1.625rem;
  object-fit: contain;
  animation: ${boboFloat} 3.2s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
const Bubble = styled.span`
  position: relative;
  flex: 1;
  min-width: 0;
  margin-left: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.c.surf};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -0.3125rem;
    width: 0.5rem;
    height: 0.5rem;
    margin-top: -0.25rem;
    background: ${({ theme }) => theme.c.surf};
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    transform: rotate(45deg);
  }
`;

const Close = styled.button`
  min-height: ${({ theme }) => theme.spacing.xxl};
  min-width: ${({ theme }) => theme.spacing.xxl};
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  font: inherit;
  cursor: pointer;
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

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
  return (
    <Bar ref={barRoot} role="status">
      <Bobo src="/brand/logo-icon.webp" alt="" />
      <Bubble>
        {t('notice', {
          day: formatDay(from, lang),
          start: formatTime(from, lang),
          end: formatTime(until, lang),
        })}
        {note ? ` ${note}` : ''}
      </Bubble>
      <Close type="button" aria-label={t('dismiss')} onClick={() => setDismissed(true)}>
        ✕
      </Close>
    </Bar>
  );
}
