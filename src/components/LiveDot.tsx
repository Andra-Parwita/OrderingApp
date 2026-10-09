// The "Live" dot on the seller's orders and cook screens (stage 8.4b): it follows the live socket
// (src/api/live.ts), not just the last fetch. Connected: accent. Reconnecting: muted, the socket
// is trying again. Offline: the warning colour, the screen is on its slow polling fallback or the
// last fetch failed.
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { getLiveLink, watchLiveLink, type LiveLink } from '../api/live';

const Text = styled.span<{ $state: LiveLink }>`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme, $state }) =>
    $state === 'live'
      ? theme.colour.accent
      : $state === 'reconnecting'
        ? theme.colour.textMuted
        : theme.status.cancelled.fg};
  white-space: nowrap;
`;

/** What to show: a failed fetch means offline whatever the socket says. */
export function liveState(link: LiveLink, fetchFailed: boolean): LiveLink {
  return fetchFailed ? 'offline' : link;
}

export function LiveDot({ fetchFailed }: { fetchFailed: boolean }) {
  const { t } = useTranslation();
  const link = useSyncExternalStore(watchLiveLink, getLiveLink);
  const state = liveState(link, fetchFailed);
  return (
    <Text $state={state} role="status" data-live={state}>
      ● {t(`liveLink.${state}`)}
    </Text>
  );
}
