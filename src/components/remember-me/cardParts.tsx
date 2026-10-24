import { styled } from 'styled-components';

// The pieces of the Settings Remember me card (plan 092): quiet links and a tidy action list.

/** A quiet text link: one line, 44 px tall, no frame. */
export const LinkButton = styled.button`
  align-self: flex-start;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
export const Links = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;
/** "Turned on Remember me before?" with its link under it. */
export const RestoreLine = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-left: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.md};
`;

export const ActionList = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${({ theme }) => theme.spacing.sm};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
/** A read-only fact in the list ("Turned on: 24 Oct 2026"): the label is muted, the value plain. */
export const FactRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: ${({ theme }) => theme.type.size.md};

  span {
    color: ${({ theme }) => theme.c.muted};
  }
  b {
    font-weight: 600;
    text-align: right;
  }
`;
/** One row of the action list; `$danger` is the muted red "Delete my saved data". */
export const ActionRow = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: none;
  color: ${({ $danger, theme }) => ($danger ? theme.c.danger : theme.c.text)};
  font: inherit;
  text-align: left;
  cursor: pointer;

  svg {
    flex: none;
    color: ${({ $danger, theme }) => ($danger ? theme.c.danger : theme.c.muted)};
  }
`;

export const CodeBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  b {
    font-size: ${({ theme }) => theme.type.size.md};
    font-weight: 600;
  }
  output {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  }
`;
/** A one-line fact with a small icon (the lock line). */
export const NoteLine = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.5;

  svg {
    flex: none;
    margin-top: 0.125rem;
    color: ${({ theme }) => theme.c.atext};
  }
`;
/** The "choose Passwords / Google Password Manager" hint: a quiet box, no saturated colour. */
export const HintBox = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.5;
`;
