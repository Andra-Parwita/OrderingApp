// Plan 087 ("Remember me"): the customers' optional passkey on D1. Accounts, passkeys, sessions,
// challenges, "add this phone" codes, order links, per-kitchen codes and the sealed address.
// Separate from the sellers' tables (worker/db/auth.ts) on purpose: a customer session is never
// accepted by a seller route. Session tokens and codes are stored only as SHA-256 hashes. The
// server never sees a key: the sealed address is ciphertext it cannot open, and a passkey's PRF
// output never reaches it (shared/customerContract.ts `stripPrf`).
import { MAX_FAILED_ATTEMPTS } from '../../shared/authContract';
import {
  ACCOUNT_IDLE_DAYS,
  ADDRESS_DAYS,
  CUSTOMER_ORDERS_CAP,
  CUSTOMER_SESSION_DAYS,
  JOIN_SESSION_MINUTES,
  PHONE_CODE_BREAKER_SECONDS,
  PHONE_CODE_BREAKER_WRONG,
  PHONE_CODE_LENGTH,
  PHONE_CODE_MAX_WRONG,
  PHONE_CODE_TTL_MINUTES,
  type CustomerMe,
  type SealedAddress,
} from '../../shared/customerContract';
import { shortCustomerCode } from '../../shared/customerCode';
import type {
  AuthFail,
  AuthRepository,
  AuthResult,
  CustomerGrant,
  CustomerRepository,
  StoredPasskey,
} from '../repo/Repository';
import type { D1Statement, Db } from './d1';
import { confirmedOrderStatements } from './customerOrders';
import { fromHex, hex, randomChars, randomDigits, sha256Hex } from './crypto';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** A customer keeps at most this many open sessions (one per browser); the oldest go. */
const SESSIONS_MAX = 20;
const CHALLENGE_TTL_MINUTES = 5;
const LINK_ROWS_PER_STATEMENT = 20;

const fail = (error: AuthFail['error'], message: string): AuthFail => ({
  ok: false,
  error,
  message,
});

export type CustomerDeps = { db: Db; now: () => Date; auth: AuthRepository };

type PasskeyRow = {
  credential_id: string;
  account_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  prf: number;
};

function transportsOf(json: string | null): Array<string> {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Plan 087: HMAC(code_salt, "customer-code:v1:" + seller) as 24 lowercase hex characters. */
async function derivedKitchenCode(codeSalt: string, sellerId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(fromHex(codeSalt)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`customer-code:v1:${sellerId}`),
  );
  return hex(mac).slice(0, 24);
}

/** Deletes whole accounts (and everything of theirs) matching a condition on `customer_accounts`. */
function dropAccountStatements(
  db: Db,
  condition: string,
  ...params: Array<string | number>
): Array<D1Statement> {
  const ids = `(SELECT id FROM customer_accounts WHERE ${condition})`;
  const children = [
    'customer_sealed_addresses',
    'customer_kitchen_codes',
    'customer_order_links',
    'customer_phone_codes',
    'customer_sessions',
    'customer_passkeys',
    'customer_challenges',
  ];
  // Explicit, children first: the cascade would do it too, but this does not rely on it.
  return [
    ...children.map((table) =>
      db.stmt(`DELETE FROM ${table} WHERE account_id IN ${ids}`, ...params),
    ),
    db.stmt(`DELETE FROM customer_accounts WHERE ${condition}`, ...params),
  ];
}

