import type { OrderStats, StatPlace, StatSystem } from '../../../shared/orderStats';
import { rememberMeLocal } from '../../api/customer/state';
import { wantsRememberMe } from '../remember-me/pendingTurnOn';
import { browserPushDeps, type PushDeps } from './pushBrowser';
import { readEnvironment, type Environment } from './detect';

// Plan 121 B: the four anonymous facts sent with an order, only to be counted in the admin app.
// Each one is found on its own inside try/catch: a fact that cannot be read is left out (unknown),
// and nothing here can stop an order.

const placeOf = (env: Environment): StatPlace =>
  env.installed ? 'app' : env.inApp ? 'inapp' : 'browser';
const systemOf = (env: Environment): StatSystem =>
  env.platform === 'ios' || env.platform === 'android' ? env.platform : 'other';

/** Notifications are on for this phone: allowed, with a push subscription already made. */
async function pushIsOn(env: Environment, deps: PushDeps): Promise<boolean> {
  if (!env.pushSupported || env.permission !== 'granted') return false;
  const registration = await deps.peekRegistration();
  return (await registration?.pushManager.getSubscription()) != null;
}

export async function readOrderStats(deps: PushDeps = browserPushDeps): Promise<OrderStats> {
  const stats: OrderStats = {};
  let env: Environment | null = null;
  try {
    env = readEnvironment();
    stats.place = placeOf(env);
  } catch {
    // unknown
  }
  try {
    if (env) stats.os = systemOf(env);
  } catch {
    // unknown
  }
  try {
    if (env) stats.push = await pushIsOn(env, deps);
  } catch {
    // unknown
  }
  try {
    stats.remember = rememberMeLocal() !== null || wantsRememberMe();
  } catch {
    // unknown
  }
  return stats;
}
