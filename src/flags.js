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
