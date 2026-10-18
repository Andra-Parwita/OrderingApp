// Plan 095 (option E2): the floating pill shared by the new-version bar, the announcement and the
// maintenance notice. 6 px from the edges, 40 px tall, ShaggyBobo icon, one line of text, then a
// 40x40 cross. The slot carries the offset and reports the height (pill + 6 px above and below).
import type { ReactNode } from 'react';
import styled from 'styled-components';

export type NoticeKind = 'update' | 'announce' | 'maint' | 'tip';

const PILL_HEIGHT = '2.5rem';
const INSET = '0.375rem';

export const NoticeSlot = styled.div<{ $top: string; $z: number }>`
  position: fixed;
  top: ${({ $top }) => $top};
  left: 0;
  right: 0;
  z-index: ${({ $z }) => $z};
  box-sizing: border-box;
  padding: calc(${INSET} + env(safe-area-inset-top)) ${INSET} ${INSET};
  pointer-events: none;
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export const Pill = styled.div<{ $kind: NoticeKind }>`
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: ${PILL_HEIGHT};
  max-width: 40rem;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 1.25rem;
  background: ${({ theme, $kind }) => theme.notice[$kind].bg};
  color: ${({ theme, $kind }) => theme.notice[$kind].fg};
  box-shadow:
    inset 0 0 0 ${({ theme }) => theme.border.hairline} ${({ theme }) => theme.c.line},
    0 0.25rem 0.875rem ${({ theme }) => theme.noticeShadow};
  line-height: 1.2;
  pointer-events: auto;
`;

const Icon = styled.img`
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
`;
const Text = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** The icon and the one-line text (with the full text as a tooltip when it is cut). */
export function PillBody({ text, children }: Readonly<{ text?: string; children?: ReactNode }>) {
  return (
    <>
      <Icon src="/brand/logo-icon.webp" alt="" />
      <Text title={text}>{children ?? text}</Text>
    </>
  );
}

const focusRing = `
  &:focus-visible {
    outline: 0.1875rem solid currentColor;
    outline-offset: -0.1875rem;
  }
`;

/** The whole pill as one button (new version): icon, text and the Refresh link; 16 px before the cross. */
export const PillButton = styled.button`
  flex: 1;
  min-width: 0;
  height: ${PILL_HEIGHT};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: 1.25rem 0 0 1.25rem;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  ${focusRing}
`;

export const PillLink = styled.span`
  flex: none;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.1875rem;
`;

/** Plain (non-button) content row for the notices. */
export const PillRow = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.md};
`;

export const PillClose = styled.button<{ $kind: NoticeKind }>`
  flex: none;
  width: ${PILL_HEIGHT};
  height: ${PILL_HEIGHT};
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${({ theme, $kind }) => theme.notice[$kind].xc};
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  ${focusRing}
`;
