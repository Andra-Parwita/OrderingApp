// Plan 087 ("Remember me"): turning it on, signing in on a new phone, adding a phone, signing out
// and deleting everything. The UI (src/components/remember-me) only calls these.
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {
  CUSTOMER_ADOPT_MAX,
  CUSTOMER_TOKENS_MAX,
  type CustomerMe,
  type AdoptItem,
} from '../../../shared/customerContract';
import { passkeysSupported } from '../auth';
import { rememberAddress, savedAddress } from '../device/address';
import { setCustomerCode, storedCustomerCode } from '../device/customerCode';
import { rememberFirstName, savedFirstName } from '../device/firstName';
import { readMyOrders, replaceMyOrders } from '../device/myOrders';
import type { ApiResult } from '../http';
import * as server from './api';
import { createPasskey, signInCeremony, type CeremonyResult } from './ceremony';
import { keyFromPrf, openAddress } from './crypto';
import { keyStore } from './keyStore';
import { mergeSavedOrders } from './merge';
import { clearRememberMeLocal, rememberMeLocal, setRememberMeLocal } from './state';
import { linkMyOrders, sealSavedAddress } from './sync';

export type RememberError =
  'cancelled' | 'exists' | 'failed' | 'network' | 'other_kind' | 'bad_code' | 'locked';
export type RememberOutcome =
  | { ok: true; sealing: boolean; restored: number }
  | { ok: false; error: RememberError; triesLeft?: number };

export const rememberMeSupported = (): boolean => passkeysSupported();

function errorOf(result: Extract<ApiResult<unknown>, { ok: false }>): RememberOutcome {
  switch (result.error) {
    case 'passkey_other_kind':
      return { ok: false, error: 'other_kind' };
    case 'network':
      return { ok: false, error: 'network' };
    case 'locked_out':
      return { ok: false, error: 'locked' };
    case 'invalid_credentials':
    case 'not_found':
      return {
        ok: false,
        error: 'bad_code',
        ...(result.triesLeft !== undefined ? { triesLeft: result.triesLeft } : {}),
      };
    default:
      return { ok: false, error: 'failed' };
  }
}

function adoptList(): Array<AdoptItem> {
  const items: Array<AdoptItem> = [];
  for (const order of readMyOrders()) {
    if (!order.sellerSlug) continue;
    const code = storedCustomerCode(order.sellerSlug);
    if (code && !items.some((item) => item.slug === order.sellerSlug)) {
      items.push({ slug: order.sellerSlug, code, token: order.token });
    }
  }
  return items.slice(0, CUSTOMER_ADOPT_MAX);
}

/** After any sign-in: the key, the merged My orders, the per-kitchen codes, the name, the address. */
async function settle(me: CustomerMe, prf: Uint8Array | null): Promise<RememberOutcome> {
  let sealing = false;
  if (me.prf && prf && me.credentialId) {
    await keyStore().set(await keyFromPrf(prf));
    sealing = true;
  }
  setRememberMeLocal({ credentialId: me.credentialId, sealing, setup: false });
  if (me.firstName !== '' && savedFirstName() === '') rememberFirstName(me.firstName);

  const before = readMyOrders();
  const listed = await server.fetchCustomerOrders();
  const merged = listed.ok ? mergeSavedOrders(before, listed.data.orders) : before;
  if (listed.ok) replaceMyOrders(merged);

  const slugs = [
    ...new Set(merged.flatMap((order) => (order.sellerSlug ? [order.sellerSlug] : []))),
  ];
  for (const slug of slugs.slice(0, 10)) {
    const kitchen = await server.fetchCustomerMe(slug);
    if (kitchen.ok && kitchen.data.me.customerCode) {
      setCustomerCode(slug, kitchen.data.me.customerCode);
    }
  }

  const key = sealing ? await keyStore().get() : null;
  if (key && me.credentialId) {
    const sealed = await server.fetchSealedAddress();
    if (sealed.ok && sealed.data.sealed && savedAddress() === null) {
      const address = await openAddress(key, sealed.data.sealed, me.credentialId);
      if (address) rememberAddress(address);
    }
    await sealSavedAddress();
  }
  await linkMyOrders();
  return { ok: true, sealing, restored: merged.length - before.length };
}

function ceremonyError(result: Extract<CeremonyResult, { ok: false }>): RememberOutcome {
  return { ok: false, error: result.error };
}

