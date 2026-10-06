<script>
  // Developers: how Open Hangar reads RSI, the data model and export file, and the
  // data tools (export / import, saved accounts, error report). Ported from the 0.2.x
  // page as it looked (no signed-off redesign yet), reusing the dashboard's classes.
  // Always drawn, even while another page shows: other pages use its buttons.
  import { app } from '../lib/app.svelte.js';
  import ExtLink from './ExtLink.svelte';
  import DataTools from './DataTools.svelte';
  import StorageUse from './StorageUse.svelte';
  import SavedAccounts from './SavedAccounts.svelte';
  import ErrorReport from './ErrorReport.svelte';
  import Supporters from './Supporters.svelte';

  const links = app().dev.links;

  // Kept as strings: Svelte would read the braces in the markup as expressions.
  const MODEL = `{ id, name, value, currency,
  contents: [{ kind, label, image }],
  image, containsShip,
  isCCU, ccu: { from, to },
  isAddOn, isCoupon,
  kind }   // ship | ccu | addon | coupon | other`;
  const EXPORT = `{
  app, appVersion, exportedAt, schemaVersion,   // provenance
  account: {                                    // who this is
    handle, displayName, avatar,
    ueeRecord, enlistedSince, country,
    organization: { name, sid, rank, logo },    // null if none / private
    subscriber, concierge,
    balances: {                                 // storeCredit.value is in CENTS
      storeCredit: { value, currency, symbol, label },
      uec:         { value, currency, symbol, label },
      rec:         { value, currency, symbol, label }
    },
    capturedAt
  },
  sources: {                                    // what they own
    hangar:   { items: [ …pledges… ],  scannedAt },
    buybacks: { items: [ …buy-backs… ], scannedAt },
    referral: { items: {                        // object, not array (one summary)
      current: { recruits }, legacy: { recruits }, prospects,
      recruitsList: [ { handle, moniker, enlistedOn, convertedOn, campaign } ],
      prospectsList: [ … ]
    }, scannedAt }                              // NB: referral code/url are NOT exported
  },
  history: [ { at, items: [ [id, name, value] ] } ]  // scan snapshots (Stats → History)
}`;
  const RSI = 'https://robertsspaceindustries.com';
</script>

