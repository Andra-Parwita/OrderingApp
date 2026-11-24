import type { TFunction } from 'i18next';
import type { Order } from '../../../shared/domain';
import { canPack, packProgress } from '../../components/pack';

/** Plan 132: "3 of 7 packed" (also "0 of 4 packed") or "Packed" for an order row that can be packed; else empty. */
export function packedText(order: Order, t: TFunction): string {
  const { ticked, total, packed } = packProgress(order);
  if (packed) return t('pack.packed');
  return canPack(order) ? t('pack.progress', { ticked, total }) : '';
}
