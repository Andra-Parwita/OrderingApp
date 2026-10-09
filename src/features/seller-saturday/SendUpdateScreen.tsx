import { HandOverScreen } from './HandOverScreen';

// Stage 9 folded the hand-over, delivery run and send-update screens into one Pickup & delivery
// screen. AppRoutes (stage 10) still names these two, so they stay as thin aliases until it routes
// `/seller/hand-over` to HandOverScreen directly; then delete this file.

/** Old `/seller/hand-over/delivery`: the Delivery view. */
export function DeliveryRunScreen() {
  return <HandOverScreen view="delivery" />;
}

/** Old `/seller/updates`: the screen where messages are now sent (per place, per order). */
export function SendUpdateScreen() {
  return <HandOverScreen view="pickup" />;
}
