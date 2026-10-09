# openhangar.space pages through the website's edge gateway

Goal: the bare domain's pages come from Cloudflare's edge near the visitor, kept per
Day or Night look, and the site-worker's own one-minute copy (keyed on the address
only, so one visitor's look reached the next) goes.

## Steps

1. `site-worker/wrangler.jsonc`: an `EDGE` service binding to the website's edge gateway.
2. `site-worker/src/index.js`: the website's pages go to `EDGE` when bound; feeds and
   files to `APP`; every fallback as before; no `caches.default` copy.
3. Tests and `docs/SITE-CLOUDFLARE.md`.

## Done

- `npm test`; merged only after the gateway Worker exists in production (merging
  deploys openhangar.space).
