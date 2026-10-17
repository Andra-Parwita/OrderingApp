// Plan 087: while Remember me is on, this phone keeps our side in step: new orders are linked, and a
// newly saved delivery address is sealed and stored (ciphertext only). Quiet and best-effort: a
// failure never blocks ordering. A refused session (401) turns Remember me off on this phone.
import { ADDRESS_SAVED, savedAddress } from '../device/address';
import { MY_ORDERS_CHANGED, readMyOrders } from '../device/myOrders';
import { CUSTOMER_TOKENS_MAX } from '../../../shared/customerContract';
import { linkCustomerOrders, putSealedAddress } from './api';
import { sealAddress } from './crypto';
import { keyStore } from './keyStore';
import { clearRememberMeLocal, rememberMeLocal } from './state';

let linked = '';

/** Sends the order links this phone holds (once per change). */
export async function linkMyOrders(): Promise<void> {
  if (!rememberMeLocal() || rememberMeLocal()?.setup === true) return;
  const tokens = readMyOrders()
    .slice(0, CUSTOMER_TOKENS_MAX)
    .map((entry) => entry.token);
  const signature = tokens.join(',');
  if (tokens.length === 0 || signature === linked) return;
  linked = signature;
  const result = await linkCustomerOrders(tokens);
  if (!result.ok) {
    linked = '';
    if (result.status === 401) clearRememberMeLocal();
  }
}

/**
 * Seals the saved address with this phone's key and stores it. The server refuses it when there was
 * no order in the last 30 days (no_recent_order); then the address simply stays on the phone.
 */
export async function sealSavedAddress(): Promise<void> {
  const local = rememberMeLocal();
  if (!local?.sealing || local.credentialId === null || local.setup) return;
  const address = savedAddress();
  const key = address ? await keyStore().get() : null;
  if (!address || !key) return;
  const result = await putSealedAddress(await sealAddress(key, address, local.credentialId));
  if (!result.ok && result.status === 401) clearRememberMeLocal();
}

let started = false;

/** Called once at startup (src/main.tsx). */
export function startRememberMeSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener(MY_ORDERS_CHANGED, () => void linkMyOrders());
  window.addEventListener(ADDRESS_SAVED, () => void sealSavedAddress());
}

/** Tests. */
export function resetSyncForTests(): void {
  linked = '';
}
