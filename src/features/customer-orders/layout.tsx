import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { Button } from '../../ui';
import { ORDERS_NS } from './i18n/register';

// Layout pieces of this feature. Features may not import each other, so these are its own.

/** The language the UI is currently in. */
export function useLang(): Language {
  const { i18n } = useTranslation(ORDERS_NS);
  return i18n.language.startsWith('id') ? 'id' : 'en';
}

export const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  /* Leaves room for the customer tab bar when the app shell shows one. */
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
  display: flex;
  flex-direction: column;
`;

export const Block = styled.section`
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export const Strong = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

/** Text for screen readers only. */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: ${({ theme }) => theme.border.hairline};
  height: ${({ theme }) => theme.border.hairline};
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

const Message = styled.div`
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

/** Loading or error text; with `onRetry` it shows a retry button. Never a blank screen. */
export function StateMessage({
  text,
  onRetry,
  alert = false,
}: Readonly<{ text: string; onRetry?: () => void; alert?: boolean }>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <Message role={alert ? 'alert' : 'status'}>
      <span>{text}</span>
      {onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : null}
    </Message>
  );
}

const OfflineBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const OfflineLink = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

/**
 * Shown above data from the last good load when a refresh failed (spec §8): "You're offline" (or
 * the load error when the phone is online) and Try again. Never a blank page.
 */
export function OfflineNote({
  offline,
  onRetry,
}: Readonly<{ offline: boolean; onRetry: () => void }>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <OfflineBar role="status">
      <span>
        <Strong>{offline ? t('common.offline') : t('common.refreshFailed')}</Strong>{' '}
        {t('common.offlineBody')}
      </span>
      <OfflineLink type="button" onClick={onRetry}>
        {t('common.retry')}
      </OfflineLink>
    </OfflineBar>
  );
}

/** True when the failed request was for want of a network (phone offline, or no response). */
export function isOffline(code: string | undefined): boolean {
  return code === 'network' || (typeof navigator !== 'undefined' && !navigator.onLine);
}

function Fallback({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation(ORDERS_NS);
  return <StateMessage alert text={t('common.errorBody')} onRetry={onRetry} />;
}

type BoundaryProps = Readonly<{ children: ReactNode }>;
type BoundaryState = Readonly<{ failed: boolean }>;

/** One per screen: a render error shows a retry instead of a blank page. */
export class ScreenBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Customer orders screen crashed', error, info.componentStack);
  }

  private readonly retry = () => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? <Fallback onRetry={this.retry} /> : this.props.children;
  }
}
