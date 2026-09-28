# app.openhangar.space

The Open Hangar website: accounts (email or username + password, optional Discord,
two-factor), opt-in sync from the extension, and your hangar on any device. Plan:
[docs/WEBSITE-PLAN.md](../docs/WEBSITE-PLAN.md).

Astro (server output) on Cloudflare Workers, with D1 for data and Better Auth for
sign-in.

## Run it locally

```bash
cd app
npm install
echo "BETTER_AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")" > .dev.vars
npm run db:migrate:local
npm run dev
```

Then open http://localhost:4321.

## Useful scripts

| Script                      | What it does                                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`               | Local site with a local D1 database                                     |
| `npm run check`             | Type-check                                                              |
| `npm run db:generate`       | Regenerate the auth tables SQL after changing `src/lib/auth-options.ts` |
| `npm run db:migrate:local`  | Apply `migrations/` to the local database                               |
| `npm run db:migrate:remote` | Apply them to the real database (after it exists)                       |
| `npm run deploy`            | Build and deploy to Cloudflare                                          |

## Extension API

All calls send `content-type: application/json` (the site rejects cross-site
form posts).

- `POST /api/link/start` → `{ device_code, user_code, verification_uri, expires_in, interval }`
- `POST /api/link/poll` `{ device_code, label? }` → `pending` | `expired` | `{ status: "approved", token, name }`
- `POST /api/sync` (Bearer token) with the extension's export JSON → `{ ok, synced_at }`
- `GET /api/sync` (Bearer token) → `{ synced_at, size }`
- `DELETE /api/sync` (Bearer token) → disconnects that extension
