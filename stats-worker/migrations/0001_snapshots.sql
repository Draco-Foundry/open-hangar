CREATE TABLE snapshots (
  date TEXT PRIMARY KEY, -- UTC, YYYY-MM-DD
  firefox_daily_users INTEGER,
  firefox_weekly_downloads INTEGER,
  firefox_rating REAL,
  firefox_ratings INTEGER,
  firefox_version TEXT,
  edge_active_installs INTEGER,
  edge_rating REAL,
  edge_ratings INTEGER,
  edge_version TEXT,
  chrome_users INTEGER,
  chrome_rating REAL,
  chrome_ratings INTEGER,
  taken_at TEXT DEFAULT (datetime('now'))
);