/** Turn on: a new passkey (with PRF where the phone has it), then the phone's orders go with it. */
export async function turnOnRememberMe(): Promise<RememberOutcome> {
  const name = savedFirstName();
  const asked = await server.registerOptions(name);
  if (!asked.ok) return errorOf(asked);
  const made = await createPasskey(
    asked.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
  );
  if (!made.ok) return ceremonyError(made);
  const tokens = readMyOrders()
    .slice(0, CUSTOMER_TOKENS_MAX)
    .map((order) => order.token);
  const registered = await server.registerPasskey({
    response: made.response,
    firstName: name,
    prf: made.prf !== null,
    tokens,
    adopt: adoptList(),
  });
  if (!registered.ok) return errorOf(registered);
  return settle(registered.data.me, made.prf);
}

/** "I already use Remember me" / Restore: sign in with a passkey that is already on the phone. */
export async function restoreWithPasskey(): Promise<RememberOutcome> {
  const asked = await server.signInOptions();
  if (!asked.ok) return errorOf(asked);
  const got = await signInCeremony(
    asked.data.options as unknown as PublicKeyCredentialRequestOptionsJSON,
  );
  if (!got.ok) return ceremonyError(got);
  const signedIn = await server.signInPasskey(got.response);
  if (!signedIn.ok) return errorOf(signedIn);
  return settle(signedIn.data.me, got.prf);
}

/** A phone that has joined by code adds its own passkey (also the retry after a closed prompt). */
export async function addThisPhonePasskey(): Promise<RememberOutcome> {
  const asked = await server.addPasskeyOptions();
  if (!asked.ok) return errorOf(asked);
  const made = await createPasskey(
    asked.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
  );
  if (!made.ok) return ceremonyError(made);
  const added = await server.addPasskey(made.response, made.prf !== null);
  if (!added.ok) return errorOf(added);
  return settle(added.data.me, made.prf);
}

/** The new phone types the 6-digit code from a signed-in phone, then adds its own passkey. */
export async function joinWithPhoneCode(code: string): Promise<RememberOutcome> {
  const joined = await server.joinWithCode(code);
  if (!joined.ok) return errorOf(joined);
  setRememberMeLocal({ credentialId: null, sealing: false, setup: true });
  return addThisPhonePasskey();
}

/** The signed-in phone shows a 6-digit code (5 minutes). */
export const showPhoneCode = server.createPhoneCode;

/** Sign out on this phone: the phone forgets its key; our side keeps everything. */
export async function signOutHere(): Promise<void> {
  await server.signOutCustomer();
  await keyStore().clear();
  clearRememberMeLocal();
}

type SignalApi = {
  signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void>;
};

/**
 * Delete my saved data: everything on our side at once, then this phone forgets its key and tells
 * the phone the passkey is no longer valid where it can. `signalled` false = show how to remove it.
 */
export async function deleteMySavedData(): Promise<
  { ok: true; signalled: boolean } | { ok: false; error: RememberError }
> {
  const credentialId = rememberMeLocal()?.credentialId ?? null;
  const deleted = await server.deleteCustomerData();
  if (!deleted.ok && deleted.status !== 401) {
    return { ok: false, error: deleted.error === 'network' ? 'network' : 'failed' };
  }
  await keyStore().clear();
  clearRememberMeLocal();
  let signalled = false;
  const api = (typeof PublicKeyCredential === 'undefined' ? undefined : PublicKeyCredential) as
    SignalApi | undefined;
  if (credentialId && api?.signalUnknownCredential) {
    try {
      await api.signalUnknownCredential({ rpId: location.hostname, credentialId });
      signalled = true;
    } catch {
      // the phone refused: show the by-hand steps
    }
  }
  return { ok: true, signalled };
}

/**
 * Looks at the session (this also renews it) and returns the customer code for a kitchen as a seller
 * sees it ("C-7K3M"). A refused session turns Remember me off on this phone.
 */
export async function kitchenCode(slug: string | null): Promise<string | null> {
  if (!rememberMeLocal()) return null;
  const result = await server.fetchCustomerMe(slug ?? undefined);
  if (!result.ok) {
    if (result.status === 401) clearRememberMeLocal();
    return null;
  }
  const { customerCode, code } = result.data.me;
  if (slug && customerCode) setCustomerCode(slug, customerCode);
  return code ?? null;
}
