import { appKitchen } from '../../api/device/lastKitchen';
import { readEnvironment } from './detect';

/** The kitchen this home-screen app belongs to (plan 068); null in a normal browser tab. */
export function ownKitchen(): string | null {
  return readEnvironment().installed ? appKitchen() : null;
}
