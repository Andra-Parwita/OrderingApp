import type { OrderStatus } from '../../../shared/domain';
import type { StatusTone } from '../../theme/tokens';

export type StatusFilter = 'all' | 'ordered' | 'confirmed' | 'ready' | 'done' | 'cancelled';

export const STATUS_FILTERS: ReadonlyArray<StatusFilter> = [
  'all',
  'ordered',
  'confirmed',
  'ready',
  'done',
  'cancelled',
];

/** A filter from the URL; anything unknown means All. */
export function parseStatusFilter(value: string | null): StatusFilter {
  return STATUS_FILTERS.find((filter) => filter === value) ?? 'all';
}

/** Which filter tab an order falls under ("Ready" and "Done" each group two statuses). */
export function filterOf(status: OrderStatus): Exclude<StatusFilter, 'all'> {
  switch (status) {
    case 'ordered':
      return 'ordered';
    case 'confirmed':
      return 'confirmed';
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return 'ready';
    case 'collected':
    case 'delivered':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function toneOf(status: OrderStatus): StatusTone {
  switch (status) {
    case 'ordered':
      return 'ordered';
    case 'confirmed':
      return 'confirmed';
    case 'ready_for_pickup':
      return 'ready';
    case 'out_for_delivery':
      return 'outForDelivery';
    case 'collected':
    case 'delivered':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
