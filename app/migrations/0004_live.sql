-- Cached copies of public live data (status, funding, version, news), so the
-- home page answers fast and survives a source being down.
create table "live_cache" (
  "key" text not null primary key,
  "value" text not null,
  "fetched_at" integer not null
);

-- Last seen state of every ship in the public ship list, and what changed.
create table "ship_state" (
  "slug" text not null primary key,
  "name" text not null,
  "msrp" real,
  "status" text,
  "seen_at" integer not null
);
create table "ship_change" (
  "id" integer primary key autoincrement,
  "slug" text not null,
  "name" text not null,
  "kind" text not null, -- 'new' | 'price' | 'status'
  "old_value" text,
  "new_value" text,
  "at" integer not null
);
create index "ship_change_at_idx" on "ship_change" ("at");
