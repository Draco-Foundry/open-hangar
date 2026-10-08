# fix/site-worker-new-pages

## Goal

openhangar.space hands the website's newer public pages to the website Worker on
purpose, like `/`, `/extension` and `/store`: the Ship Explorer (`/ships` and each ship
at `/ships/<name>`), What's Next (`/whats-next`) and Help (`/help`). Each is dark
behind its own flag on the website, so it stays a 404 until the owner switches it on.
The static Troubleshooting page at `/help.html` keeps working exactly as it is.

## Steps

1. `site-worker/wrangler.jsonc`: add `/ships`, `/ships/*`, `/whats-next` and `/help`
   to `run_worker_first` (exact paths, so `/help.html` is untouched).
2. `site-worker/src/index.js`: name these pages and give them their own failure
   path. The website's own answer (its page, or its 404 while a flag is off) passes
   through. If the website is down or errors, never the old static home page:
   - `/help` gets the static Troubleshooting page (`site/help.html`, canonical
     `/help.html`), the most useful thing to show someone looking for help.
   - The Ship Explorer and What's Next get a short "try again" 503 with Retry-After,
     so a passing outage never looks like a missing page.
   No edge caching for these pages here; the website sets its own cache headers.
3. Check locally with `wrangler dev` (no website bound, so every forward fails):
   `/help.html` is still the static file, `/help` falls back to Troubleshooting,
   `/ships`, `/ships/<name>` and `/whats-next` answer 503, `/` still falls back home.
4. `npm run format:check`, `npm test`.

## Done

- The routes and the script agree, the comments say what really happens.
- Local checks above behave as listed; the Pages workflow's deploy step is unchanged.
- Draft PR against `main`, "Goes live on merge" at the top of the body.
- This plan file is deleted before merge.
