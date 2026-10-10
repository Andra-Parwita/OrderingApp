import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';

export const UNDO_MS = 6000;

export type UndoToastProps = Readonly<{
  /** What just happened: "Rina confirmed". `null` shows nothing; the live region stays mounted. */
  message: string | null;
  onUndo: () => void;
  /** The button's text when it is not Undo (an Open button, say). */
  actionLabel?: string;
  /** Called after `durationMs` (the Undo window closed) so the owner can clear the message. */
  onDismiss: () => void;
  durationMs?: number;
}>;

const Region = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.spacing.lg};
  bottom: ${({ theme }) => theme.spacing.lg};
  left: ${({ theme }) => theme.spacing.lg};
  z-index: 40;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  pointer-events: auto;
`;

/**
 * A quick reversible action does not ask first; it says what happened and offers Undo for 6 s.
 * Announced to screen readers through the polite live region.
 */
export function UndoToast({
  message,
  onUndo,
  actionLabel,
  onDismiss,
  durationMs = UNDO_MS,
}: UndoToastProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (message == null) return undefined;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);
  return (
    <Region role="status" aria-live="polite">
      {message != null ? (
        <Bar>
          <span>{message}</span>
          <Button variant="quiet" onClick={onUndo}>
            {actionLabel ?? t('patterns.undo')}
          </Button>
        </Bar>
      ) : null}
    </Region>
  );
}
