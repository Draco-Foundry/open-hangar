# Restoring a Database

Open Hangar has two Cloudflare D1 databases:

| Database            | What's in it                                             |
| ------------------- | -------------------------------------------------------- |
| `open-hangar`       | The website: accounts, linked extensions, synced hangars |
| `open-hangar-stats` | Daily store numbers and the watchdog's state             |

There are three ways back, from quickest to slowest. Run the commands from `app/`
(for the website's database) or `stats-worker/` (for the stats one), logged in with
`npx wrangler login`.

## 1. Undo the Last 30 Days (Time Travel)

D1 keeps every change for 30 days. Use this after a bad migration or a bad deploy.

```bash
npx wrangler d1 time-travel info open-hangar --timestamp "2026-10-01T02:00:00Z"
npx wrangler d1 time-travel restore open-hangar --timestamp "2026-10-01T02:00:00Z"
```

The first command shows the bookmark for that moment; the second rolls the whole
database back to it (it prints a bookmark you can use to undo the restore).

## 2. The Backup Taken Right Before a Deploy

Every production deploy exports both databases first. In GitHub: Actions → Deploy
website → the run → Artifacts → `db-backup-<run id>` (kept 90 days). Unzip it, then:

```bash
npx wrangler d1 execute open-hangar --remote --file open-hangar.sql
```

## 3. The Weekly Backups (One Year)

Every Sunday both databases go to the private R2 bucket `open-hangar-backups`, as
`<database>/<YYYY-MM-DD>.sql.gz`. List and download:

```bash
npx wrangler r2 object get open-hangar-backups/open-hangar/2026-10-04.sql.gz --file backup.sql.gz --remote
gunzip backup.sql.gz
```

## Loading an Export

An export recreates its tables, so load it into an **empty** database. Safest is to
load it into a fresh one, check it, then point the Worker at it:

```bash
npx wrangler d1 create open-hangar-restore
npx wrangler d1 execute open-hangar-restore --remote --file backup.sql
```

Check the data in the Cloudflare dashboard (D1 → open-hangar-restore → Console), then
put its id in `wrangler.jsonc` in place of the old one and deploy. Keep the old
database until you're sure; delete it later from the dashboard.

## After Any Restore

- Post in `#status` if players noticed:
  `node scripts/notify.mjs status --up "Everything's back to normal."`
- Anything synced between the backup and now is gone from the website, but each
  player's extension still has it; the next Sync puts it back.
