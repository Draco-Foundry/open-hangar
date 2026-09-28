-- Per-account preferences (Appearance). Follows the user to any device.
create table "user_pref" (
  "user_id" text not null primary key references "user" ("id") on delete cascade,
  "theme" text,
  "updated_at" integer not null
);
