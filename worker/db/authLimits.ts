// Guess limits and rate limits (split out of auth.ts, plan 098 C3; the code is unchanged).
import { LOCKOUT_MINUTES } from '../../shared/authContract';
import type { AuthRepository, AuthResult } from '../repo/Repository';
import { marks } from './d1';
import { ipKey } from '../auth/ipKey';
import { MINUTE, ok, type AuthHelpers } from './authHelpers';

/** Guess limits and rate limits. */
export function limitsPart(
  h: AuthHelpers,
): Pick<AuthRepository, 'guessLimited' | 'ipKey' | 'rateLimit'> {
  const { db, now, iso, lockedSeconds, lockedFail, recordFailure, clearFailures } = h;
  return {
    /**
     * D-075: one guess at a lost order. `limits` maps each scope to its own number of wrong tries.
     * Refused while any scope is locked; a null answer is a wrong try (a scope locks at its limit). A hit clears only `clearOnHit`: clearing the client's own
     * scope would let a guesser with one valid order reset it between guesses. Tries older than the
     * lock time are forgotten.
     */
    async guessLimited<T>(
      limits: Record<string, number>,
      clearOnHit: Array<string>,
      attempt: () => Promise<T | null>,
    ): Promise<AuthResult<T>> {
      const scopes = Object.keys(limits);
      await db
        .stmt(
          `DELETE FROM auth_attempts WHERE scope IN (${marks(scopes.length)})
           AND locked_until IS NULL AND updated_at <= ?`,
          ...scopes,
          iso(now() - LOCKOUT_MINUTES * MINUTE),
        )
        .run();
      const locked = await lockedSeconds(scopes);
      if (locked > 0) return lockedFail(locked);
      const value = await attempt();
      if (value === null) return recordFailure(scopes, limits);
      await clearFailures(clearOnHit);
      return ok(value);
    },

    ipKey: (ip: string | null) => ipKey(db, new Date(now()), ip),

    /** Fixed window per scope: the seconds until the window ends when over `max`, else 0. */
    async rateLimit(scope: string, max: number, windowSeconds: number) {
      const windowMs = windowSeconds * 1000;
      const cutoff = iso(now() - windowMs);
      await db
        .stmt(
          `INSERT INTO auth_rate (scope, window_start, hits) VALUES (?, ?, 1)
           ON CONFLICT (scope) DO UPDATE SET
             hits = CASE WHEN window_start <= ? THEN 1 ELSE hits + 1 END,
             window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`,
          scope,
          iso(now()),
          cutoff,
          cutoff,
        )
        .run();
      const row = await db.first<{ window_start: string; hits: number }>(
        'SELECT window_start, hits FROM auth_rate WHERE scope = ?',
        scope,
      );
      if (!row || row.hits <= max) return 0;
      return Math.ceil((Date.parse(row.window_start) + windowMs - now()) / 1000);
    },
  };
}
