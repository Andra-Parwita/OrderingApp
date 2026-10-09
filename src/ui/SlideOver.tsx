import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { styled } from 'styled-components';
import { Button } from './Button';
import { Icon } from './Icon';

export type SlideOverProps = Readonly<{
  /** Accessible name of the dialog. */
  label: string;
  closeLabel: string;
  onClose: () => void;
  /** Controls placed beside the Close button, e.g. previous / next. */
  headerStart?: ReactNode;
  /** Where focus goes when the panel closes; by default the element that had it when it opened. */
  returnFocus?: () => HTMLElement | null;
  /** Panel width as a CSS length; the default is 27.5rem. The editor pattern uses 560 px. */
  width?: string;
  /** Pinned to the bottom of the panel (Cancel and Save). */
  footer?: ReactNode;
  children: ReactNode;
}>;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10;
`;
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colour.scrim};
`;
const Panel = styled.div<{ $width: string }>`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: min(${({ $width }) => $width}, 100%);
  overflow-y: auto;
  background: ${({ theme }) => theme.colour.surface};
  border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  color: ${({ theme }) => theme.colour.text};
  font-size: ${({ theme }) => theme.type.size.base};

  &:focus {
    outline: none;
  }
`;
const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
`;
const Start = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Footer = styled.div`
  position: sticky;
  bottom: 0;
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/** A modal panel from the right edge. Escape and Close both close it. Generic: no app knowledge. */
export function SlideOver({
  label,
  closeLabel,
  onClose,
  headerStart,
  returnFocus,
  width = '27.5rem',
  footer,
  children,
}: SlideOverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const latestReturn = useRef(returnFocus);
  useEffect(() => {
    latestReturn.current = returnFocus;
  });

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => {
      const target = latestReturn.current?.() ?? opener.current;
      if (target?.isConnected) target.focus();
    };
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      // Keep Tab inside the panel while it is open.
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <Overlay>
      <Scrim onClick={onClose} />
      <Panel
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        $width={width}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <Header>
          <Start>{headerStart}</Start>
          <Button onClick={onClose}>
            <Icon name="x" />
            {closeLabel}
          </Button>
        </Header>
        {children}
        {footer ? <Footer>{footer}</Footer> : null}
      </Panel>
    </Overlay>
  );
}
