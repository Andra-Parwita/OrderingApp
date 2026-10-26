import { useEffect, type ReactNode } from 'react';
import { styled } from 'styled-components';
import { lockPageScroll, unlockPageScroll } from '../../../ui/patterns/BottomSheet';
import { OVERLAY_Z, useModalFocus } from '../../../ui/patterns/modal';

// A full-screen layer for the phone (plan 124). Not a bottom sheet: it holds a text box, and the
// on-screen keyboard must never cover its top bar. iOS keeps the layout viewport at full height when
// the keyboard opens and Android Chrome resizes only the visual viewport, so the layer follows the
// visual viewport (top and height) and the page behind is locked.

const Layer = styled.div`
  position: fixed;
  top: var(--vv-top, 0);
  left: 0;
  z-index: ${OVERLAY_Z};
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--vv-height, 100dvh);
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;

export function LayerShell({
  label,
  onClose,
  children,
}: Readonly<{ label: string; onClose: () => void; children: ReactNode }>) {
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  useEffect(() => {
    lockPageScroll();
    return unlockPageScroll;
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const node = box.current;
    if (!viewport || !node) return undefined;
    const fit = () => {
      node.style.setProperty('--vv-top', `${viewport.offsetTop}px`);
      node.style.setProperty('--vv-height', `${viewport.height}px`);
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
    };
  }, [box]);
  return (
    <Layer
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {children}
    </Layer>
  );
}

/** The bar every layer starts with: it never scrolls. */
export const LayerBar = styled.header`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 1rem;
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** The part of a layer that scrolls (under the bar, above the footer). */
export const LayerBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