export function createCustomerRepository(deps: CustomerDeps): CustomerRepository {
  const { db, auth } = deps;
  const now = () => deps.now().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  async function newSession(
    accountId: string,
    credentialId: string | null,
    setup: boolean,
  ): Promise<{ grant: CustomerGrant; statements: Array<D1Statement> }> {
    const token = randomChars(40);
    const lifetime = setup ? JOIN_SESSION_MINUTES * MINUTE : CUSTOMER_SESSION_DAYS * DAY;
    return {
      grant: { token, setup },
      statements: [
        db.stmt(
          `INSERT INTO customer_sessions (token_hash, account_id, credential_id, setup, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          await sha256Hex(token),
          accountId,
          credentialId,
          setup ? 1 : 0,
          iso(now()),
          iso(now() + lifetime),
        ),
        db.stmt(
          `DELETE FROM customer_sessions WHERE account_id = ? AND token_hash NOT IN
             (SELECT token_hash FROM customer_sessions WHERE account_id = ?
              ORDER BY created_at DESC, rowid DESC LIMIT ${String(SESSIONS_MAX)})`,
          accountId,
          accountId,
        ),
        db.stmt(
          'UPDATE customer_accounts SET last_used_at = ? WHERE id = ?',
          iso(now()),
          accountId,
        ),
      ],
    };
  }

  const linkStatements = (
    accountId: string,
    links: ReadonlyArray<{ token: string; sellerId: string }>,
  ): Array<D1Statement> => {
    const out: Array<D1Statement> = [];
    for (let from = 0; from < links.length; from += LINK_ROWS_PER_STATEMENT) {
      const group = links.slice(from, from + LINK_ROWS_PER_STATEMENT);
      out.push(
        db.stmt(
          `INSERT OR IGNORE INTO customer_order_links (account_id, token, seller_id, created_at)
           VALUES ${group.map(() => '(?, ?, ?, ?)').join(', ')}`,
          ...group.flatMap((link) => [accountId, link.token, link.sellerId, iso(now())]),
        ),
      );
    }
    if (links.length > 0) {
      out.push(
        db.stmt(
          `DELETE FROM customer_order_links WHERE account_id = ? AND token NOT IN
             (SELECT token FROM customer_order_links WHERE account_id = ?
              ORDER BY created_at DESC, rowid DESC LIMIT ${String(CUSTOMER_ORDERS_CAP)})`,
          accountId,
          accountId,
        ),
      );
    }
    return out;
  };

  const passkeyStatement = (accountId: string, passkey: StoredPasskey, prf: boolean) =>
    db.stmt(
      `INSERT INTO customer_passkeys (credential_id, account_id, public_key, counter, transports, prf, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      passkey.credentialId,
      accountId,
      passkey.publicKey,
      passkey.counter,
      JSON.stringify(passkey.transports),
      prf ? 1 : 0,
      iso(now()),
      iso(now()),
    );

  async function passkeyTaken(credentialId: string): Promise<boolean> {
    return (
      (await db.first(
        'SELECT 1 AS hit FROM customer_passkeys WHERE credential_id = ?',
        credentialId,
      )) !== null
    );
  }

  return {
    newAccountId: () => `cust:${randomChars(16).toLowerCase()}`,

    async resolve(token) {
      if (!token) return undefined;
      const hash = await sha256Hex(token);
      const row = await db.first<{
        account_id: string;
        credential_id: string | null;
        setup: number;
        expires_at: string;
      }>(
        'SELECT account_id, credential_id, setup, expires_at FROM customer_sessions WHERE token_hash = ?',
        hash,
      );
      if (!row) return undefined;
      if (Date.parse(row.expires_at) <= now()) {
        await db.stmt('DELETE FROM customer_sessions WHERE token_hash = ?', hash).run();
        return undefined;
      }
      const setup = row.setup === 1;
      // A full session slides; a joining phone's short session does not.
      if (!setup) {
        await db.batch([
          db.stmt(
            'UPDATE customer_sessions SET expires_at = ? WHERE token_hash = ?',
            iso(now() + CUSTOMER_SESSION_DAYS * DAY),
            hash,
          ),
          db.stmt(
            'UPDATE customer_accounts SET last_used_at = ? WHERE id = ?',
            iso(now()),
            row.account_id,
          ),
        ]);
      }
      return { token, accountId: row.account_id, credentialId: row.credential_id, setup };
    },

    hasPasskey: passkeyTaken,

    async passkeysOfAccount(accountId) {
      const rows = await db.all<{ credential_id: string; transports: string | null }>(
        'SELECT credential_id, transports FROM customer_passkeys WHERE account_id = ?',
        accountId,
      );
      return rows.map((row) => ({
        credentialId: row.credential_id,
        transports: transportsOf(row.transports),
      }));
    },

    async passkeyById(credentialId) {
      const row = await db.first<{ transports: string | null }>(
        'SELECT transports FROM customer_passkeys WHERE credential_id = ?',
        credentialId,
      );
      return row ? { credentialId, transports: transportsOf(row.transports) } : undefined;
    },

    // ---- Challenges ----

    async saveChallenge(challenge, binding, extra = {}) {
      const sessionHash = binding.purpose === 'add' ? await sha256Hex(binding.sessionToken) : null;
      await db.batch([
        db.stmt('DELETE FROM customer_challenges WHERE expires_at <= ?', iso(now())),
        // One open "add a passkey" challenge per session.
        ...(sessionHash
          ? [
              db.stmt(
                "DELETE FROM customer_challenges WHERE purpose = 'add' AND session_hash = ?",
                sessionHash,
              ),
            ]
          : []),
        db.stmt(
          `INSERT INTO customer_challenges (challenge, purpose, session_hash, client_device_id, account_id, first_name, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          challenge,
          binding.purpose,
          sessionHash,
          binding.purpose === 'add' ? null : binding.clientDeviceId,
          extra.accountId ?? null,
          extra.firstName ?? null,
          iso(now()),
          iso(now() + CHALLENGE_TTL_MINUTES * MINUTE),
        ),
      ]);
    },

    async takeChallenge(challenge, binding) {
      // Deleting is reading: the challenge is gone whatever the answer.
      const row = await db.first<{
        purpose: string;
        session_hash: string | null;
        client_device_id: string | null;
        account_id: string | null;
        first_name: string | null;
        expires_at: string;
      }>(
        `DELETE FROM customer_challenges WHERE challenge = ?
         RETURNING purpose, session_hash, client_device_id, account_id, first_name, expires_at`,
        challenge,
      );
      if (!row || Date.parse(row.expires_at) <= now() || row.purpose !== binding.purpose) {
        return null;
      }
      const matches =
        binding.purpose === 'add'
          ? row.session_hash === (await sha256Hex(binding.sessionToken))
          : row.client_device_id === binding.clientDeviceId;
      return matches ? { accountId: row.account_id, firstName: row.first_name ?? '' } : null;
    },

    // ---- Accounts and sign-in ----

    async register(input) {
      if (await passkeyTaken(input.passkey.credentialId)) {
        return fail('passkey_exists', 'This passkey is already registered');
      }
      const session = await newSession(input.accountId, input.passkey.credentialId, false);
      try {
        await db.batch([
          db.stmt(
            `INSERT INTO customer_accounts (id, first_name, code_salt, created_at, last_used_at)
             VALUES (?, ?, ?, ?, ?)`,
            input.accountId,
            input.firstName,
            hex(crypto.getRandomValues(new Uint8Array(32))),
            iso(now()),
            iso(now()),
          ),
          passkeyStatement(input.accountId, input.passkey, input.prf),
          ...session.statements,
          ...linkStatements(input.accountId, input.links),
          // Adopt a plan 071 code only with proof: an order with this token, kitchen and code exists.
          ...input.adopt.map((item) =>
            db.stmt(
              `INSERT OR IGNORE INTO customer_kitchen_codes (account_id, seller_id, code)
               SELECT ?, ?, ? WHERE EXISTS
                 (SELECT 1 FROM orders WHERE token = ? AND seller_id = ? AND customer_code = ?)`,
              input.accountId,
              item.sellerId,
              item.code,
              item.token,
              item.sellerId,
              item.code,
            ),
          ),
        ]);
      } catch {
        return fail('invalid_request', 'Could not turn on Remember me');
      }
      return { ok: true, value: session.grant };
    },

    async signInPasskey(clientDeviceId, credentialId, verify) {
      const scope = `cdev:${clientDeviceId}`;
      const result = await auth.guessLimited(
        { [scope]: MAX_FAILED_ATTEMPTS },
        [scope],
        async () => {
          const row = await db.first<PasskeyRow>(
            'SELECT * FROM customer_passkeys WHERE credential_id = ?',
            credentialId,
          );
          if (!row) return null;
          const counter = await verify({
            credentialId,
            publicKey: row.public_key,
            counter: row.counter,
            transports: transportsOf(row.transports),
          });
          if (counter === null) return null;
          await db
            .stmt(
              'UPDATE customer_passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?',
              counter,
              iso(now()),
              credentialId,
            )
            .run();
          return row;
        },
      );
      if (!result.ok) return result;
      const session = await newSession(result.value.account_id, credentialId, false);
      await db.batch(session.statements);
      return { ok: true, value: session.grant };
    },

    async addPasskey(caller, passkey, prf) {
      if (await passkeyTaken(passkey.credentialId)) {
        return fail('passkey_exists', 'This passkey is already registered');
      }
      await db.batch([
        passkeyStatement(caller.accountId, passkey, prf),
        // The session becomes a full one on the new passkey.
        db.stmt(
          'UPDATE customer_sessions SET credential_id = ?, setup = 0, expires_at = ? WHERE token_hash = ?',
          passkey.credentialId,
          iso(now() + CUSTOMER_SESSION_DAYS * DAY),
          await sha256Hex(caller.token),
        ),
        db.stmt(
          'UPDATE customer_accounts SET last_used_at = ? WHERE id = ?',
          iso(now()),
          caller.accountId,
        ),
      ]);
      return { ok: true, value: { token: caller.token, setup: false } };
    },

    async me(caller, sellerId) {
      const account = await db.first<{ first_name: string; code_salt: string }>(
        'SELECT first_name, code_salt FROM customer_accounts WHERE id = ?',
        caller.accountId,
      );
      const key = caller.credentialId;
      const [passkey, sealed] = key
        ? await Promise.all([
            db.first<{ prf: number }>(
              'SELECT prf FROM customer_passkeys WHERE credential_id = ?',
              key,
            ),
            db.first<SealedAddress>(
              'SELECT v, iv, ct FROM customer_sealed_addresses WHERE credential_id = ?',
              key,
            ),
          ])
        : [null, null];
      const me: CustomerMe = {
        firstName: account?.first_name ?? '',
        credentialId: key,
        prf: passkey?.prf === 1,
        setup: caller.setup,
        sealed: sealed ? { v: sealed.v, iv: sealed.iv, ct: sealed.ct } : null,
      };
      if (sellerId && account) {
        const adopted = await db.first<{ code: string }>(
          'SELECT code FROM customer_kitchen_codes WHERE account_id = ? AND seller_id = ?',
          caller.accountId,
          sellerId,
        );
        const customerCode =
          adopted?.code ?? (await derivedKitchenCode(account.code_salt, sellerId));
        const short = shortCustomerCode(customerCode);
        return { ...me, customerCode, ...(short ? { code: short } : {}) };
      }
      return me;
    },

    async confirmOrder(caller, order) {
      if (caller.setup) return undefined;
      const { customerCode } = await this.me(caller, order.sellerId);
      if (!customerCode) return undefined;
      await db.batch(
        confirmedOrderStatements(db, caller.accountId, order, customerCode, iso(now())),
      );
      return { ...order, customerCode, confirmed: true };
    },

    async setFirstName(caller, firstName) {
      await db
        .stmt(
          'UPDATE customer_accounts SET first_name = ? WHERE id = ?',
          firstName,
          caller.accountId,
        )
        .run();
    },

    async deleteAccount(accountId) {
      await db.batch(dropAccountStatements(db, 'id = ?', accountId));
    },

    async signOut(token) {
      await db
        .stmt('DELETE FROM customer_sessions WHERE token_hash = ?', await sha256Hex(token))
        .run();
    },

    // ---- Orders ----

    async orders(caller) {
      return db.all<{ token: string; slug: string }>(
        `SELECT l.token AS token, s.slug AS slug FROM customer_order_links l
         JOIN sellers s ON s.id = l.seller_id WHERE l.account_id = ?
         ORDER BY l.created_at DESC, l.rowid DESC`,
        caller.accountId,
      );
    },

    async linkOrders(caller, links) {
      await db.batch(linkStatements(caller.accountId, links));
    },

    // ---- Sealed address ----

    async sealedAddress(caller) {
      if (!caller.credentialId) return null;
      const row = await db.first<SealedAddress>(
        'SELECT v, iv, ct FROM customer_sealed_addresses WHERE credential_id = ?',
        caller.credentialId,
      );
      return row ? { v: row.v, iv: row.iv, ct: row.ct } : null;
    },

    async putSealedAddress(caller, sealed) {
      if (!caller.credentialId) return false;
      const account = await db.first<{ created_at: string; last_order_at: string | null }>(
        'SELECT created_at, last_order_at FROM customer_accounts WHERE id = ?',
        caller.accountId,
      );
      if (!account) return false;
      // The address is kept 30 days after the last confirmed order (a new account: from creation).
      const since = Date.parse(account.last_order_at ?? account.created_at);
      if (since + ADDRESS_DAYS * DAY <= now()) return false;
      await db
        .stmt(
          `INSERT INTO customer_sealed_addresses (credential_id, account_id, v, iv, ct, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (credential_id) DO UPDATE SET v = excluded.v, iv = excluded.iv,
             ct = excluded.ct, updated_at = excluded.updated_at`,
          caller.credentialId,
          caller.accountId,
          sealed.v,
          sealed.iv,
          sealed.ct,
          iso(now()),
        )
        .run();
      return true;
    },

    async deleteSealedAddress(caller) {
      if (!caller.credentialId) return;
      await db
        .stmt(
          'DELETE FROM customer_sealed_addresses WHERE credential_id = ? AND account_id = ?',
          caller.credentialId,
          caller.accountId,
        )
        .run();
    },

    // ---- Add this phone (6 digits) ----

    async createPhoneCode(caller) {
      const live = async (hash: string) =>
        (await db.first(
          'SELECT 1 AS hit FROM customer_phone_codes WHERE code_hash = ? AND used = 0 AND expires_at > ?',
          hash,
          iso(now()),
        )) !== null;
      let code = randomDigits(PHONE_CODE_LENGTH);
      let hash = await sha256Hex(code);
      while (await live(hash)) {
        code = randomDigits(PHONE_CODE_LENGTH);
        hash = await sha256Hex(code);
      }
      const expiresAt = now() + PHONE_CODE_TTL_MINUTES * MINUTE;
      await db.batch([
        // One live code per customer: a new one replaces the old.
        db.stmt('DELETE FROM customer_phone_codes WHERE account_id = ?', caller.accountId),
        db.stmt(
          `INSERT INTO customer_phone_codes (code_hash, account_id, created_at, expires_at, used)
           VALUES (?, ?, ?, ?, 0)`,
          hash,
          caller.accountId,
          iso(now()),
          iso(expiresAt),
        ),
      ]);
      return { code, expiresAt: iso(expiresAt) };
    },

    async joinWithCode(clientDeviceId, ipHash, code) {
      // 6 digits are guessable, so: 5 wrong per phone and per network, then 15 minutes; and more
      // than 50 wrong anywhere in 5 minutes cancels every live code. A hit clears nothing, so a
      // guesser with an account of their own cannot reset the count between guesses.
      const limits: Record<string, number> = {
        [`ccode:dev:${clientDeviceId}`]: PHONE_CODE_MAX_WRONG,
        ...(ipHash ? { [`ccode:ip:${ipHash}`]: PHONE_CODE_MAX_WRONG } : {}),
      };
      let wrong = false;
      const result: AuthResult<string> = await auth.guessLimited(limits, [], async () => {
        const record = await db.first<{ id: number; account_id: string }>(
          'SELECT id, account_id FROM customer_phone_codes WHERE code_hash = ? AND used = 0 AND expires_at > ? LIMIT 1',
          await sha256Hex(code),
          iso(now()),
        );
        // Single use under a race: only the redemption that flips `used` goes ahead.
        const taken = record
          ? await db.first(
              'UPDATE customer_phone_codes SET used = 1 WHERE id = ? AND used = 0 AND expires_at > ? RETURNING id',
              record.id,
              iso(now()),
            )
          : null;
        if (!record || !taken) {
          wrong = true;
          return null;
        }
        return record.account_id;
      });
      if (wrong) {
        const overBreaker = await auth.rateLimit(
          'ccode:wrong',
          PHONE_CODE_BREAKER_WRONG,
          PHONE_CODE_BREAKER_SECONDS,
        );
        if (overBreaker > 0) {
          await db.stmt('UPDATE customer_phone_codes SET used = 1 WHERE used = 0').run();
        }
      }
      if (!result.ok) return result;
      const session = await newSession(result.value, null, true);
      await db.batch(session.statements);
      return { ok: true, value: session.grant };
    },
  };
}

// ---- Retention (called by the Worker's cron, worker/api/scheduled.ts) ----

/**
 * Hourly: sealed addresses with no confirmed order (or creation) in the last 30 days, and expired
 * sessions, challenges and "add this phone" codes. Counts only; nothing identifying is logged.
 */
export async function sweepCustomerHourly(db: Db, now: Date): Promise<{ addresses: number }> {
  const at = now.toISOString();
  const cutoff = new Date(now.getTime() - ADDRESS_DAYS * DAY).toISOString();
  const addresses = await db.all(
    `DELETE FROM customer_sealed_addresses WHERE account_id IN
       (SELECT id FROM customer_accounts WHERE COALESCE(last_order_at, created_at) <= ?)
     RETURNING credential_id`,
    cutoff,
  );
  await db.batch([
    db.stmt('DELETE FROM customer_sessions WHERE expires_at <= ?', at),
    db.stmt('DELETE FROM customer_challenges WHERE expires_at <= ?', at),
    db.stmt('DELETE FROM customer_phone_codes WHERE expires_at <= ?', at),
  ]);
  return { addresses: addresses.length };
}

/**
 * Weekly: accounts unused for 12 months go with everything of theirs, and order links whose order
 * details are gone are dropped.
 */
export async function sweepCustomerWeekly(
  db: Db,
  now: Date,
): Promise<{ accounts: number; links: number }> {
  const cutoff = new Date(now.getTime() - ACCOUNT_IDLE_DAYS * DAY).toISOString();
  const idle = await db.all<{ id: string }>(
    'SELECT id FROM customer_accounts WHERE last_used_at <= ?',
    cutoff,
  );
  if (idle.length > 0) {
    await db.batch(dropAccountStatements(db, 'last_used_at <= ?', cutoff));
  }
  const links = await db.all(
    'DELETE FROM customer_order_links WHERE token NOT IN (SELECT token FROM orders) RETURNING token',
  );
  return { accounts: idle.length, links: links.length };
}
