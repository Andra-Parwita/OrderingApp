import { memo, type ReactNode } from 'react';
import { styled } from 'styled-components';

export type NoticeTone = 'info' | 'warn' | 'error';

export type NoticeProps = Readonly<{
  tone: NoticeTone;
  /** The message; the tone is never the only signal. */
  children: ReactNode;
  /** A leading icon, tinted by the tone (card layout). */
  icon?: ReactNode;
  /** `card` is a rounded block with an icon; `strip` is a flush, full-width line with a hairline under it. */
  layout?: 'card' | 'strip';
  /** `alert` interrupts (errors); `status` is polite. */
  role?: 'alert' | 'status';
  /** One optional action, shown after the message. */
  action?: Readonly<{ label: string; onClick: () => void }>;
}>;

const Root = styled.section<{ $tone: NoticeTone; $layout: 'card' | 'strip' }>`
  display: flex;
  align-items: ${({ $layout }) => ($layout === 'card' ? 'flex-start' : 'baseline')};
  gap: ${({ theme }) => theme.spacing.md};
  ${({ theme, $layout }) =>
    $layout === 'card'
      ? `
  margin: 0 ${theme.spacing.md} ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-radius: ${theme.size.radiusSheet}px;
  font-size: ${theme.type.size.md};
  line-height: 1.4;`
      : `
  margin: 0;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  border-bottom: ${theme.border.hairline} solid ${theme.c.line};
  font-size: 0.8125rem;`}
  background: ${({ theme, $tone }) => ($tone === 'warn' ? theme.c.warnTint : theme.c.surf2)};
  color: ${({ theme }) => theme.c.text};

  svg {
    margin-top: 0.125rem;
    color: ${({ theme, $tone }) =>
      $tone === 'warn' ? theme.c.warn : $tone === 'error' ? theme.c.danger : theme.c.muted};
  }
  b {
    font-weight: 700;
  }
`;

const Message = styled.div`
  flex: 1;
  min-width: 0;
`;

const Action = styled.button`
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
`;

export const Notice = memo(function Notice({
  tone,
  children,
  icon,
  layout = 'card',
  role = tone === 'error' ? 'alert' : 'status',
  action,
}: NoticeProps) {
  return (
    <Root $tone={tone} $layout={layout} role={role}>
      {icon}
      <Message>{children}</Message>
      {action ? (
        <Action type="button" onClick={action.onClick}>
          {action.label}
        </Action>
      ) : null}
    </Root>
  );
});
