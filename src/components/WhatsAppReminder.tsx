import type { ReactNode } from 'react';
import { styled } from 'styled-components';

// Plan 129: the amber "send it on WhatsApp" card shared by the menu's first page and the order
// page. The kitchen has no phone number, so it can only confirm an order after the customer's message.

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.4;

  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  b {
    color: ${({ theme }) => theme.c.warn};
  }
`;
const Send = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

type Props = Readonly<{
  /** The bold lead, then the rest of the sentence. */
  lead: ReactNode;
  rest: string;
  buttonLabel: string;
  onSend: () => void;
  testId?: string;
}>;

export function WhatsAppReminder({ lead, rest, buttonLabel, onSend, testId }: Props) {
  return (
    <Card role="status" data-testid={testId ?? 'wa-reminder'}>
      <p>
        <b>{lead}</b> {rest}
      </p>
      <Send type="button" onClick={onSend}>
        {buttonLabel}
      </Send>
    </Card>
  );
}
