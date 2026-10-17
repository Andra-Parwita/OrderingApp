-- 0030_ip_salt.sql: a random salt per UTC day for the visitor-network keys of the rate limiters
-- ("find my order", client log, phone codes). Only today's and yesterday's rows are kept; the hourly
-- sweep deletes the rest. Add-only.
CREATE TABLE ip_salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);
