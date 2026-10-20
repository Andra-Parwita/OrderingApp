import { styled } from 'styled-components';

// The pieces of a Settings row and its switch, shared by the Settings tab and the new-menu row.

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 4.5rem;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const Label = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
`;
export const Name = styled.span`
  font-size: ${({ theme }) => theme.type.size.base};
`;
export const Hint = styled.span<{ $on?: boolean }>`
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ $on }) => ($on ? 700 : 400)};
  color: ${({ theme, $on }) => ($on ? theme.c.atext : theme.c.muted)};
`;

// ---- The switch ----

export const Track = styled.button`
  flex: none;
  position: relative;
  box-sizing: border-box;
  width: 3.25rem;
  height: 2.25rem;
  min-width: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf2};
  cursor: pointer;

  &[aria-checked='true'] {
    border-color: ${({ theme }) => theme.c.fill};
    background: ${({ theme }) => theme.c.fill};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
export const Knob = styled.span`
  position: absolute;
  top: 50%;
  left: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.ctrl};
  transform: translateY(-50%);

  [aria-checked='true'] > & {
    left: auto;
    right: 0.25rem;
    background: ${({ theme }) => theme.c.on};
  }
`;
