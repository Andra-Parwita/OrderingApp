import { useId, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon } from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import { MENU_NS } from './i18n/register';

// The project's modal box (as on Home): dims behind, traps Tab, closes on Esc, the X and the dim layer.

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
const Box = styled.div<{ $width: string }>`
  display: flex;
  flex-direction: column;
  width: min(${({ $width }) => $width}, 100%);
  max-height: 100%;
  overflow-y: auto;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl} 0;

  h2 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
  }
`;
const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
    color: ${({ theme }) => theme.c.text};
  }
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
`;
const Foot = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

export function Dialog({
  title,
  width,
  onClose,
  footer,
  children,
}: Readonly<{
  title: string;
  width: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  const titleId = useId();
  const onScrim = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  return (
    <Overlay onMouseDown={onScrim}>
      <Box
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        $width={width}
        onKeyDown={onKeyDown}
      >
        <Head>
          <h2 id={titleId}>{title}</h2>
          <CloseButton type="button" aria-label={t('publish.close')} onClick={onClose}>
            <Icon name="x" />
          </CloseButton>
        </Head>
        <Body>{children}</Body>
        <Foot>{footer}</Foot>
      </Box>
    </Overlay>
  );
}
