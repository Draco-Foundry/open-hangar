-- RSI accounts, orgs, sharing consent and long-term history.
-- Design notes: docs/WEBSITE-PLAN.md ("Data model"). Written before the app had
-- any real users, so hangar_snapshot is re-keyed instead of migrated.

-- One site login holds several RSI accounts (main + alts). Everything about a
-- hangar, org or share setting hangs off the RSI account, not the login.
-- A handle only counts as proven once verified_at is set (the user put
-- verify_code in their public RSI bio and the server saw it there).
create table "rsi_account" (
  "id" text not null primary key,
  "user_id" text not null references "user" ("id") on delete cascade,
  "handle" text not null, -- as RSI shows it
  "handle_key" text not null, -- lower(handle), for matching
  "verify_code" text,
  "verified_at" integer,
  "created_at" integer not null,
  "last_synced_at" integer,
  unique ("user_id", "handle_key")
);
-- A handle can be proven by one login only.
create unique index "rsi_account_verified_handle" on "rsi_account" ("handle_key")
  where "verified_at" is not null;
create index "rsi_account_user_idx" on "rsi_account" ("user_id");

-- Latest synced hangar per RSI account (the extension's backup JSON).
drop table "hangar_snapshot";
create table "hangar_snapshot" (
  "rsi_account_id" text not null primary key references "rsi_account" ("id") on delete cascade,
  "synced_at" integer not null,
  "size" integer not null,
  "payload" text not null
);

-- Orgs appear when a verified member syncs; nothing is imported up front.
-- "Active" = at least one membership seen recently (last_seen_at), so an org
-- nobody syncs any more simply goes quiet.
create table "org" (
  "sid" text not null primary key, -- RSI's org SID, upper case
  "name" text not null,
  "logo" text,
  "first_seen_at" integer not null,
  "last_active_at" integer not null
);

-- Only the server writes these, from the member's public RSI page, never from
-- extension data (which could be edited). Refreshed on each verified sync;
-- a membership not seen for 60 days stops counting (checked in queries).
create table "org_membership" (
  "rsi_account_id" text not null references "rsi_account" ("id") on delete cascade,
  "org_sid" text not null references "org" ("sid") on delete cascade,
  "rank" text,
  "is_main" integer not null default 0,
  "verified_at" integer not null,
  "last_seen_at" integer not null,
  primary key ("rsi_account_id", "org_sid")
);
create index "org_membership_org_idx" on "org_membership" ("org_sid", "last_seen_at");

-- Two sharing choices per RSI account. No row = off.
--   scope 'org':    off | anon (ships count as "Anonymous Pilot") | named
--   scope 'public': off | anon (anonymous community counts) | named (public profile)
-- include_values: whether values/prices show along with ships.
create table "share_setting" (
  "rsi_account_id" text not null references "rsi_account" ("id") on delete cascade,
  "scope" text not null check ("scope" in ('org', 'public')),
  "level" text not null check ("level" in ('off', 'anon', 'named')),
  "include_values" integer not null default 0,
  "updated_at" integer not null,
  primary key ("rsi_account_id", "scope")
);

-- Every consent change, append-only, so we can show when someone agreed to what.
-- Kept (with the handle) after an RSI account is removed, as the record of consent.
create table "consent_event" (
  "id" integer primary key autoincrement,
  "rsi_account_id" text not null,
  "handle" text not null,
  "scope" text not null,
  "level" text not null,
  "include_values" integer not null,
  "at" integer not null
);
create index "consent_event_account_idx" on "consent_event" ("rsi_account_id", "at");

-- History as changes, not copies: each sync diffs against the last snapshot and
-- records what was added, removed (melted/gifted) or changed (a CCU applied).
-- Same shape as the extension's local history diff (OH.diffSnapshots).
create table "pledge_event" (
  "id" integer primary key autoincrement,
  "rsi_account_id" text not null references "rsi_account" ("id") on delete cascade,
  "at" integer not null,
  "kind" text not null check ("kind" in ('added', 'removed', 'changed')),
  "pledge_id" text not null,
  "name" text not null,
  "value" real,
  "from_name" text,
  "from_value" real,
  "source" text not null default 'sync' -- 'sync' | 'import' (extension's local history)
);
create index "pledge_event_account_idx" on "pledge_event" ("rsi_account_id", "at");

-- One point per day for the value-over-time charts (the last sync of the day wins).
create table "value_point" (
  "rsi_account_id" text not null references "rsi_account" ("id") on delete cascade,
  "day" text not null, -- UTC YYYY-MM-DD
  "pledges" integer not null,
  "melt" real not null,
  primary key ("rsi_account_id", "day")
);

-- Order history backfill from RSI's billing pages (a separate, opt-in button in
-- the extension, never part of Scan). Item, date and amount only: no payment
-- method, address or card details are ever sent or stored.
create table "purchase" (
  "rsi_account_id" text not null references "rsi_account" ("id") on delete cascade,
  "order_ref" text not null, -- RSI's order number
  "line" integer not null, -- position within the order
  "at" integer not null,
  "item" text not null,
  "amount_cents" integer,
  "currency" text,
  "kind" text, -- as RSI labels it (purchase, gift, …)
  primary key ("rsi_account_id", "order_ref", "line")
);
create index "purchase_account_idx" on "purchase" ("rsi_account_id", "at");
