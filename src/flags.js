/*
 * flags.js: every build flag the extension has, in one place.
 * ---------------------------------------------------------------------------
 * A flag is decided when the extension is built and never changes after. Nothing
 * is fetched to turn one on: the stores don't allow remote code or remote switches
 * for it, so there is no remote config here, ever. docs/FLAGS.md has the rules.
 *
 * Each entry: `about` (one line), `default` (the public store build's value, off
 * unless there's a reason), `beta` (Open Hangar Beta's value; `default` if left
 * out), and `devOnly: true` for a flag no store build may have on
 * (scripts/check-store-build.mjs). Removing an entry retires the flag: a build
 * fails while code still has its markers.
 *
 * scripts/pack.mjs writes each build's values into BUILD_VALUES in the built copy
 * (dist/<target>/src/flags.js) and cuts the code of every flag that's off. This
 * file in the repo always holds the defaults.
 *
 * Read as OH.flags.<name> (true or false): the dashboard (loaded before lib.js),
 * the background worker (self.OH.flags) and the Svelte pages (ui/lib/flags.js).
 */
(function (root) {
  const REGISTRY = {
    sync: {
      about: 'Website sync: Connect This Browser, Sync Now and your hangar on the website.',
      default: true,
      beta: true,
    },
    orgFleet: {
      about: 'Org Fleet sharing with your org on the website. Nothing behind it yet.',
      default: false,
      devOnly: true,
    },
    // On since the privacy policy names our hangar page and what it may read
    // (test/privacy-permissions.test.js, owner-approved words 2026-10-10); in the store
    // builds from 0.3.0 (owner, 2026-10-13: the extension ships as the connector).
    localMode: {
      about: 'Our hangar page reads the hangar this browser scanned (Local Mode).',
      default: true,
    },
    // The website is the full app and the extension its connector (owner, 2026-10-10):
    // the toolbar opens a popup, and one basic page stays. Needs localMode. In every
    // build from 0.3.0 (owner, 2026-10-13).
    connector: {
      about: 'The connector: a toolbar popup and one basic page instead of the dashboard.',
      default: true,
    },
    // The basic page sends the wishlist this browser kept to the openhangar.space account,
    // once per connection (ui/scan/wishlist-import.js). On in every build from 0.3.0:
    // the privacy policy names it ("Your old wishlist, once", owner-approved words
    // 2026-10-13; test/privacy-permissions.test.js). It runs in the connector's basic page.
    wishlistImport: {
      about: "This browser's wishlist goes to your openhangar.space account, once per connection.",
      default: true,
    },
    // Store alerts matched on the device (connector plan 0.4, src/alerts.js). On in every
    // build from 0.3.0: the privacy policy names the sale feed, the Wishlist read and the
    // alarms and notifications permissions (owner-approved words 2026-10-13;
    // test/privacy-permissions.test.js). Off for each pilot until they turn it on. Needs
    // connector.
    alerts: {
      about: "Store alerts: a badge and notifications for what's on sale for you, matched here.",
      default: true,
    },
    // The Daily Scan Reminder (owner, 2026-10-26; it replaced Auto Scan Daily, #666): a
    // notification once a day at most, while connected, when the last scan in this
    // browser is over a day old; clicking it starts a scan. It never reads RSI on its
    // own. The flag keeps Auto Scan Daily's name until the privacy policy's words for the
    // reminder land (test/privacy-permissions.test.js). Off for each pilot until they
    // turn it on. Needs alerts, whose build brings the alarms and notifications
    // permissions (scripts/pack.mjs).
    autoScan: {
      about: 'Daily Scan Reminder: a notification to scan once a day while connected.',
      default: true,
    },
    // The popup's scan bar (owner, 2026-10-20): one bar where Scan sits, naming the part
    // running and counting what it has read, filled by RSI's page count, then how long
    // the scan took; Scan held back while one starts or RSI asks to wait. On in every
    // build (owner, 2026-10-23). Off: the bar under the header and the step list
    // (ui/popup/Hangar.svelte).
    scanBar: {
      about: 'The popup shows a scan as one counting bar where Scan sits, not a step list.',
      default: true,
    },
    // New Since Last Scan (owner, 2026-10-26): the pledges a scan found that the one
    // before it didn't, with their melt value, insurance and G and M marks, on the
    // popup's Hangar tab (ui/popup/Hangar.svelte). Off until its words are approved and
    // the privacy policy says the popup shows RSI's pictures of them.
    newSinceScan: {
      about: "The popup lists what the last scan found that the one before it didn't.",
      default: false,
    },
    // Order History (owner, 2026-10-30): once a pilot turns it on, a scan reads RSI's
    // order history (Account, Billing) and sync sends it as sources.orders
    // (schema/sync-payload.schema.json), so the website can show what each pledge cost.
    // Developer builds only until the privacy policy names it. Its page reader is in
    // (src/scraper/parser.js parseOrders, Pledge Store tab only); the scan step and the
    // setting that turns it on come next, with their words.
    orderHistory: {
      about: 'Order History: a scan reads RSI order history and sync sends it, once turned on.',
      default: false,
      devOnly: true,
    },
    // Your Subscriber Store and Concierge items (#418; owner, 2026-10-31): a scan reads the
    // Subscriber Store RSI shows the signed-in subscriber, and the pledge store items RSI
    // marks for a Concierge member, at most once a day (src/lib.js getSubStore,
    // ui/scan/runner.js), and sync sends them as sources.subStore
    // (schema/sync-payload.schema.json) for the website's Store. RSI lists them only to
    // that signed-in account, so only the pilot's own extension can read them. The privacy
    // policy names the read (docs/PRIVACY.md, 2026-10-31); developer builds only until the
    // owner's release turns it on.
    subStore: {
      about:
        'Your Subscriber Store and Concierge items: a scan reads them once a day and sync sends them.',
      default: false,
      devOnly: true,
    },
    // RSI Account Logs (owner, 2026-11-01): a scan reads RSI's pledge log and store credit
    // log (Account), the full history once when the pilot asks and the day's new lines
    // after (src/lib.js readAccountLogs, ui/scan/runner.js), and sync sends them as
    // sources.pledgeLog and sources.creditLog (schema/sync-payload.schema.json). Handles
    // and emails never leave the parser (src/scraper/parser.js). Developer builds only
    // until the privacy policy and the store forms name both reads.
    accountLogs: {
      about: 'RSI Account Logs: a scan reads the pledge and store credit logs and sync sends them.',
      default: false,
      devOnly: true,
    },
  };

  // Set per build by scripts/pack.mjs. Keep it empty here.
  const BUILD_VALUES = {};

  const OH = (root.OH = root.OH || {});
  const flags = {};
  for (const [name, f] of Object.entries(REGISTRY))
    flags[name] = Object.prototype.hasOwnProperty.call(BUILD_VALUES, name)
      ? BUILD_VALUES[name] === true
      : f.default === true;
  OH.flags = Object.freeze(flags);
  OH.flagRegistry = Object.freeze(REGISTRY);
})(typeof self !== 'undefined' ? self : globalThis);
