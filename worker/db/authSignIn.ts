// Finishing setup and signing in (split out of auth.ts, plan 098 C3; the code is unchanged).
import { type PasswordSignInRequest } from '../../shared/authContract';
import type { AuthRepository, RegisterInput } from '../repo/Repository';
import { type D1Statement } from './d1';
import { fromHex, hex, pbkdf2Hex, PBKDF2_ITERATIONS, sha256Hex } from './crypto';
import {
  ok,
  fail,
  type Via,
  type AccountRow,
  type DeviceRow,
  transportsOf,
  type AuthHelpers,
} from './authHelpers';

/** Finishing setup and signing in. */
export function signInPart(
  h: AuthHelpers,
): Pick<AuthRepository, 'register' | 'signInPassword' | 'signInPasskey'> {
  const {
    db,
    now,
    newDeviceId,
    guarded,
    getAccount,
    pausedOf,
    PAUSED,
    activeKitchen,
    meOf,
    newDeviceSession,
    deviceStatement,
  } = h;
  return {
    // ---- Finishing setup, signing in ----

    /**
     * A setup session becomes a device with a full session. Passkey: the route has already
     * verified it. Password: stored as PBKDF2; not for the admin, and not on an add-device setup
     * when the account already has a password.
     */
    async register(token: string, request: RegisterInput) {
      const hash = await sha256Hex(token);
      const session = await db.first<{
        account_id: string;
        device_id: string | null;
        seller_id: string | null;
        via: Via | null;
        expires_at: string;
      }>(
        'SELECT account_id, device_id, seller_id, via, expires_at FROM sessions WHERE token_hash = ?',
        hash,
      );
      if (!session || Date.parse(session.expires_at) <= now() || session.device_id) {
        return fail('unauthorized', 'Sign in first');
      }
      const account = (await getAccount(session.account_id)) as AccountRow;
      const statements: Array<D1Statement> = [];
      if (request.kind === 'password') {
        if (account.role === 'admin') return fail('invalid_request', 'The admin uses a passkey');
        if (session.via === 'code' && account.password_hash !== null) {
          return fail('password_exists', 'This account already has a password');
        }
        const salt = crypto.getRandomValues(new Uint8Array(16));
        statements.push(
          db.stmt(
            'UPDATE accounts SET password_salt = ?, password_hash = ?, password_iterations = ? WHERE id = ?',
            hex(salt),
            await pbkdf2Hex(request.password, salt, PBKDF2_ITERATIONS),
            PBKDF2_ITERATIONS,
            account.id,
          ),
        );
      }
      const passkey = request.kind === 'passkey' ? request.passkey : undefined;
      if (passkey) {
        const taken = await db.first(
          'SELECT 1 AS hit FROM devices WHERE credential_id = ?',
          passkey.credentialId,
        );
        if (taken) return fail('passkey_exists', 'This passkey is already registered');
      }
      const deviceId = newDeviceId();
      const full = await newDeviceSession(account, session.seller_id, deviceId);
      await db.batch([
        ...statements,
        deviceStatement(account, deviceId, request.deviceName, passkey),
        db.stmt('DELETE FROM sessions WHERE token_hash = ?', hash),
        ...full.statements,
      ]);
      return ok({
        token: full.token,
        me: await meOf(
          account,
          session.seller_id,
          { id: deviceId, name: request.deviceName },
          false,
        ),
        ...(passkey ? { credentialId: passkey.credentialId } : {}),
      });
    },

    /** A person of the kitchen by password. A new device is added; the failure is the same for any cause. */
    async signInPassword(request: PasswordSignInRequest) {
      const seller = await db.first<{ id: string }>(
        'SELECT id FROM sellers WHERE slug = ?',
        request.slug,
      );
      const scopes = [`device:${request.deviceId}`, ...(seller ? [`seller:${seller.id}`] : [])];
      const result = await guarded(scopes, async () => {
        if (!seller) return null;
        const account = await db.first<AccountRow>(
          `SELECT a.* FROM accounts a JOIN memberships m ON m.account_id = a.id
           WHERE a.id = ? AND m.seller_id = ? AND a.role = 'person'`,
          request.accountId,
          seller.id,
        );
        if (!account || !account.password_hash || !account.password_salt) return null;
        const hash = await pbkdf2Hex(
          request.password,
          fromHex(account.password_salt),
          account.password_iterations ?? PBKDF2_ITERATIONS,
        );
        return hash === account.password_hash ? account : null;
      });
      if (!result.ok) return result;
      const sellerId = (seller as { id: string }).id;
      if ((await pausedOf(sellerId)) === 'full') return PAUSED;
      const deviceId = newDeviceId();
      const full = await newDeviceSession(result.value, sellerId, deviceId);
      await db.batch([
        deviceStatement(result.value, deviceId, request.deviceName, undefined),
        ...full.statements,
      ]);
      return ok({
        token: full.token,
        me: await meOf(result.value, sellerId, { id: deviceId, name: request.deviceName }, false),
      });
    },

    /** Passkey sign-in: `verify` checks the signature; the new counter is kept on success. */
    async signInPasskey(clientDeviceId, credentialId, verify, slug) {
      const result = await guarded([`device:${clientDeviceId}`], async () => {
        const row = await db.first<DeviceRow>(
          'SELECT * FROM devices WHERE credential_id = ? AND credential_public_key IS NOT NULL',
          credentialId,
        );
        if (!row?.credential_public_key) return null;
        const account = (await getAccount(row.account_id)) as AccountRow;
        const sellerId = account.role === 'admin' ? null : await activeKitchen(account.id, slug);
        if (account.role === 'person' && sellerId === null) return null;
        const counter = await verify({
          credentialId,
          publicKey: row.credential_public_key,
          counter: row.credential_counter ?? 0,
          transports: transportsOf(row.credential_transports),
        });
        if (counter === null) return null;
        await db
          .stmt('UPDATE devices SET credential_counter = ? WHERE id = ?', counter, row.id)
          .run();
        return { row, account, sellerId };
      });
      if (!result.ok) return result;
      const { row, account, sellerId } = result.value;
      if ((await pausedOf(sellerId)) === 'full') return PAUSED;
      const full = await newDeviceSession(account, sellerId, row.id);
      await db.batch(full.statements);
      return ok({
        token: full.token,
        me: await meOf(account, sellerId, row, false),
        credentialId,
      });
    },
  };
}
