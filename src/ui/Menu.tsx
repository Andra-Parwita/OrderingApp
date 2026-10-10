import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { styled } from 'styled-components';
import { Icon, type IconName } from './Icon';

export type MenuItem = Readonly<{
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}>;

export type MenuProps = Readonly<{
  /** Accessible name of the ⋯ button. */
  label: string;
  items: ReadonlyArray<MenuItem>;
  /** Plain text shown above the items (not focusable). */
  header?: ReactNode;
  /** Which way the popover opens; use "up" near the bottom of the screen. */
  side?: 'down' | 'up';
}>;

const Wrap = styled.div`
  position: relative;
  flex: none;
`;
const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    background: ${({ theme }) => theme.c.surf2};
    color: ${({ theme }) => theme.c.text};
  }
`;
const Popup = styled.div<{ $up: boolean }>`
  position: absolute;
  right: 0;
  ${({ $up }) => ($up ? 'bottom: calc(100% + 4px);' : 'top: calc(100% + 4px);')}
  z-index: 5;
  min-width: 14rem;
  max-width: 20rem;
  padding: ${({ theme }) => theme.spacing.xs};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
`;
const Note = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Item = styled.button<{ $danger: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: ${({ theme, $danger }) => ($danger ? theme.c.danger : theme.colour.text)};
  font: inherit;
  text-align: start;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${({ theme }) => theme.c.surf2};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/** A ⋯ button with a small popover of actions. Esc, a click outside or Tab closes it; arrows move. */
export function Menu({ label, items, header, side = 'down' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const all = [
        ...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
      ];
      const at = all.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      all[(at + step + all.length) % all.length]?.focus();
    }
  };

  return (
    <Wrap ref={wrap} onKeyDown={onKeyDown}>
      <Trigger
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((on) => !on)}
      >
        <Icon name="dots" />
      </Trigger>
      {open ? (
        <Popup $up={side === 'up'}>
          {header ? <Note>{header}</Note> : null}
          <div role="menu" aria-label={label}>
            {items.map((item) => (
              <Item
                key={item.label}
                type="button"
                role="menuitem"
                $danger={item.danger === true}
                disabled={item.disabled === true}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                {item.icon ? <Icon name={item.icon} /> : null}
                {item.label}
              </Item>
            ))}
          </div>
        </Popup>
      ) : null}
    </Wrap>
  );
}
