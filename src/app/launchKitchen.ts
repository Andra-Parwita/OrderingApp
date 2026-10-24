import type { Me } from '../../shared/authContract';
import { fetchMenu } from '../api/client';
import { fetchMe, fetchMemberships, switchKitchen } from '../api/auth';
import { sellerKitchenOfSearch } from '../components/install/manifestLinks';
import { isValidSlug } from '../../shared/seller';

// Plan 101 stages 3 and 4: a kitchen's own seller app (start page `/seller?k=<slug>`) always opens that
// kitchen. The kitchen named at launch is kept in sessionStorage (this window only), so in-app
// navigation that drops the query, the sign-in redirect and the resume check still know it. Every
// read and write is in try/catch; with no storage the app behaves as it did before the plan.

const MEMORY_KEY = 'launchKitchen';
/** The kitchen a reload was already made for: the loop guard (at most one reload per launch). */
const RELOADED_KEY = 'launchReloaded';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // no storage: nothing is remembered, so no kitchen is forced
  }
}

/** The kitchen this window was launched for, or null (the old "Seller" app, or a plain browser tab). */
export function launchMemory(): string | null {
  const value = read(MEMORY_KEY);
  return isValidSlug(value) ? value : null;
}
export const rememberLaunchKitchen = (slug: string | null): void => write(MEMORY_KEY, slug);

// The `?k=` of this page load is taken once. After that the remembered kitchen rules, so a deliberate
// switch inside the app (which moves the memory) is not undone by a `k` still in the address.
let handledK: string | null = null;
/** For tests: a new page load. */
export const forgetPageLoad = (): void => {
  handledK = null;
};

/** `?k=` of this load (remembered at once), else what an earlier load of this window remembered. */
export function launchTarget(search: string): string | null {
  const k = sellerKitchenOfSearch(search);
  if (k !== undefined && k !== handledK) {
    handledK = k;
    rememberLaunchKitchen(k);
  }
  return launchMemory() ?? k ?? null;
}

export const reloadedFor = (): string | null => read(RELOADED_KEY);
export const markReloaded = (slug: string | null): void => write(RELOADED_KEY, slug);

export type SwitchOutcome =
  | Readonly<{ kind: 'switched'; me: Me }>
  | Readonly<{ kind: 'not-member'; name: string | null }>
  | Readonly<{ kind: 'paused'; name: string }>
  | Readonly<{ kind: 'failed' }>;

/** The kitchen's public name, for the screens that name a kitchen the person is not on. */
async function publicName(slug: string): Promise<string | null> {
  const result = await fetchMenu(slug);
  return result.ok ? result.data.kitchen.name : null;
}

/** Makes the named kitchen the active one, if the person is on its team. */
export async function switchToKitchen(slug: string): Promise<SwitchOutcome> {
  try {
    const list = await fetchMemberships();
    if (!list.ok) return { kind: 'failed' };
    const membership = list.data.memberships.find((m) => m.slug === slug);
    if (!membership) return { kind: 'not-member', name: await publicName(slug) };
    const result = await switchKitchen(membership.sellerId);
    if (result.ok) return { kind: 'switched', me: result.data.me };
    return result.error === 'forbidden'
      ? { kind: 'paused', name: membership.sellerName }
      : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

/** The kitchen the server says is active now; null when it cannot be told. */
export async function activeKitchenSlug(): Promise<string | null> {
  try {
    const result = await fetchMe();
    return result.ok ? (result.data.me.slug ?? null) : null;
  } catch {
    return null;
  }
}

/** The same clean full load as the kitchen switcher: every list, setting and image is the kitchen's. */
export function reloadSeller(slug: string | null): void {
  // Carries `?k=` so the reloaded page links this kitchen's seller app manifest (plan 101).
  window.location.assign(slug ? `/seller?k=${encodeURIComponent(slug)}` : '/seller');
}
