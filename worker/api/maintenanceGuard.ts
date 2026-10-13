// Plan 046: the write guard must cost nothing. The maintenance flag is kept in this isolate's memory
// for a few seconds; the isolate that switches it busts its own copy, the others pick it up within
// the TTL (acceptable: the Updating screen and the guard lag by at most that long).
import type { Repository } from '../repo/Repository';

export const MAINTENANCE_TTL_MS = 10_000;
let cached: { on: boolean; at: number } | null = null;

export async function maintenanceOn(store: Repository, now = Date.now()): Promise<boolean> {
  if (cached && now - cached.at < MAINTENANCE_TTL_MS) return cached.on;
  const on = (await store.settings.maintenance()).maintenance;
  cached = { on, at: now };
  return on;
}

/** Called after any change to the flag, and by tests. */
export function bustMaintenanceCache(): void {
  cached = null;
}
