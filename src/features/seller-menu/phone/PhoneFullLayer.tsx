import type { ReactNode } from 'react';
import { styled } from 'styled-components';
import { LayerBar, LayerShell } from '../../../components/layer/LayerShell';
import { Icon, IconButton } from '../../../ui';

// Plan 134: a full-screen layer for the phone with its own bar (close ✕ and title), a body that
// scrolls to its last field and a footer pinned at the bottom. The dish editor and the pickup-place
// editor use it. It is a LayerShell (above everything, the page behind locked), so inside the wizard
// it must be rendered within the wizard's own layer (its `floating` slot).

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
export const LayerFoot = styled.footer`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};

  button {
    flex: 1;
    white-space: nowrap;
  }
`;

export function PhoneFullLayer({
  label,
  title,
  closeLabel,
  onClose,
  footer,
  children,
  overlay,
}: Readonly<{
  /** The dialog's accessible name. */
  label: string;
  /** Shown in the bar (the label is used when it is left out). */
  title?: string;
  closeLabel: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  /** A dialog over the layer (it must sit inside it, or the layer would cover it). */
  overlay?: ReactNode;
}>) {
  return (
    <LayerShell label={label} onClose={onClose}>
      <LayerBar>
        <IconButton label={closeLabel} onClick={onClose}>
          <Icon name="x" />
        </IconButton>
        <h2>{title ?? label}</h2>
        <span />
      </LayerBar>
      <Body>{children}</Body>
      <LayerFoot>{footer}</LayerFoot>
      {overlay}
    </LayerShell>
  );
}
