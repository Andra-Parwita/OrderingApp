-- 0009_client_log.sql: plan 026 stage 1 (a small error log the apps send to the server).
-- A ring of the newest 500 entries (the code trims after each insert). Nothing personal is kept
-- (D-007): no names, notes, order codes, tokens, IPs or cookies; the message is scrubbed.
CREATE TABLE client_log (
  id         INTEGER PRIMARY KEY,
  at         TEXT NOT NULL,
  app        TEXT NOT NULL,
  version    TEXT NOT NULL,
  slug       TEXT,
  path       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  code       TEXT NOT NULL,
  message    TEXT NOT NULL,
  agent      TEXT NOT NULL,
  standalone INTEGER NOT NULL CHECK (standalone IN (0, 1))
) STRICT;
