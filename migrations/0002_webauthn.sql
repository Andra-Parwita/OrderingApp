-- Stage 8.2: real passkeys (WebAuthn) and a request limiter on /api/auth/*.
-- devices already holds credential_id / credential_public_key / credential_counter /
-- credential_transports (0001); nothing changes there.

-- One-time WebAuthn challenges, kept for a few minutes. A challenge is single use: reading it for
-- verification deletes it, whether the check passes or not.
--   register:     session_hash is the setup session the options were made for
--   authenticate: client_device_id is the random id of the browser that asked (no IP is stored)
CREATE TABLE auth_challenges (
  challenge        TEXT PRIMARY KEY,
  purpose          TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  session_hash     TEXT,
  client_device_id TEXT,
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL
) STRICT;
CREATE INDEX auth_challenges_by_expiry ON auth_challenges (expires_at);

-- Fixed-window request counts, per scope 'rate:<clientDeviceId>'. Not the failed-try lockout
-- (auth_attempts): this one counts every sign-in request, right or wrong.
CREATE TABLE auth_rate (
  scope        TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  hits         INTEGER NOT NULL CHECK (hits >= 0)
) STRICT;
