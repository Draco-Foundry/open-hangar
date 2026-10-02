# Moving openhangar.space to Cloudflare

openhangar.space moved off GitHub Pages onto Cloudflare on 2026-10-01 (#201). It's served as Workers static assets
(`site-worker/`), so it gets the same proxy, WAF, caching and analytics as app.openhangar.space.
`pages.yml` builds the site once and deploys it to both places until the switch.

## 1. Give This Repo a Cloudflare Key (Once)

Cloudflare → My Profile → API Tokens → **Create Token** → template **Edit Cloudflare Workers**:

- Account: Draco Foundry's account
- Zone: `openhangar.space`
- Add **Zone → DNS → Edit** (custom domains create a DNS record)

Then add two repo secrets in GitHub (open-hangar → Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: the token
- `CLOUDFLARE_ACCOUNT_ID`: from the right-hand side of the Cloudflare dashboard's account home

Run **Pages** (Actions → Pages → Run workflow). The site then also appears at
`openhangar-site.<your-subdomain>.workers.dev`; check it there.

## 2. Switch (About Five Minutes, Do It in One Go)

1. **Cloudflare → openhangar.space → DNS → Records:** delete the four `A` and four `AAAA` records for
   `openhangar.space` (GitHub's 185.199.x.153 and 2606:50c0:… addresses). The site is down from here
   until step 3 finishes.
2. **Merge the PR** that turns on the route in `site-worker/wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "openhangar.space", "custom_domain": true }],
   ```
   Then run **Pages**. Cloudflare creates the record and certificate, usually within a minute.
3. Check https://openhangar.space, `/privacy.html` and `/status.json`.
4. **www:** in DNS, set the `www` record to **Proxied**. Then Rules → **Redirect Rules** → template
   **"Redirect from WWW to root"** → Deploy. Check that https://www.openhangar.space lands on the
   apex.
5. **GitHub → open-hangar → Settings → Pages:** remove the custom domain and set Source to **None**.
   Then a follow-up PR drops the GitHub Pages steps from `pages.yml`.

Rollback: delete the Worker's custom domain (Workers → openhangar-site → Settings → Domains), add
back the A and AAAA records, and turn Pages back on.

## 3. Security Insights Cleanup (Same Day)

- **WAF → Managed rules:** deploy the **Cloudflare Free Managed Ruleset**.
- **Email → DMARC Management:** turn it on. It adds a `_dmarc` record with a report address
  (there's none today).
- **security.txt** (Security → Settings): contact `mailto:support@openhangar.space`, expiry one
  year out.
- **Archive, don't enable:** Bot Fight Mode / Super Bot Fight Mode (they'd block the extension's
  sync on the free plan) and AI Labyrinth.
- **Unproxied and dangling record insights** go away after step 2.

## 4. Home Page From the Website (2026-10-02)

openhangar.space's home page now comes from the website Worker (open-hangar-server), so it shows live
store, patch and status data. `site-worker/src/index.js` hands only `/`, `/_astro/*`, `/fonts/*` and
`/favicon.svg` to it through a service binding; every other path (`status.json`, `rates.json`, help,
privacy) is still a plain file and never runs the script. The home page is cached at the edge for a
minute. If the website Worker fails, the old `site/index.html` is served instead.

Staging copy, wired to staging.openhangar.space, on workers.dev only:
`npx wrangler deploy --config site-worker/wrangler.jsonc --env staging`.

Rollback: revert the PR and run **Pages**; the site goes back to the static home page.
