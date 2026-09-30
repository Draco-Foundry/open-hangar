-- Watchdog state (src/watchdog.js): one row per check, so an alert goes out once when
-- something breaks and once when it recovers, not every 5 minutes.
CREATE TABLE watch (
  key TEXT PRIMARY KEY, -- e.g. 'site', 'stats'
  fails INTEGER NOT NULL DEFAULT 0, -- consecutive failed checks
  down_since INTEGER, -- ms; set on the first failure
  alerted INTEGER NOT NULL DEFAULT 0, -- 1 once the "down" post went out
  detail TEXT, -- last failure, for the recovery post
  checked_at INTEGER
);
