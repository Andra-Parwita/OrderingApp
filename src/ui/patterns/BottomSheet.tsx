import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { useModalFocus } from './modal';

export type BottomSheetProps = Readonly<{
  title: string;
  onClose: () => void;
  /** Rows of 48 px: use `SheetRow` for each. */
  children: ReactNode;
}>;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  background: ${({ theme }) => theme.colour.scrim};
`;
const Sheet = styled.div`
  width: 100%;
  max-height: 85dvh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px
    calc(${({ theme }) => theme.spacing.lg} + env(safe-area-inset-bottom));
  border-radius: ${({ theme }) => theme.size.radiusSheet}px
    ${({ theme }) => theme.size.radiusSheet}px 0 0;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;
const Handle = styled.div`
  width: 2.5rem;
  height: 0.25rem;
  margin: 0 auto ${({ theme }) => theme.spacing.sm};
  border-radius: 0.125rem;
  background: ${({ theme }) => theme.c.ctrl};
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Title = styled.h2`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
`;
/** One 48 px row of a sheet. A selected row is bold and in the accent text colour, plus a tick. */
export const SheetRow = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 3rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ $selected, theme }) => ($selected ? theme.c.atext : theme.c.text)};
  font: inherit;
  font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
  text-align: left;
  cursor: pointer;
`;

/** Phone: a sheet from the bottom with a handle and a visible Close (no swipe-only action). */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  return (
    <Overlay onClick={onClose}>
      <Sheet
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <Handle aria-hidden="true" />
        <Head>
          <Title id={titleId}>{title}</Title>
          <Button variant="quiet" onClick={onClose} data-autofocus>
            {t('patterns.close')}
          </Button>
        </Head>
        {children}
      </Sheet>
    </Overlay>
  );
}
