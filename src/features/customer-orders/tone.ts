import type { OrderStatus } from '../../../shared/domain';
import type { StatusTone } from '../../theme/tokens';

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
