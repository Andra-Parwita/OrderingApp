import { memo, type ReactNode } from 'react';
import { styled } from 'styled-components';
import type { StatusTone } from '../theme/tokens';

export type PillProps = Readonly<{
  tone: StatusTone;
  /** Visible text; the tone is never the only signal. */
  children: ReactNode;
}>;

const Root = styled.span<{ $tone: StatusTone }>`
  display: inline-block;
  padding: ${({ theme }) => theme.border.hairline} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $tone }) => theme.status[$tone].bg};
  color: ${({ theme, $tone }) => theme.status[$tone].fg};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  white-space: nowrap;
`;

export const Pill = memo(function Pill({ tone, children }: PillProps) {
  return <Root $tone={tone}>{children}</Root>;
});