<h2 class="section-title">For Developers</h2>
<div class="prose">
  <aside class="dev-linkbox">
    <div class="dlb-title">Quick Links</div>
    <span id="dev-links"
      >{#each links as [url, label] (label)}<ExtLink {url} {label} />{/each}</span
    >
    <a href="https://api.star-citizen.wiki" target="_blank" rel="noopener">star-citizen.wiki API</a>
    <a href="https://docs.star-citizen.wiki" target="_blank" rel="noopener">API Docs</a>
    <a href="{RSI}/tos" target="_blank" rel="noopener">RSI Terms of Service</a>
  </aside>
  <p>
    Open Hangar is built as a <strong>data tool</strong>: it reads a user's own Star Citizen
    account and organizes it into a clean, structured, local database that other tools and sites
    can build on. Source available and auditable.
  </p>

  <h3>How It Pulls Data</h3>
  <p>
    RSI uses cookie-based session auth. The extension holds host permission for
    <code>robertsspaceindustries.com</code>, so its own <code>fetch</code> requests carry the
    user's existing session cookie (no password, no RSI tab, no server). Server-rendered pages
    (the hangar) are fetched and parsed locally; nothing is sent anywhere. The fragile bit (RSI's
    markup) is isolated in <code>parser.js</code>.
  </p>

  <h3>The Data Model</h3>
  <p>Every pledge is normalized to one object:</p>
  <pre>{MODEL}</pre>
  <p>
    The <strong>hangar</strong>, <strong>buy-backs</strong>,
    <strong>account identity + balances</strong> (handle, org, rank, Store Credit, UEC, REC, read
    from the dashboard's embedded JSON and the public citizen dossier), and
    <strong>referrals</strong> (code + recruits/prospects via RSI's GraphQL API) are live; the
    <strong>store catalog</strong> is planned.
  </p>

  <h3>The Export File</h3>
  <p>
    One self-describing JSON file, ordered <em>provenance → who → what they own</em> so it maps
    straight onto a backend table. Schema <strong>v2</strong> added the
    <code>account</code> block (org, rank, balances); v1 had <code>sources</code> only.
  </p>
  <pre>{EXPORT}</pre>

  <h3>Using It in Your Project</h3>
  <p>
    <strong>JSON export/import is live</strong>: download the whole database (the shape above) to
    back it up or feed it into your own project; import restores a previous export. Import
    restores the <code>sources</code> (holdings) and merges the scan
    <code>history</code> with what's already here; the <code>account</code> block is a read-only
    snapshot for consumers (the Citizen Card always reflects the live RSI session). Still on the
    roadmap: an opt-in way for sites you approve to ask the extension for your data directly,
    instead of exporting a file by hand. It would be limited to a short list of domains you trust,
    using the browser's
    <code>externally_connectable</code> messaging channel (note this isn't supported identically
    across Chrome, Firefox, and Safari).
  </p>
  <DataTools />
  <StorageUse />

  <h3>Saved Accounts</h3>
  <p>
    Each RSI account you scan keeps its own data here. Sign in as another account and Open Hangar
    sets the current one aside and loads that account's last scan instead.
  </p>
  <SavedAccounts />

  <h3>Error Report</h3>
  <p>
    Something not working? Copy this report and paste it in #bug-reports on Discord or in a GitHub
    issue. It has your Open Hangar version, browser, item counts and the recent errors. It doesn't
    include your handle, referral code or any item names.
  </p>
  <ErrorReport />

  <h3>Terms &amp; Fair Use</h3>
  <ul>
    <li>Read-only, personal, and rate-limited: it reads only the signed-in user's own account.</li>
    <li>Respect RSI's Terms of Service; don't redistribute other people's data.</li>
    <li>Source available: read and audit every line, and file issues and ideas on GitHub.</li>
  </ul>

  <h3>Data Sources &amp; References</h3>
  <p>
    Where every piece of data comes from, handy for verifying the scrape or building your own:
  </p>
  <ul>
    <li>
      <strong>Hangar</strong> (live):
      <a href="{RSI}/account/pledges" target="_blank" rel="noopener">RSI › Account › Pledges</a>
      · server-rendered HTML, parsed by <code>parser.js</code>
    </li>
    <li>
      <strong>Account identity + balances</strong> (live):
      <a href="{RSI}/en/account/dashboard" target="_blank" rel="noopener"
        >RSI › Account › Dashboard</a
      >
      · embedded JSON blob
    </li>
    <li>
      <strong>Buy-Backs</strong> (live):
      <a href="{RSI}/en/account/buy-back-pledges" target="_blank" rel="noopener"
        >RSI › Account › Buy-Back Pledges</a
      >
      · server-rendered HTML, parsed by <code>parser.js</code>
    </li>
    <li>
      <strong>Referrals</strong> (live):
      <a href="{RSI}/en/referral" target="_blank" rel="noopener">RSI › Referral Rewards</a>
      · <code>POST /graphql</code> (<code>GetReferralRecruitsList</code>); code from the dashboard
      JSON
    </li>
    <li>
      <strong>Store catalog &amp; prices</strong> (planned):
      <a href="{RSI}/pledge" target="_blank" rel="noopener">RSI Pledge Store</a>
      ·
      <a href="{RSI}/ship-matrix" target="_blank" rel="noopener">Ship Matrix</a>
    </li>
    <li>
      <strong>Game version &amp; ship data</strong>:
      <a href="https://api.star-citizen.wiki" target="_blank" rel="noopener"
        >star-citizen.wiki API</a
      >
      · <a href="https://docs.star-citizen.wiki" target="_blank" rel="noopener">API Docs</a>
    </li>
    <li>
      <strong>RSI Terms of Service</strong>:
      <a href="{RSI}/tos" target="_blank" rel="noopener">robertsspaceindustries.com/tos</a>
    </li>
  </ul>

  <h3>Thanks &amp; Supporters</h3>
  <p>
    Open Hangar is community-built and community-kept. Huge thanks to everyone who contributes
    code, reports parser breakages when RSI changes their site, or supports the project on
    Discord.
  </p>
  <Supporters />
</div>
