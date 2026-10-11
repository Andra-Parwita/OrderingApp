import type { ReactNode } from 'react';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { useModalFocus } from './modal';

export type FullLayerProps = Readonly<{
  /** Accessible name of the dialog. */
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}>;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;
const Bar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

/**
 * A full-screen layer over the screen it was opened from (plan 037): a modal dialog with its own
 * Close button. Focus moves in, stays in, and returns to the opener; Escape closes it unless a
 * dialog or panel on top of it handled the key. Generic: no app knowledge.
 */
export function FullLayer({ label, closeLabel, onClose, children }: FullLayerProps) {
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  return (
    <Layer
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <Bar>
        <Button variant="quiet" onClick={onClose}>
          <Icon name="x" />
          {closeLabel}
        </Button>
      </Bar>
      <Content>{children}</Content>
    </Layer>
  );
}
