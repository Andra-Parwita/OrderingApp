import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { useDevTools } from '../../api/devTools';
import { hasSessionHint } from '../../api/device/session';
import { Button, ConfirmButton } from '../../ui';
import { devResetRequested, devSampleOrdersRequested } from './devActions';
import { SELLER_NS } from './i18n/register';
import type { StatusFilter } from './orderStatus';
import {
  selectDevSampling,
  selectOrders,
  visibleOrders,
  type ListToggles,
} from './sellerOrdersSelectors';
import { pollingStarted, pollingStopped } from './sellerOrdersSlice';

// Pieces the phone list (OrdersScreen) and the desktop table (OrdersTableScreen) both use.

/** The orders for the URL's filter and search. */
export function useVisibleOrders(filter: StatusFilter, query: string, toggles?: ListToggles) {
  const orders = useSelector(selectOrders);
  const changed = toggles?.changed === true;
  const unpaid = toggles?.unpaid === true;
  return useMemo(
    () => visibleOrders(orders, filter, query, { changed, unpaid }),
    [orders, filter, query, changed, unpaid],
  );
}

/** Polling lives in the saga; a screen only says when it is shown. */
export function useOrdersPolling(): void {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);
}

const Chip = styled.button<{ $pressed: boolean }>`
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $pressed }) => ($pressed ? theme.colour.accent : theme.colour.outline)};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $pressed }) => ($pressed ? theme.colour.accent : 'transparent')};
  color: ${({ theme, $pressed }) => ($pressed ? theme.colour.onAccent : theme.colour.text)};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;
  cursor: pointer;
`;

type FilterChipProps = Readonly<{
  id: StatusFilter;
  label: string;
  pressed: boolean;
  onSelect: (next: StatusFilter) => void;
}>;

export function FilterChip({ id, label, pressed, onSelect }: FilterChipProps) {
  const onClick = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <Chip type="button" aria-pressed={pressed} $pressed={pressed} onClick={onClick}>
      {label}
    </Chip>
  );
}

const DevBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;

/** Dev tools show only when the server runs with DEV_TOOLS and there is no real session; never to a chef or a signed-in seller. */
export function useShowDevTools(): boolean {
  return useDevTools() === true && !hasSessionHint();
}

// Dev only: sample data, and a reset of the local database to the sample kitchens.
export function DevTools() {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const busy = useSelector(selectDevSampling);
  const addSamples = useCallback(() => dispatch(devSampleOrdersRequested()), [dispatch]);
  const reset = useCallback(() => dispatch(devResetRequested()), [dispatch]);
  return (
    <DevBar>
      <Button onClick={addSamples} disabled={busy}>
        {t('orders.devSample')}
      </Button>
      <ConfirmButton
        variant="quiet"
        label={t('orders.devReset')}
        confirmLabel={t('orders.devResetConfirm')}
        onConfirm={reset}
      />
    </DevBar>
  );
}
