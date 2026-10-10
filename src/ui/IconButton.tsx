import { styled } from 'styled-components';
import type { ComponentPropsWithoutRef } from 'react';

export type IconButtonProps = Readonly<{
  /** Accessible name; required because the button shows only an icon. */
  label: string;
}> &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'style' | 'aria-label'>;

const StyledIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.lg};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colour.surface};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export function IconButton({ label, type = 'button', ...rest }: IconButtonProps) {
  return <StyledIconButton aria-label={label} type={type} {...rest} />;
}
