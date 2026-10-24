// Plan 121: the soft-stone pill (plan 096, tip) as a small card for the page flow. The text may wrap
// to two or three lines, so the height is a minimum; the action and the cross are 44 px targets.
import styled from 'styled-components';
import { Pill } from './NoticePill';

const Card = styled(Pill)`
  height: auto;
  min-height: 2.75rem;
  max-width: none;
  margin: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  padding-left: ${({ theme }) => theme.spacing.md};
  box-shadow: inset 0 0 0 ${({ theme }) => theme.border.hairline} ${({ theme }) => theme.c.line};
`;
const Logo = styled.img`
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  margin-right: ${({ theme }) => theme.spacing.sm};
  object-fit: contain;
`;
const Text = styled.span`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  overflow-wrap: anywhere;
`;
const focusRing = `
  &:focus-visible {
    outline: 0.1875rem solid currentColor;
    outline-offset: -0.1875rem;
  }
`;
const Action = styled.button`
  flex: none;
  min-height: 2.75rem;
  margin: 0 ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.1875rem;
  white-space: nowrap;
  cursor: pointer;
  ${focusRing}
`;
const Close = styled.button`
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${({ theme }) => theme.notice.tip.xc};
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  ${focusRing}
`;

export function NudgeCard({
  text,
  action,
  hideLabel,
  onAction,
  onHide,
  testId,
}: Readonly<{
  text: string;
  action: string;
  hideLabel: string;
  onAction: () => void;
  onHide: () => void;
  testId: string;
}>) {
  return (
    <Card $kind="tip" role="status" data-testid={testId}>
      <Logo src="/brand/logo-icon.webp" alt="" />
      <Text>{text}</Text>
      <Action type="button" onClick={onAction}>
        {action}
      </Action>
      <Close type="button" aria-label={hideLabel} onClick={onHide}>
        ✕
      </Close>
    </Card>
  );
}
