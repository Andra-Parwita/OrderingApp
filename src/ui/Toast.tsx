import { useEffect } from 'react';
import { styled } from 'styled-components';

export type ToastProps = Readonly<{
  /** Text to announce; `null` shows nothing. The live region itself stays mounted. */
  message: string | null;
  /** When given, called after `durationMs` so the owner can clear the message. */
  onDismiss?: () => void;
  durationMs?: number;
}>;

const Region = styled.div`
  position: fixed;
  right: ${({ theme }) => theme.spacing.lg};
  bottom: ${({ theme }) => theme.spacing.lg};
  left: ${({ theme }) => theme.spacing.lg};
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  pointer-events: auto;
`;

export function Toast({ message, onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (message == null || !onDismiss) return undefined;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  return (
    <Region role="status" aria-live="polite">
      {message != null ? <Message>{message}</Message> : null}
    </Region>
  );
}
