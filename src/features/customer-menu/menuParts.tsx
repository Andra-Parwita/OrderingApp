import { styled } from 'styled-components';

// Shared building blocks of the customer menu screens (design: uxDesign/customer/SPEC.md §4.1).

/** The one filled button of a screen: a full-width pill, 52 px tall. */
export const MainButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/** A quiet outlined pill (never a second filled button on the same screen). */
export const OutlineButton = styled(MainButton)`
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
`;

/** A text link that is a button: at least 44 px tall. */
export const TextLink = styled.button`
  align-self: flex-start;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;

/** A round 44 px icon button (close, expand). */
export const RoundButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;
`;

/** The status card of the paused, closed and error states: a soft tint, no heavy border. */
export const StatusCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0 ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf2};
`;

export const CardHead = styled.div<{ $tone: 'warn' | 'danger' }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme, $tone }) => ($tone === 'warn' ? theme.c.warn : theme.c.danger)};

  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.lg};
    line-height: ${({ theme }) => theme.type.lineHeight.tight};
    font-weight: 700;
    color: ${({ theme }) => theme.c.text};
  }
  svg {
    margin-top: 0.125rem;
  }
`;

export const CardBody = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 2rem;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
