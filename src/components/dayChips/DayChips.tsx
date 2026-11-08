import { styled } from 'styled-components';

// Plan 126: the small shapes shared by the delivery-day screens: a wrapping row of day chips (the
// seller's "Also deliver on", the customer's "Delivery day"), the soft amber warning line and the
// small day tag on a seller order. Text comes from the caller (each feature owns its own words).

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export type DayKind = 'off' | 'on' | 'event' | 'eventOff';

/**
 * A pill button for one day. `off`: not a delivery day (dotted outline, muted); `on`: a delivery day (green); `event`: the
 * menu's own day, ticked (soft blue); `eventOff`: the menu's own day, unticked (dotted blue).
 * `$ring`: the default day (a ring round the chip).
 */
export const DayChip = styled.button<{ $kind?: DayKind; $ring?: boolean; $on?: boolean }>`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme, $kind }) =>
      $kind === 'eventOff' || $kind === 'off' ? theme.border.focus : theme.border.hairline}
    ${({ $kind }) => ($kind === 'eventOff' || $kind === 'off' ? 'dotted' : 'solid')}
    ${({ theme, $kind, $on }) =>
      $kind === 'event' || $kind === 'eventOff'
        ? theme.c.ready
        : $kind === 'on' || $on
          ? theme.c.fill
          : $kind === 'off'
            ? theme.c.ctrl
            : theme.c.line};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $kind, $on }) =>
    $kind === 'event'
      ? `color-mix(in srgb, ${theme.c.ready} 16%, transparent)`
      : $kind === 'on' || $on
        ? theme.c.fill
        : 'transparent'};
  color: ${({ theme, $kind, $on }) =>
    $kind === 'event' || $kind === 'eventOff'
      ? theme.c.ready
      : $kind === 'on' || $on
        ? theme.c.on
        : $kind === 'off'
          ? theme.c.muted
          : theme.c.text};
  box-shadow: ${({ theme, $ring, $kind }) =>
    $ring
      ? `inset 0 0 0 ${theme.border.focus} ${theme.c.surf}, 0 0 0 ${theme.border.hairline} ${
          $kind === 'event' || $kind === 'eventOff' ? theme.c.ready : theme.c.fill
        }`
      : 'none'};
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

/** The soft amber line (a heads-up, never a block). */
export const SoftWarn = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.8125rem;
`;

/** The small day tag next to a delivery order's "Delivery" (only for an extra day). */
export const DayTag = styled.span`
  display: inline-block;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
`;
