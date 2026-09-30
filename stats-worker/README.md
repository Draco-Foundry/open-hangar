# Open Hangar Store Stats

A Cloudflare Worker that saves each store's public numbers for Open Hangar once a day
(13:00 UTC, 7am Boise in summer) into a private D1 database. It has no public URL.

| Columns     | Source                                                                        |
| ----------- | ----------------------------------------------------------------------------- |
| `firefox_*` | addons.mozilla.org public API: daily users, weekly downloads, rating, version |
| `edge_*`    | Edge Add-ons public product details: active installs, rating, version         |
| `chrome_*`  | Chrome Web Store listing text; empty while Chrome hides small counts          |

Chrome's real numbers (installs, uninstalls, by country) are only in the Chrome Web Store
developer dashboard → Analytics. AMO → Statistics and Partner Center → Analytics have
deeper breakdowns for Firefox and Edge.

Nothing here comes from the extension: Open Hangar sends no telemetry.

## Commands

Run from `stats-worker/` after `npm install` and `npx wrangler login`:

- `npm run try` fetches today's numbers locally and prints them (no database).
- `npm run deploy` applies migrations and deploys the Worker.
- `npm run stats` shows the last 30 days.
