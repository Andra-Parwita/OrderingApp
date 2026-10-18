import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon, IconButton } from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import { MENU_NS } from './i18n/register';

// Plan 103 fix 8: the edit session of a live menu. On a tablet a 760 px full-height sheet over the
// dimmed screen, on a phone the whole screen. The tabs, the amber "Edit mode" band and the sticky
// Save footer belong to it; the screens of the tabs are its children.

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  background: ${({ theme }) => theme.colour.scrim};
`;
const Sheet = styled.div`
  position: fixed;
  z-index: 21;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
  @media (min-width: 48rem) {
    inset: 1rem auto 1rem 50%;
    width: min(47.5rem, calc(100% - 2rem));
    transform: translateX(-50%);
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  }
`;
const Header = styled.header`
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  h1 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }
`;
const Band = styled.div`
  flex: none;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: 0.875rem;
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

export function EditSheet({
  title,
  onClose,
  tabs,
  band,
  footer,
  children,
}: Readonly<{
  title: string;
  onClose: () => void;
  tabs: ReactNode;
  band: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  return (
    <>
      <Scrim />
      <Sheet
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={t('session.layer')}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <Header>
          <h1>{title}</h1>
          <IconButton label={t('close')} onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </Header>
        {tabs}
        <Band>{band}</Band>
        <Scroll>{children}</Scroll>
        {footer}
      </Sheet>
    </>
  );
}
