// The key a limiter keeps for a visitor's network address: HMAC-SHA256(daily salt, address). The
// salt is 32 random bytes per UTC day in D1 (`ip_salts`); only today's and yesterday's are kept,
// so a stored key cannot be turned back into an address (or matched to another day's key).
// A limiter's wrong-try counts start afresh at midnight UTC (the key changes); that is accepted.
import { hex } from '../db/crypto';
import type { Db } from '../db/d1';

const encoder = new TextEncoder();

/** The UTC day, `YYYY-MM-DD`. */
const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

/** Today's salt; the first caller of the day creates it (a concurrent insert is ignored). */
async function saltOf(db: Db, day: string): Promise<string> {
  const row = await db.first<{ salt: string }>('SELECT salt FROM ip_salts WHERE day = ?', day);
  if (row) return row.salt;
  await db
    .stmt(
      'INSERT OR IGNORE INTO ip_salts (day, salt) VALUES (?, ?)',
      day,
      hex(crypto.getRandomValues(new Uint8Array(32))),
    )
    .run();
  const made = await db.first<{ salt: string }>('SELECT salt FROM ip_salts WHERE day = ?', day);
  if (!made) throw new Error('ip salt missing');
  return made.salt;
}

/** The limiter key for `ip` today (no address: one shared key, as before). */
export async function ipKey(db: Db, now: Date, ip: string | null): Promise<string> {
  const salt = await saltOf(db, dayOf(now));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(ip ?? 'local')));
}

/** Hourly: deletes the salts older than yesterday. Returns how many went. */
export async function dropOldIpSalts(db: Db, now: Date): Promise<number> {
  const yesterday = dayOf(new Date(now.getTime() - 86_400_000));
  const rows = await db.all('DELETE FROM ip_salts WHERE day < ? RETURNING day', yesterday);
  return rows.length;
}
