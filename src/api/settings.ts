// Seller calls the Settings panes add (plan 001, stage 10). The rest (pickup places, reading the
// preferences) are in menus.ts; the kitchen settings and pictures are in client.ts.
import type { StaffActor } from '../../shared/domain';
import {
  parsePreferencesResponse,
  type PreferencesResponse,
  type UpdatePreferencesRequest,
} from '../../shared/menusContract';
import { request } from './http';
import { invalidateCached, PREFERENCES_PREFIX } from './shortCache';
import type { ApiResult } from './http';

/** The kitchen's colour theme and/or the defaults a new menu starts from (at least one). */
export function updatePreferences(
  input: UpdatePreferencesRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PreferencesResponse>> {
  invalidateCached(PREFERENCES_PREFIX);
  return request('/api/seller/preferences', parsePreferencesResponse, {
    method: 'PUT',
    body: input,
    ...(actor ? { actor } : {}),
    ...(seller ? { seller } : {}),
  }).finally(() => invalidateCached(PREFERENCES_PREFIX));
}
