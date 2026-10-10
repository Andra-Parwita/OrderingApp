import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { useModalFocus } from './modal';

export type WarningDialogProps = Readonly<{
  /** What is about to happen: "Delete Rendang?". */
  title: string;
  /** Who is affected: "3 people ordered Rendang." */
  children: ReactNode;
  /** The safe way out, named by its outcome ("Keep dish"). Default: Cancel. */
  cancelLabel?: string;
  /** The way ahead, named by its outcome ("Delete anyway"). Default: Continue anyway. */
  continueLabel?: string;
  onCancel: () => void;
  onContinue: () => void;
}>;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.scrim};
`;
const Box = styled.div`
  width: min(28rem, 100%);
  padding: ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;
const Title = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.warn};
  font-size: 1.125rem;
  font-weight: 700;

  span {
    color: ${({ theme }) => theme.c.text};
  }
`;
const Body = styled.div`
  color: ${({ theme }) => theme.c.text};
  font-size: 0.9375rem;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

/**
 * "Warn, never block" (D-062): says who is affected and always offers the way ahead. The safe
 * button is the filled one; the way ahead is outlined in the danger tone.
 */
export function WarningDialog({
  title,
  children,
  cancelLabel,
  continueLabel,
  onCancel,
  onContinue,
}: WarningDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onCancel);
  return (
    <Overlay>
      <Box
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <Title id={titleId}>
          <Icon name="warning" />
          <span>{title}</span>
        </Title>
        <Body>{children}</Body>
        <Actions>
          <Button variant="destructive" onClick={onContinue}>
            {continueLabel ?? t('patterns.continueAnyway')}
          </Button>
          <Button variant="primary" onClick={onCancel} data-autofocus>
            {cancelLabel ?? t('patterns.cancel')}
          </Button>
        </Actions>
      </Box>
    </Overlay>
  );
}
