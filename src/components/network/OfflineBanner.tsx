// One calm banner for "offline", "server isn't answering" and "gave up polling" (plan 062).
// Muted, role=status, with Try again. It hides itself when a call works again.
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { parseHealth } from '../../../shared/health';
import { request } from '../../api/http';
import { requestRetry } from '../../api/netState';
import { NETWORK_NS } from './i18n/register';
import { useNetworkState } from './useNetworkState';

const Bar = styled.div`
  position: fixed;
  top: var(--update-bar-height, 0);
  left: 0;
  right: 0;
  z-index: 999;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  padding: calc(${({ theme }) => theme.spacing.xs} + env(safe-area-inset-top))
    ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;

const Button = styled.button`
  min-height: ${({ theme }) => theme.spacing.xxl};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

/** Restarts stopped polls, and asks the server once so a working connection clears the banner. */
function tryAgain() {
  requestRetry();
  void request('/api/health', parseHealth);
}

export function OfflineBanner({ onTryAgain = tryAgain }: { onTryAgain?: () => void }) {
  const { t } = useTranslation(NETWORK_NS);
  const state = useNetworkState();
  if (state === 'ok') return null;
  return (
    <Bar role="status">
      <span>{t(state)}</span>
      <Button type="button" onClick={onTryAgain}>
        {t('tryAgain')}
      </Button>
    </Bar>
  );
}
