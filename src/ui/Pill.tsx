import { memo, type ReactNode } from 'react';
import { styled } from 'styled-components';
import type { StatusTone } from '../theme/tokens';

export type PillProps = Readonly<{
  tone: StatusTone;
  /** Visible text; the tone is never the only signal. */
  children: ReactNode;
  /** Body-size text (16 px) instead of the compact default. */
  large?: boolean;
  /** Let a long label break onto a second line; the default is one line. */
  wrap?: boolean;
}>;

const Root = styled.span<{ $tone: StatusTone; $large: boolean; $wrap: boolean }>`
  display: inline-block;
  padding: ${({ theme }) => theme.border.hairline} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $tone }) => theme.status[$tone].bg};
  color: ${({ theme, $tone }) => theme.status[$tone].fg};
  font-size: ${({ theme, $large }) => ($large ? theme.type.size.base : theme.type.size.sm)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  white-space: ${({ $wrap }) => ($wrap ? 'normal' : 'nowrap')};
`;

export const Pill = memo(function Pill({ tone, children, large = false, wrap = false }: PillProps) {
  return (
    <Root $tone={tone} $large={large} $wrap={wrap}>
      {children}
    </Root>
  );
});
