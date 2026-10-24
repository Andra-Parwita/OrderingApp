import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Me, Membership } from '../../shared/authContract';
import { fetchMemberships, switchKitchen } from '../api/auth';
import { Icon } from '../ui';
import { useSession } from './session';

// Plan 118 (was plan 033 stage 4), tablet rail only: the kitchen name is the switcher. A person in more than one
// kitchen taps it to pick which one the seller app shows; with one kitchen it is plain text.
// The server keeps the active kitchen on the session; this device remembers the last one through
// the session provider (`rememberSignedIn`).

const Wrap = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
`;
const Plain = styled.p`
  display: flex;
  flex: 1;
  align-items: center;
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.md};
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
const Trigger = styled.button`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    background: ${({ theme }) => theme.c.surf2};
  }
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const Label = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;
const Chevron = styled.svg<{ $open: boolean }>`
  width: 1rem;
  height: 1rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'none')};
`;
const Popup = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing.xs});
  left: ${({ theme }) => theme.spacing.sm};
  right: ${({ theme }) => theme.spacing.sm};
  z-index: 5;
  padding: ${({ theme }) => theme.spacing.xs};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
`;
const Entry = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.c.surf2};
  }
  &[aria-checked='true'] {
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
`;
const Failure = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.status.cancelled.fg};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

/** Every list, setting and image is the kitchen's: a full load of the seller home is the clean reload. */
export function goToSeller() {
  window.location.assign('/seller');
}

/** After a key is accepted for another kitchen: remember the new session, then open it with a clean load. */
export function useOpenKitchen(onOpened: () => void = goToSeller) {
  const { adopt } = useSession();
  return useCallback(
    (me: Me) => {
      adopt(me);
      onOpened();
    },
    [adopt, onOpened],
  );
}

export type KitchenSwitcherProps = Readonly<{
  /** The active kitchen's name. */
  name: string;
  onSwitched?: () => void;
}>;

export function KitchenSwitcher({ name, onSwitched = goToSeller }: KitchenSwitcherProps) {
  const { t } = useTranslation();
  const { me, adopt } = useSession();
  const [memberships, setMemberships] = useState<ReadonlyArray<Membership>>([]);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const staff = me?.stage === 'full';
  const active = me?.sellerId;

  useEffect(() => {
    if (!staff) return undefined;
    let live = true;
    void fetchMemberships().then((result) => {
      if (live && result.ok) setMemberships(result.data.memberships);
    });
    return () => {
      live = false;
    };
  }, [staff, active]);

  useEffect(() => {
    if (!open) return undefined;
    wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const choose = useCallback(
    async (sellerId: string) => {
      setOpen(false);
      if (sellerId === active) {
        trigger.current?.focus();
        return;
      }
      setFailed(false);
      const result = await switchKitchen(sellerId);
      if (!result.ok) {
        setFailed(true);
        setOpen(true);
        return;
      }
      adopt(result.data.me);
      onSwitched();
    },
    [active, adopt, onSwitched],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const all = [
        ...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
      ];
      const at = all.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      all[(at + step + all.length) % all.length]?.focus();
    }
  };

  if (!staff || memberships.length < 2) {
    return (
      <Plain>
        <span>{name}</span>
      </Plain>
    );
  }
  return (
    <Wrap ref={wrap} onKeyDown={onKeyDown}>
      <Trigger
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('sellerNav.kitchenSwitch')}: ${name}`}
        onClick={() => setOpen((on) => !on)}
      >
        <Label>{name}</Label>
        <Chevron $open={open} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </Chevron>
      </Trigger>
      {open ? (
        <Popup>
          <div role="menu" aria-label={t('sellerNav.kitchenSwitch')}>
            {memberships.map((m) => (
              <Entry
                key={m.sellerId}
                type="button"
                role="menuitemradio"
                aria-checked={m.sellerId === active}
                onClick={() => void choose(m.sellerId)}
              >
                <Label>
                  {m.sellerName} ·{' '}
                  {t(
                    m.role === 'owner'
                      ? 'sellerNav.roleOwner'
                      : m.role === 'helper'
                        ? 'sellerNav.roleHelper'
                        : 'sellerNav.roleChef',
                  )}
                </Label>
                {m.sellerId === active ? <Icon name="check" /> : null}
              </Entry>
            ))}
          </div>
          {failed ? <Failure role="alert">{t('sellerNav.kitchenSwitchFailed')}</Failure> : null}
        </Popup>
      ) : null}
    </Wrap>
  );
}
