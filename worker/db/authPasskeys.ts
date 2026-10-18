// WebAuthn challenges and stored passkeys (split out of auth.ts, plan 098 C3; the code is unchanged).
import { CHALLENGE_TTL_MINUTES } from '../../shared/authContract';
import type { AuthRepository, ChallengeBinding } from '../repo/Repository';
import { sha256Hex } from './crypto';
import { MINUTE, transportsOf, type AuthHelpers } from './authHelpers';

/** WebAuthn challenges and stored passkeys. */
export function passkeysPart(
  h: AuthHelpers,
): Pick<AuthRepository, 'saveChallenge' | 'takeChallenge' | 'passkeysOfAccount' | 'passkeyById'> {
  const { db, now, iso } = h;
  return {
    // ---- WebAuthn support ----

    async saveChallenge(challenge: string, binding: ChallengeBinding) {
      const sessionHash =
        binding.purpose === 'register' ? await sha256Hex(binding.sessionToken) : null;
      await db.batch([
        db.stmt('DELETE FROM auth_challenges WHERE expires_at <= ?', iso(now())),
        // One open registration challenge per setup session.
        ...(sessionHash
          ? [
              db.stmt(
                "DELETE FROM auth_challenges WHERE purpose = 'register' AND session_hash = ?",
                sessionHash,
              ),
            ]
          : []),
        db.stmt(
          `INSERT INTO auth_challenges (challenge, purpose, session_hash, client_device_id, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          challenge,
          binding.purpose,
          sessionHash,
          binding.purpose === 'authenticate' ? binding.clientDeviceId : null,
          iso(now()),
          iso(now() + CHALLENGE_TTL_MINUTES * MINUTE),
        ),
      ]);
    },

    async takeChallenge(challenge: string, binding: ChallengeBinding) {
      // Deleting is reading: the challenge is gone whatever the answer.
      const row = await db.first<{
        purpose: string;
        session_hash: string | null;
        client_device_id: string | null;
        expires_at: string;
      }>(
        'DELETE FROM auth_challenges WHERE challenge = ? RETURNING purpose, session_hash, client_device_id, expires_at',
        challenge,
      );
      if (!row || Date.parse(row.expires_at) <= now() || row.purpose !== binding.purpose) {
        return false;
      }
      return binding.purpose === 'register'
        ? row.session_hash === (await sha256Hex(binding.sessionToken))
        : row.client_device_id === binding.clientDeviceId;
    },

    async passkeysOfAccount(accountId: string) {
      const rows = await db.all<{ credential_id: string; credential_transports: string | null }>(
        'SELECT credential_id, credential_transports FROM devices WHERE account_id = ? AND credential_id IS NOT NULL',
        accountId,
      );
      return rows.map((row) => ({
        credentialId: row.credential_id,
        transports: transportsOf(row.credential_transports),
      }));
    },

    async passkeyById(credentialId: string) {
      const row = await db.first<{ credential_transports: string | null }>(
        'SELECT credential_transports FROM devices WHERE credential_id = ?',
        credentialId,
      );
      return row
        ? { credentialId, transports: transportsOf(row.credential_transports) }
        : undefined;
    },
  };
}
