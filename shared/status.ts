import type { Fulfilment, OrderStatus } from './domain';

export const ORDER_STATUSES: ReadonlyArray<OrderStatus> = [
  'ordered',
  'confirmed',
  'ready_for_pickup',
  'out_for_delivery',
  'collected',
  'delivered',
  'cancelled',
];

function assertNever(value: never): never {
  throw new Error(`Unhandled status: ${String(value)}`);
}

export function isFinalStatus(status: OrderStatus): boolean {
  switch (status) {
    case 'collected':
    case 'delivered':
    case 'cancelled':
      return true;
    case 'ordered':
    case 'confirmed':
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return false;
    default:
      return assertNever(status);
  }
}

/** The statuses the seller may move this order to; cancel is allowed from any non-final state. */
export function nextStatuses(order: {
  status: OrderStatus;
  fulfilment: Fulfilment;
}): Array<OrderStatus> {
  switch (order.status) {
    case 'ordered':
      return ['confirmed', 'cancelled'];
    case 'confirmed':
      return [order.fulfilment === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery', 'cancelled'];
    case 'ready_for_pickup':
      return ['collected', 'cancelled'];
    case 'out_for_delivery':
      return ['delivered', 'cancelled'];
    case 'collected':
    case 'delivered':
    case 'cancelled':
      return [];
    default:
      return assertNever(order.status);
  }
}
