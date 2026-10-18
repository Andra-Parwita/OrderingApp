import type { OrdersScreenProps } from './OrdersScreen';

export type OrdersTableScreenProps = OrdersScreenProps &
  Readonly<{
    /** The order whose panel is open, to mark its row. */
    selectedCode?: string;
    /** The Changed and Not paid toggles (in the URL). */
    toggles?: Readonly<{ changed: boolean; unpaid: boolean }>;
    onToggle?: (key: 'changed' | 'unpaid') => void;
    onCloseOrder?: () => void;
    /** The New order slide-over is open (route /seller/new). */
    newOrderOpen?: boolean;
    onCloseNewOrder?: () => void;
  }>;
