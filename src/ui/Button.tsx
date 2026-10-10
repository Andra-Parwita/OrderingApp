import { css, styled, type DefaultTheme } from 'styled-components';
import type { ComponentPropsWithoutRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

export type ButtonProps = Readonly<{
  variant?: ButtonVariant;
  fullWidth?: boolean;
}> &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'style'>;

type StyleProps = Readonly<{ $variant: ButtonVariant; $fullWidth: boolean }>;

const variantStyle = ({ theme, $variant }: StyleProps & { theme: DefaultTheme }) => {
  switch ($variant) {
    case 'primary':
      return css`
        background: ${theme.colour.accent};
        color: ${theme.colour.onAccent};
        border-color: ${theme.colour.accent};
      `;
    case 'secondary':
      return css`
        background: ${theme.colour.surface};
        color: ${theme.colour.text};
        border-color: ${theme.colour.outline};
      `;
    case 'destructive':
      // The "are you sure" state of a cancel: the cancelled tone (text + tint), never the go colour.
      return css`
        background: ${theme.status.cancelled.bg};
        color: ${theme.status.cancelled.fg};
        border-color: ${theme.status.cancelled.fg};
      `;
    case 'quiet':
      return css`
        background: transparent;
        color: ${theme.colour.accent};
        border-color: transparent;
      `;
    default: {
      const unreachable: never = $variant;
      return unreachable;
    }
  }
};

const StyledButton = styled.button<StyleProps>`
  display: ${({ $fullWidth }) => ($fullWidth ? 'flex' : 'inline-flex')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
  transition: filter ${({ theme }) => theme.motion.fast} ${({ theme }) => theme.motion.easing};
  ${variantStyle}

  &:hover:not(:disabled) {
    filter: brightness(0.96);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export function Button({
  variant = 'secondary',
  fullWidth = false,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <StyledButton $variant={variant} $fullWidth={fullWidth} type={type} {...rest} />;
}
