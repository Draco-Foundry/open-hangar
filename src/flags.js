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
    // Auto Scan Daily (owner, 2026-10-14, #666): a quick check of the connected RSI
    // account once a day, a full scan when something's new or a week has gone by, in the
    // hidden scan page. On in every build from 0.4.0: the privacy policy has its section
    // and names it under alarms and Disconnect (owner-approved words 2026-10-14;
    // test/privacy-permissions.test.js). Off for each pilot until they turn it on. Needs
    // alerts, whose build brings the alarms permission (scripts/pack.mjs).
    autoScan: {
      about: 'Auto Scan Daily: a quick check once a day while connected, a full scan when needed.',
      default: true,
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
