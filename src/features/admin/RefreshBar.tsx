import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { Muted } from './shared';

/** Refresh may be used at most once a minute (plan 052). */
export const REFRESH_COOLDOWN_SECONDS = 60;

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

export type RefreshBarProps = Readonly<{
  /** When the data was last loaded (ms since the epoch), or null before the first load. */
  loadedAt: number | null;
  /** Reload everything. Only called when the cooldown is over. */
  onRefresh: () => void;
}>;

/** "Last updated 19:42 · 2 minutes ago" and a Refresh button, disabled for 60 s after each use. */
export function RefreshBar({ loadedAt, onRefresh }: RefreshBarProps) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [now, setNow] = useState(() => Date.now());
  const [coolUntil, setCoolUntil] = useState(0);
  const cooling = now < coolUntil;

  // Ticks each second while the button counts down, otherwise each minute for the relative time.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), cooling ? 1000 : 60_000);
    return () => clearInterval(timer);
  }, [cooling]);

  const refresh = () => {
    const at = Date.now();
    setNow(at);
    setCoolUntil(at + REFRESH_COOLDOWN_SECONDS * 1000);
    onRefresh();
  };

  let text = t('home.refresh.never');
  if (loadedAt !== null) {
    const clock = new Date(loadedAt).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const minutes = Math.max(0, Math.floor((now - loadedAt) / 60_000));
    const ago =
      minutes < 1
        ? t('home.refresh.justNow')
        : minutes < 60
          ? t('home.refresh.minutesAgo', { count: minutes })
          : t('home.refresh.hoursAgo', { count: Math.floor(minutes / 60) });
    text = t('home.refresh.updated', { time: clock, ago });
  }
  const seconds = Math.max(1, Math.ceil((coolUntil - now) / 1000));

  return (
    <Bar>
      <Muted role="status">{text}</Muted>
      <Button disabled={cooling} onClick={refresh}>
        {cooling ? t('home.refresh.wait', { seconds }) : t('home.refresh.button')}
      </Button>
    </Bar>
  );
}
