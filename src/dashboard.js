/*
 * dashboard.js — the full-page hangar hub (multi-view app).
 * Views: Home (with the About panel), Inventory (fleet gallery), Stats,
 * Buy-Backs, Store Data. Routed by URL hash so views can be linked/bookmarked.
 * Reads the scan from local storage; scanning goes through lib.js (cookie'd
 * fetch, no tab needed).
 */

const $ = (sel) => document.querySelector(sel);
const VIEWS = [
  'home',
  'inventory',
  'buybacks',
  'stats',
  'store',
  'org',
  'referrals',
  'updates',
  'issues',
  'guide',
  'developers',
];

const statusEl = $('#status');

// Buy-back kind labels (buy-backs classify into a slightly different set than
// the hangar — notably 'paint'). Order = display order.
const BB_KINDS = [
  { key: 'ship', label: 'Ships' },
  { key: 'pack', label: 'Packs' },
  { key: 'package', label: 'Packages' },
  { key: 'ccu', label: 'CCUs' },
  { key: 'paint', label: 'Paints' },
  { key: 'addon', label: 'Add-Ons' },
  { key: 'coupon', label: 'Coupons' },
  { key: 'other', label: 'Other' },
];

// Referral reward ladders (STATIC reference data, sourced from
// starcitizen.tools/Referral_program, May 2026). Both ladders are keyed by the
// same recruit/recruitment-point count, so we compute the user's progress on each
// from their scraped recruit total. `at` = recruits/RP required; `reward` = what
// unlocks there. Not per-account — this is the public tier list everyone shares.
// (Live "which have I claimed" state is a future enhancement; see TODO.)
const REFERRAL_LADDER_STANDARD = [
  // Each tier's reward is a list of individual items. `ship: true` items get a
  // lazy-resolved hover image (OH.getShipImage) + an RSI ship-matrix link; other
  // items link to a starcitizen.tools search. `img` names the ship to resolve when
  // it differs from the display label.
  { at: 1, items: [{ n: 'GCD-Army Armor Set' }] },
  { at: 2, items: [{ n: 'Quartz "GCD-Army" SMG' }] },
  { at: 3, items: [{ n: 'Gladius Dunlevy Model' }] },
  { at: 4, items: [{ n: 'Pulse', ship: true }, { n: 'Pulse "GCD-Army" Paint' }] },
  { at: 5, items: [{ n: 'Parallax "GCD-Army" Energy Assault Rifle' }] },
  { at: 6, items: [{ n: 'Archibald Hurston Figurine' }] },
  { at: 7, items: [{ n: 'ArcCorp Cog Sphere Replica' }] },
  { at: 8, items: [{ n: 'Stormwal Sculpture Replica' }] },
  { at: 9, items: [{ n: "Wally's Bar Hologram Replica" }] },
  { at: 10, items: [{ n: 'Big Benny\'s "Classic" Vending Machine' }] },
  { at: 15, items: [{ n: 'Spirit of the Starman Statue' }] },
  { at: 25, items: [{ n: 'Enemy of the Empire Statue' }] },
  { at: 42, items: [{ n: 'Gladius Dunlevy', ship: true, img: 'Gladius' }] },
  { at: 50, items: [{ n: 'R.A.P.T.O.R' }] },
  { at: 75, items: [{ n: 'Storm', ship: true }, { n: 'Storm "GCD-Army" Paint' }] },
  {
    at: 100,
    items: [{ n: 'Freelancer MAX', ship: true }, { n: 'Freelancer Paint Pack (4 paints)' }],
  },
  { at: 200, items: [{ n: 'Esperia Stinger', ship: true, img: 'Stinger' }] },
  { at: 500, items: [{ n: 'Captured Vanduul Scythe', ship: true, img: 'Scythe' }] },
  { at: 1042, items: [{ n: 'Idris-M', ship: true }] },
];
const REFERRAL_LADDER_LEGACY = [
  { at: 1, rank: 'Recruiter', items: [{ n: 'Badger Repeater' }, { n: 'UEE badges' }] },
  { at: 3, rank: 'Private', items: [{ n: 'Gimbal Mounts' }, { n: 'Bulldog Repeaters' }] },
  {
    at: 5,
    rank: 'Corporal',
    items: [{ n: 'PTV (LTI)', ship: true, img: 'PTV' }, { n: 'Fish Tank' }],
  },
  {
    at: 10,
    rank: 'Sergeant',
    items: [{ n: 'Gladius (LTI)', ship: true, img: 'Gladius' }, { n: 'Gold Display Case' }],
  },
  { at: 25, rank: 'Lieutenant', items: [{ n: 'Arena Commander Racing Package' }] },
  { at: 42, rank: 'Captain', items: [{ n: 'Arena Commander Combat Package' }] },
  { at: 75, rank: 'Major', items: [{ n: 'Razor (LTI)', ship: true, img: 'Razor' }] },
  {
    at: 100,
    rank: 'Lt. Colonel',
    items: [{ n: 'Esperia Blade replica (LTI)', ship: true, img: 'Blade' }],
  },
  {
    at: 200,
    rank: 'Colonel',
    items: [{ n: 'Esperia Glaive replica (LTI)', ship: true, img: 'Glaive' }],
  },
  {
    at: 500,
    rank: 'Brigadier General',
    items: [
      { n: 'Anvil Terrapin (LTI)', ship: true, img: 'Terrapin' },
      { n: 'Anvil Hurricane (LTI)', ship: true, img: 'Hurricane' },
    ],
  },
  { at: 1042, rank: 'Major General', items: [{ n: 'Million Mile High Club access' }] },
  {
    at: 2017,
    rank: 'Lt. General',
    items: [{ n: 'Aegis Javelin (LTI)', ship: true, img: 'Javelin' }],
  },
];
// Each tier's picture on starcitizen.tools/Referral_program (a wiki file name,
// resolved to an image URL by OH.wikiImageUrls). Keyed by recruits needed.
const REFERRAL_TIER_FILES = {
  standard: {
    1: 'Referral Armor 21 9.jpg',
    2: 'Volt SMG Energy 01 UEE01.jpg',
    3: 'Referral Gladius Statue.jpg',
    4: 'Referral Pulse.jpg',
    5: 'Volt Rifle Energy 01 UEE01.jpg',
    6: 'Referral Statue Hurston.jpg',
    7: 'Referral Flair Arccorp statue.jpg',
    8: 'Referral Flair Orison statue.jpg',
    9: 'Referral Flair Newbabbage statue.jpg',
    10: 'Referral Flair BigBennys.jpg',
    15: 'Player Deco Statue Stand NavyPilot 21 9.jpg',
    25: 'Player Deco Statue Stand Vanduul 21 9.jpg',
    42: 'Referral Gladius Paint Squadron.jpg',
    50: 'R.A.P.T.O.R sweeping waste front - Cropped.jpg',
    75: 'Referral Storm Paint UEE.jpg',
    100: 'Referral Freelancer Group.jpg',
    200: 'Stinger landed in cave hanger with pilot looking at it.jpg',
    500: 'Scythe x2 flying by desert world.jpg',
    1042: 'Idris M flying over world - cropped.jpg',
  },
  legacy: {
    1: 'Badger and Badges.png',
    3: 'Gimbals and Guns.png',
    5: 'SurfAndTurf.jpg',
    10: 'GladiusAndGold.jpg',
    25: 'Arena Commander Racing Package.png',
    42: 'Arena Commander Combat Package.png',
    75: 'Razor in space - Isometric.jpg',
    100: 'Blade.jpg',
    200: 'Vanduul glaive viz3.jpg',
    500: 'Anvil Ship Package.png',
    1042: 'MMHC.png',
    2017: 'Invictus-2951-Javelin-War-Hammer-flyby-everus.jpg',
  },
};
for (const t of REFERRAL_LADDER_STANDARD) t.file = REFERRAL_TIER_FILES.standard[t.at];
for (const t of REFERRAL_LADDER_LEGACY) t.file = REFERRAL_TIER_FILES.legacy[t.at];

// Time-limited "special incentive" events: a recruit who CONVERTS (buys a game
// package, spending the threshold) inside one of these windows earns a bonus reward.
// `reward` is what the REFERRER ("You") earns. STATIC reference data, complete list
// from starcitizen.tools/Referral_program (verified June 2026). Dates inclusive
// [start, end]. The built-in starting point: CIG adds events about monthly, and new ones
// arrive through openhangar.space's referral feed (refreshReferralEvents below).
const REFERRAL_EVENTS = [
  {
    start: '2019-10-28',
    end: '2019-11-05',
    name: 'Alpha 3.7.0 Free Fly',
    reward: 'Kruger P-52 Merlin',
  },
  { start: '2020-04-29', end: '2020-05-11', name: 'Alpha 3.9.0', reward: 'Greycat PTV (LTI)' },
  {
    start: '2020-09-09',
    end: '2020-09-24',
    name: 'Ship Showdown 2020',
    reward: 'Kruger P-52 Merlin (LTI)',
  },
  { start: '2020-12-17', end: '2021-01-11', name: 'Alpha 3.12.0', reward: 'Drake Dragonfly (LTI)' },
  { start: '2021-04-22', end: '2021-05-17', name: 'Alpha 3.13.0', reward: 'RSI Aurora ES (LTI)' },
  {
    start: '2021-08-06',
    end: '2021-08-31',
    name: 'Alpha 3.14.0',
    reward: 'Drake Dragonfly (LTI, Coalfire paint)',
  },
  {
    start: '2021-11-01',
    end: '2021-11-30',
    name: 'Alpha 3.15.0 Fall',
    reward: 'Argo MPUV-1C (LTI)',
  },
  {
    start: '2022-02-17',
    end: '2022-02-28',
    name: 'Alpha 3.16.1 Free Fly',
    reward: 'Artimex Lodestone Armor + Gemini A03 Sniper Rifle',
  },
  {
    start: '2022-09-08',
    end: '2022-09-18',
    name: 'Ship Showdown 2022',
    reward: 'Consolidated Outland HoverQuad (LTI)',
  },
  { start: '2022-12-08', end: '2023-01-09', name: 'Luminalia 2952', reward: 'Argo MPUV-1C (LTI)' },
  {
    start: '2023-04-13',
    end: '2023-05-02',
    name: 'Alpha 3.18.0 Free Fly',
    reward: 'Kruger P-52 Merlin (LTI)',
  },
  {
    start: '2023-07-06',
    end: '2023-07-31',
    name: 'Foundation Festival',
    reward: 'Greycat STV (LTI, Electric Green paint)',
  },
  {
    start: '2023-10-19',
    end: '2023-10-30',
    name: 'Alpha 3.21.0',
    reward: 'HoverQuad (LTI, Copperhead paint)',
  },
  {
    start: '2023-12-11',
    end: '2024-01-08',
    name: 'Luminalia 2953',
    reward: 'CCC Aves Armor Set + gear bundle',
  },
  {
    start: '2024-02-08',
    end: '2024-02-26',
    name: 'Lunar New Year 2024',
    reward: 'Drake Dragonfly Black + Red Alert gear',
  },
  {
    start: '2024-04-12',
    end: '2024-05-02',
    name: 'Overdrive Initiative',
    reward: 'Kruger P-52 Merlin (LTI)',
  },
  {
    start: '2024-07-12',
    end: '2024-07-31',
    name: 'Foundation Festival 2024',
    reward: 'Aopoa Nox (LTI)',
  },
  {
    start: '2024-10-17',
    end: '2024-10-31',
    name: 'CitizenCon 2954',
    reward: 'HoverQuad (LTI, Copperhead paint)',
  },
  { start: '2024-12-10', end: '2025-01-06', name: 'Luminalia 2954', reward: 'Mirai Pulse (LTI)' },
  {
    start: '2025-01-28',
    end: '2025-02-17',
    name: 'Lunar New Year 2955',
    reward: 'Drake Dragonfly (Coalfire paint)',
  },
  {
    start: '2025-05-15',
    end: '2025-05-27',
    name: 'Invictus Launch Week 2955',
    reward: 'Kruger P-52 Merlin (LTI)',
  },
  {
    start: '2025-11-20',
    end: '2025-12-05',
    name: 'IAE 2955',
    reward: 'Star Kitten Drake Dragonfly',
  },
  {
    start: '2026-02-11',
    end: '2026-02-23',
    name: 'Coramor 2956',
    reward: 'HoverQuad (LTI, Lovestruck paint)',
  },
];
// Live list: the built-in one, refreshed from the wiki (refreshReferralEvents).
let referralEvents = REFERRAL_EVENTS;

// Community links — fill these in (footer + Developers page use them).
// Until set, a "soon" placeholder shows instead of a broken link.
const REPO_URL = 'https://github.com/Draco-Foundry/open-hangar';
const DISCORD_URL = 'https://discord.gg/FF8Wm5HdnV';
// Feature ideas live in GitHub Discussions → Ideas (upvotable); Discord covers
// people without a GitHub account.
const IDEAS_URL = `${REPO_URL}/discussions/categories/ideas`;
// Optional support (#240): one-off tips on Ko-fi, monthly on Patreon. Plain links,
// opened only when clicked; nothing is loaded from either site. The footer's own
// support line (logo buttons) is static in dashboard.html.
const KOFI_URL = 'https://ko-fi.com/dracofoundry';
const PATREON_URL = 'https://www.patreon.com/DracoFoundry';

// Supporters shown on the Developers page. Each entry is { name, url? }.
// Empty arrays render a friendly placeholder. When the GitHub repo is public
// these could be replaced by a live contributors-API fetch (see ROADMAP); kept
// static for now to avoid an extra network call.
const CONTRIBUTORS = [];
const BOOSTERS = [];

const LAYOUTS = ['gallery', 'compact', 'list', 'market'];

const state = {
  items: [],
  scannedAt: null,
  buybacks: [], // buy-back pledges (separate source)
  buybacksScannedAt: null,
  bbQuery: '',
  bbPriceMax: null, // Buy-Backs filter: price cap in dollars (null = no cap)
  bbFolded: false, // Buy-Backs: filter sidebar folded away
  bbClosed: new Set(['from', 'size']), // Buy-Backs: filter groups folded shut
  bbStack: false, // Buy-Backs: stack identical ones (off: each buy-back is its own)
  bbHideSmall: true, // Buy-Backs: paints, add-ons, coupons tucked away
  hideSmall: false, // Inventory: same
  meltMax: null, // Inventory filter: melt value cap in dollars (null = no cap)
  invFolded: false, // Inventory: filter sidebar folded away ("‹ Hide Filters")
  invClosed: new Set(['from', 'size']), // Inventory: filter groups folded shut
  savedViews: [], // Inventory saved views: { name, shown, traits, query, sort }
  bbSort: 'date-desc', // default to newest buy-backs first
  groupByType: true, // Inventory: one section per type
  bbDetails: {}, // pledge id → details from the buy-back's own RSI page or your hangar history
  bbShown: new Set(), // buy-back kind filter
  bbTraits: new Map(), // buy-back filter picks: group key → Set of option keys (BB_GROUPS)
  bbLayout: 'gallery', // gallery | compact | list | market (independent of inventory)
  owner: null, // { nickname, displayname } the stored data was scanned from
  storeCredit: null, // dollars, from the RSI account (counts in Account Value)
  shown: new Set(), // inventory kind filter
  traits: new Map(), // inventory filter picks: group key → Set of option keys (INV_GROUPS)
  priceOf: null, // ship name → { msrp } resolver (OH.getShipIndex), once loaded
  catalog: null, // slim wiki ship list for the Store page (OH.getShipCatalog)
  shipOf: null, // ship name → wiki catalog entry (role, size, cargo…), once loaded
  history: [], // hangar scan snapshots (OH.getHistory), oldest first
  selecting: false, // Inventory "Select" mode (pick items for a fleet image)
  selected: new Set(), // picked pledge ids (strings)
  imagePrice: 'melt', // fleet image price column: melt | mine | store | none
  statsTab: 'overview', // Stats tab: overview | value | fleet | history
  lastBackupAt: null, // when the user last downloaded a JSON backup (ms)
  query: '',
  sort: 'default',
  layout: 'gallery', // gallery | compact | list | market
  // Market (sale-sheet) "My Price" annotations, keyed by item (see marketKey):
  // { [key]: { price } }. Stored SEPARATELY from the scan so a re-scan never
  // wipes your prices. Purely local — never exported or sent.
  market: {},
  wishlist: [], // ship names (Store → Wishlist)
  wishSort: 'name', // Store → Wishlist order: name | price-desc | price-asc | stock | mine
  bbPicked: new Set(), // Buy-Backs Market: picked buy-back ids (for totals + exports)
  marketGiftableOnly: false, // Market view: show only sellable (giftable) items
  referral: null, // { code, url, current, legacy, prospects, recruitsList, prospectsList }
};

// All dynamic markup goes through setHTML() instead of innerHTML. It's an
// ALLOWLIST sanitizer (the same idea as DOMPurify): the HTML is parsed into an
// inert document, and only the tags and attributes this dashboard actually uses
// survive. Links must be ordinary web/mailto/relative URLs, and style attributes
// can't load anything (no url()). Anything else is dropped and logged as
// "[setHTML] dropped …" (the UI smoke test fails on that log), so it backs up
// OH.escapeHtml rather than replacing it. Table sections parse in table context
// so <tr>/<td> survive.
const htmlParser = new DOMParser();
const TABLE_PARTS = new Set(['TBODY', 'THEAD', 'TFOOT']);
const SAFE_TAGS = new Set(
  (
    'a abbr b br button caption code details div em figcaption figure h2 h3 h4 hr i img ' +
    'input label li ol option p pre section select small span strong sub summary sup ' +
    'table tbody td th thead time tr u ul ' +
    'svg g circle ellipse line path polygon polyline rect text tspan title defs lineargradient stop'
  ).split(' '),
);
const SAFE_ATTRS = new Set(
  (
    'alt checked class colspan datetime disabled draggable height hidden href id inputmode loading ' +
    'maxlength name placeholder rel role rowspan selected src style tabindex target title type ' +
    'value width srcset sizes ' +
    'cx cy d dominant-baseline fill fill-opacity font-size font-weight offset opacity points ' +
    'preserveaspectratio r rx ry stop-color stroke stroke-dasharray stroke-linecap ' +
    'stroke-linejoin stroke-opacity stroke-width text-anchor transform viewbox x x1 x2 xmlns y y1 y2'
  ).split(' '),
);
const SAFE_URL = /^(https?:|mailto:|#|\/|\.|[^:]*$)/i;
function setHTML(el, html) {
  if (!el) return;
  if (html == null || html === '') {
    el.replaceChildren();
    return;
  }
  const tag = el.tagName;
  const t = tag.toLowerCase();
  let src = String(html);
  if (tag === 'TR') src = `<table><tbody><tr>${src}</tr></tbody></table>`;
  else if (TABLE_PARTS.has(tag)) src = `<table><${t}>${src}</${t}></table>`;
  else if (tag === 'TABLE') src = `<table>${src}</table>`;
  const body = htmlParser.parseFromString(src, 'text/html').body;
  const root =
    tag === 'TR' || TABLE_PARTS.has(tag) || tag === 'TABLE' ? body.querySelector(t) : body;
  for (const node of [...root.querySelectorAll('*')]) {
    const name = node.tagName.toLowerCase();
    if (!SAFE_TAGS.has(name)) {
      console.warn(`[setHTML] dropped <${name}>`);
      node.remove();
      continue;
    }
    for (const a of [...node.attributes]) {
      const an = a.name.toLowerCase();
      const known = SAFE_ATTRS.has(an) || an.startsWith('data-') || an.startsWith('aria-');
      const badUrl =
        ((an === 'href' || an === 'src') && !SAFE_URL.test(a.value.trim())) ||
        (an === 'srcset' &&
          a.value.split(',').some((c) => !SAFE_URL.test(c.trim().split(/\s+/)[0] || '')));
      const badStyle = an === 'style' && /url\s*\(|expression|javascript:/i.test(a.value);
      if (!known || badUrl || badStyle) {
        console.warn(`[setHTML] dropped ${an}= on <${name}>`);
        node.removeAttribute(a.name);
      }
    }
  }
  el.replaceChildren(...root.childNodes);
}

function setStatus(text, isError = false, { scan = false } = {}) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  if (isError) {
    OH.log('error', 'status', text);
    // One click to the Flight Log in #bug-reports on Discord (#315).
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-btn';
    btn.textContent = 'Send Flight Log';
    btn.title = 'Copies your flight log and opens #bug-reports on Discord.';
    btn.addEventListener('click', () => sendFlightLog(btn));
    statusEl.append(' ', btn);
    if (scan) {
      // A failed or partial scan: open a prefilled Scan Broken issue (#250).
      const rep = document.createElement('button');
      rep.type = 'button';
      rep.className = 'link-btn';
      rep.textContent = 'Report on GitHub ↗';
      rep.title =
        'Opens a GitHub issue with your flight log filled in. Nothing is sent until you submit it.';
      rep.addEventListener('click', () => openScanReport(text));
      statusEl.append(' · ', rep);
    }
  }
}

// Open the prefilled Scan Broken issue in a new tab (#250). Counts and the
// flight log only; the person reviews it on GitHub before anything is sent.
async function openScanReport(summary) {
  let version = '';
  try {
    version = chrome.runtime.getManifest().version;
  } catch {
    /* not in an extension page */
  }
  const url = OH.scanProblemUrl({
    summary,
    report: await OH.errorReport({ maxLines: 25 }),
    version,
  });
  window.open(url, '_blank', 'noopener');
}

// The Flight Log (#315): OH.errorReport() to the clipboard; `el` shows the outcome
// briefly.
async function copyFlightLog(el) {
  const text = await OH.errorReport();
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    /* clipboard blocked: the Developers page shows the text to copy by hand */
  }
  if (el) {
    const was = el.textContent;
    el.textContent = ok
      ? 'Flight log copied. Drop it in #bug-reports and the engineers will suit up.'
      : 'Copy failed. Grab it from Developers → Flight Log.';
    setTimeout(() => {
      el.textContent = was;
    }, 4000);
  }
  return ok;
}

// Send Flight Log (#315): copy it, then open #bug-reports on Discord in a new tab
// (an invite made from that channel; members land in the server). Pasting stays
// manual: browsers don't allow auto-paste. Copy first, while this page has focus.
const BUG_REPORTS_INVITE = 'https://discord.gg/pxJ6PzQe7z';
async function sendFlightLog(el) {
  const ok = await copyFlightLog(null);
  if (ok) window.open(BUG_REPORTS_INVITE, '_blank', 'noopener');
  if (el) {
    const was = el.textContent;
    el.textContent = ok
      ? 'Flight log copied. Paste it in #bug-reports.'
      : 'Copy failed. Grab it from Developers → Flight Log.';
    setTimeout(() => {
      el.textContent = was;
    }, 4000);
  }
  return ok;
}

// Uncaught page errors go into the log too (paths only, no extension id).
window.addEventListener('error', (e) => {
  const where = `${e.filename || '?'}:${e.lineno || 0}`;
  OH.log('error', 'page', e.error?.stack || `${e.message} @ ${where}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  OH.log('error', 'page', `unhandled: ${(r && (r.stack || r.message)) || r}`);
});

// The top bar is Svelte (ui/topbar, mounted into the page's <header>). It reads
// `topBar` through window.OHApp.top and redraws on 'oh:home'; scanning, storage and
// what its menus do stay here.
const SCAN_SOURCES = ['hangar', 'buybacks', 'referrals', 'store'];
const topBar = {
  busy: false, // a scan is running: Scan and Scan Now are disabled
  // While `scanning`, the Scan button shows the progress below (label, fill %, hover
  // text) instead of "Scan All" / "Scan Custom", until the end flash fades.
  scanning: false,
  label: '',
  // The last scan's report when it ended with a problem (ui/topbar/ScanReport.svelte):
  // { kind: 'out' | 'part' | 'none', rows: [{ name, ok, text }], summary, last, n }.
  // Cleared when the next scan starts; the button says Rough Landing till then.
  // A report of its own may bring its own title, sub and button label (the website
  // sync's "Not Synced").
  report: null,
  fill: 0,
  title: '',
  detail: '', // what the scan is on right now, for the ▾ menu
  sources: [...SCAN_SOURCES], // ticked in the ▾ menu (remembered in scanSources)
  update: null, // a newer version waiting for a reload ("Update ready")
  currency: 'USD', // the gear menu's pick (fx follows once the rates load)
  remind: true, // Rescan Reminder
  loggingOut: false,
};

// Scan progress shows in the top bar's Scan button itself (every page): it fills
// as the chosen sources finish ("Scanning… 2/4") and says what it's on in its hover
// text; at the end "✓ Landed" (or "⚠ Rough Landing") for a moment, then Scan All.
const scanProgress = { i: 0, n: 1 };
let scanDoneTimer = null;
// What the scan is on right now ("Buy-backs · page 8 · 800 items"). Never in the
// Citizen Card, where a growing line pushed the card around (#170): the Scan
// button's hover text and its ▾ menu, and on the first scan (the welcome card is
// up) a big progress bar in place of Scan All Now. '' = the scan ended.
function scanDetail(text) {
  if (text) topBar.title = text;
  topBar.detail = text || '';
  // The welcome card (ui/home/Welcome.svelte) shows it while it's up.
  const { i, n } = scanProgress;
  homeCard.scan = { text, pct: Math.max(4, Math.min(100, ((i + 0.5) / n) * 100)) };
  homeUpdated();
}
// `label` replaces "Scanning… 2/4" for a step of its own (the website sync, the
// scan's last step when connected).
function setScanning(text, done = false, label = '') {
  clearTimeout(scanDoneTimer);
  homeUpdated();
  if (!text) {
    topBar.scanning = false;
    topBar.fill = 0;
    return;
  }
  topBar.scanning = true;
  const clean = text.replace(/^[✓⚠]\s*/, '');
  if (done) {
    topBar.fill = 100;
    topBar.label = /^⚠/.test(text) ? 'Rough Landing' : '✓ Landed';
    topBar.title = /^⚠/.test(text) ? clean : `${OH.quip('scanDone')} ${clean}`;
    scanDoneTimer = setTimeout(() => setScanning(''), 2200);
    return;
  }
  const { i, n } = scanProgress;
  topBar.fill = Math.max(6, (i / n) * 100);
  topBar.label = label || (n > 1 ? `Scanning… ${Math.min(i + 1, n)}/${n}` : 'Scanning…');
  topBar.title = label ? clean : `Scanning ${clean}`;
}

// Amounts are USD; `fx` converts them to the display currency (Home → Currency).
// `rawMoney` is for numbers the user typed (My Price), which aren't converted.
const fx = { code: 'USD', rate: 1, date: null };
// Streamer Mode (gear menu): money amounts show as dots everywhere, hover text
// included, for streams and screenshots. Set from storage at startup.
const streamer = { on: false };
const MASK = '••••';
const fmtCurrency = (n, digits) => {
  if (streamer.on) return MASK;
  if (OH.ZERO_DECIMAL.includes(fx.code)) digits = 0; // ¥ / ₩ have no cents
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: fx.code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
};
const money = (n) => fmtCurrency(n * fx.rate, 2);
const dollars = (n) => fmtCurrency(Math.round(n * fx.rate), 0);
const rawMoney = (n) => fmtCurrency(n, 2);
// For tight boxes: 10,000 and up in short form ("CN¥13.7K"); the caller puts
// the full amount on hover.
// 1,234,567 → "1.2M", 90,000 → "90K"; under 10,000 stays exact ("9,500").
const compactNum = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a < 10000) return v.toLocaleString('en-US');
  const [d, u] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const x = v / d;
  return `${Math.abs(x) >= 100 ? Math.round(x) : Number(x.toFixed(1))}${u}`;
};
const shortMoney = (n, full) => {
  if (streamer.on) return MASK;
  const v = n * fx.rate;
  if (Math.abs(v) < 10000) return full(n);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: fx.code,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);
};

// --- Hangar value (ship store prices) ---------------------------------------
// Prices come from the ship list (bundled + openhangar.space's ships feed, OH.getPriceIndex).
// Loaded lazily the first time a view needs them; views re-render once ready.
let pricesLoading = null;
let valueCache = { items: null, priceOf: null, value: null };
function ensurePrices() {
  if (state.priceOf || pricesLoading || !state.items.length) return;
  pricesLoading = OH.getShipIndex()
    .then(async ({ priceOf, shipOf }) => {
      state.priceOf = priceOf;
      state.shipOf = shipOf;
      state.catalog = await OH.getShipCatalog();
      pricesLoading = null;
      route();
    })
    .catch(() => {
      pricesLoading = null;
    });
}
// OH.hangarValue for the current items, memoised until the items change.
function hangarValue() {
  if (!state.priceOf) return null;
  if (valueCache.items !== state.items || valueCache.priceOf !== state.priceOf) {
    valueCache = {
      items: state.items,
      priceOf: state.priceOf,
      value: OH.hangarValue(state.items, state.priceOf),
    };
  }
  return valueCache.value;
}
// OH.accountValue (everything you own: ships, CCUs, other pledges, Store Credit),
// memoised like hangarValue. Null until store prices load.
let acctCache = { v: null, credit: null, value: null };
function accountValue() {
  const v = hangarValue();
  if (!v) return null;
  if (acctCache.v !== v || acctCache.credit !== state.storeCredit) {
    acctCache = {
      v,
      credit: state.storeCredit,
      value: OH.accountValue(state.items, state.priceOf, state.storeCredit, v),
    };
  }
  return acctCache.value;
}
// Store-price info for one pledge ({ store, ships, unpriced, paid, below }) or null.
function storeInfo(p) {
  const v = hangarValue();
  return (v && v.pledges[p.id]) || null;
}

function formatValue(p) {
  if (!Number.isFinite(p.value)) return '';
  if (streamer.on) return MASK;
  if (!p.currency || p.currency === 'USD' || !/^[A-Z]{3}$/.test(p.currency)) return money(p.value);
  const s = '$' + p.value.toFixed(2);
  // Only append a real non-USD ISO-4217 code. Guards against RSI's junk currency
  // on $0 reward items (e.g. "TyCustomer_ledger_-en") in data scanned before the
  // parser fix; a re-scan also cleans it at the source.
  return /^[A-Z]{3}$/.test(p.currency) && p.currency !== 'USD' ? `${s} ${p.currency}` : s;
}

function presentKinds() {
  return OH.KINDS.filter((k) => state.items.some((p) => p.kind === k.key));
}

function plainName(p) {
  return p.isCCU && p.ccu ? `${p.ccu.from} → ${p.ccu.to}` : p.name || '—';
}

// Cards drop RSI's store-category prefix ("Standalone Ships - ", "Paints - ",
// "Gear - "…) — the kind badge already says it. The full name stays in the
// tooltip, the details popup, search and exports.
const CATEGORY_PREFIX_RE =
  /^(standalone ships?|paints?|gear|add-ons?|subscribers store|upgrades?)\s*[-–]\s*/i;
function cardName(p) {
  return plainName(p).replace(CATEGORY_PREFIX_RE, '');
}
// A pledge's items minus the ones its name already spells out ("ROC - Black
// Cherry Paint" inside "Paints - ROC - Black Cherry Paint"), so the card's
// items line only adds information.
const squashText = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function extraContents(p) {
  const name = squashText(p.name);
  return (p.contents || [])
    .map((c) => c.label || c.kind)
    .filter((l) => {
      const q = squashText(l);
      return q && !name.includes(q);
    });
}

// --- Routing --------------------------------------------------------------

function currentView() {
  const v = (location.hash || '#home').slice(1);
  return VIEWS.includes(v) ? v : 'home';
}

function route() {
  const v = currentView();
  document
    .querySelectorAll('.view')
    .forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  homeUpdated(); // the top bar (ui/topbar) marks this page in its nav
  if (v !== 'buybacks') state.bbOnly = null; // an alert's filter lasts for that one visit
  if (v === 'home') renderHome();
  else if (v === 'inventory') renderInventory();
  else if (v === 'stats') renderStats();
  else if (v === 'referrals') renderReferrals();
  else if (v === 'buybacks') renderBuybacks();
  else if (v === 'developers') renderProfiles();
  else if (v === 'org') renderOrg();
  else if (v === 'store') renderStore();
  else if (v === 'updates') renderUpdates();
  else if (v === 'issues') renderKnownIssues();
  // 'store' is static markup; About now lives on Home.
  updateSignedOutBanner(); // re-apply the cached signed-out banner state on this view
}

window.addEventListener('hashchange', route);

// --- Home -----------------------------------------------------------------

const DASH = '—'; // uniform placeholder for missing / logged-out dynamic data

// Concierge (Chairman's Club) tiers, low → high spend, coloured richer the higher
// you climb. Names from star-citizen.tools/Concierge.
const CONCIERGE_COLORS = {
  'high admiral': '#c0824f', // bronze
  'grand admiral': '#b6c2cf', // silver
  'space marshal': '#3fb6d8', // cyan
  'wing commander': '#9b7bff', // violet
  praetorian: '#e06aae', // rose
  'legatus navium': '#f0c040', // gold (top)
};

// Safely build a CSS background-image value from a URL: only accept http(s),
// and escape characters that could break out of the url("…") string.
function safeBgUrl(u) {
  if (!u || !/^https?:\/\//i.test(u)) return '';
  return `url("${u.replace(/["\\]/g, '\\$&')}")`;
}

// Format RSI's enlistedSince into a full, readable date ("Nov 23, 2014"); falls
// back to the raw value if it isn't a parseable date.
function fmtEnlisted(s) {
  if (!s) return DASH;
  const d = new Date(s);
  return isNaN(d.getTime())
    ? String(s)
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// RSI ships CCUs (and some items) with a generic "DEFAULT IMAGE" placeholder.
// Treat those (and missing URLs) as no-image so we can resolve the real ship art.
const DEFAULT_IMG_RE = /default[-_]?image|\/default\b/i;
// Older scans may hold RSI's relative "/media/..." paths: make them absolute.
function realImage(url) {
  if (!url || DEFAULT_IMG_RE.test(url)) return null;
  return url.startsWith('/') && !url.startsWith('//')
    ? 'https://robertsspaceindustries.com' + url
    : url;
}

// One right-sized picture per card, never a swap (#179): RSI's store_small (351 px)
// plus the same picture's slideshow size (648 px), so the browser downloads only the
// one the screen needs (a 2x screen gets the sharp one). Only for URLs in RSI's
// store_small form (both of RSI's URL shapes); anything else keeps its one src.
// The size hints are the cards' rough widths; "auto" (lazy images) measures exactly.
const CARD_SIZES = { gallery: '220px', compact: '160px', list: '110px' };
function srcsetFor(url) {
  if (!url) return '';
  let big = null;
  if (/^https:\/\/media\.robertsspaceindustries\.com\/[^/]+\/store_small\.\w+(\?.*)?$/.test(url)) {
    big = url.replace('/store_small.', '/slideshow.');
  } else if (
    /^https:\/\/robertsspaceindustries\.com\/media\/[^/]+\/store_small\/[^/?]+(\?.*)?$/.test(url)
  ) {
    big = url.replace('/store_small/', '/slideshow/');
  }
  return big ? `${url} 351w, ${big} 648w` : '';
}
// A card <img>'s sizes for a layout (the Svelte lists' Thumb, ui/lib/Thumb.svelte).
const cardSizes = (layout) => `auto, ${CARD_SIZES[layout] || CARD_SIZES.gallery}`;

// After a scan, fetch the first screenful of pictures for Inventory and Buy-Backs
// in the background, at low priority and at the size the cards will ask for, so
// the first visit shows them at once (#179). Missing art is looked up too (those
// answers are cached). The scan itself never waits for this.
const WARM_CARDS = 24;
function warmPictures(list, layout) {
  for (const x of list.slice(0, WARM_CARDS)) {
    const url = x.ccu && x.ccu.to && !x.shipArt ? null : realImage(x.image);
    if (!url) {
      const name = x.ccu && x.ccu.to ? x.ccu.to : resolveImageName(x);
      if (name) OH.getShipImage(name).catch(() => {});
      continue;
    }
    const im = new Image();
    im.fetchPriority = 'low';
    im.decoding = 'async';
    const set = srcsetFor(url);
    if (set) {
      im.sizes = CARD_SIZES[layout] || CARD_SIZES.gallery; // no "auto" off-screen
      im.srcset = set;
    }
    im.src = url;
  }
}

// The ship name to look an image up by: a CCU's target ship, else a ship's own
// name. Add-ons/coupons return '' (don't fetch art for non-ships).
function resolveImageName(p) {
  if (p.isCCU && p.ccu && p.ccu.to) return p.ccu.to;
  if (!(p.kind === 'ship' || p.containsShip)) return '';
  const name = p.name || '';
  // "Package - Aurora MR Starter Pack" isn't a ship name: use the first ship inside
  // (a pledge's contents list, or a buy-back's "Aurora MR · Star Citizen…" line).
  if (/^(package|packs?|bundles?)\s*-|\b(pack|starter|bundle)\b/i.test(name)) {
    const ship = (p.contents || []).find((c) => /ship|vehicle/i.test(c.kind || '') && c.label);
    if (ship) return ship.label;
    const first = String(p.contains || '')
      .split('·')[0]
      .trim();
    if (first && !/digital download|insurance|game package/i.test(first)) return first;
  }
  return name;
}

// Home's Citizen Card and first-run welcome are Svelte (ui/home/CitizenCard.svelte,
// SignedOut.svelte, Welcome.svelte). They read `homeCard` through window.OHApp and
// redraw on 'oh:home'.
const homeCard = {
  account: null, // the last OH.getAccount() result, null until it's read
  welcomeReady: false, // the welcome card waits for the first route() after loading
  scan: { text: '', pct: 0 }, // the first scan's progress, shown on the welcome card
};

// Home's welcome screen: shown until the first scan. Signed out, the card above
// already has the Log In button, so it just says to use it (lastLoggedOut is set
// when the account is read).
function renderWelcome() {
  homeCard.welcomeReady = true;
  homeUpdated();
}

// RSI account → the home Citizen Card (drawn by ui/home/CitizenCard.svelte) and the
// top bar's portrait, name and Log Out (ui/topbar), which read homeCard.account; plus
// the signed-out banner and Store Credit.
function renderAccount() {
  OH.getAccount().then((a) => {
    // Signed out → the card shows the centred "Log In to RSI" wall instead.
    // Anything but a confirmed login (false = logged out, null = couldn't tell)
    // counts as signed out: there's no live account data either way.
    const loggedOut = a.loggedIn !== true;
    // The top bar's portrait, name and Log Out read it too (ui/topbar).
    homeCard.account = a;

    updateSignedOutBanner(loggedOut);
    renderWelcome();

    // Store Credit counts toward Account Value.
    const c = a.credits || {};
    const store = c.store ? c.store.value / 100 : null;
    if (store !== state.storeCredit) state.storeCredit = store;
    homeUpdated();
  });
}

// Global "signed out, showing cached scan" banner. Shows on EVERY view when the
// user isn't confirmed-logged-in AND there's locally scanned data still displayed
// (hangar, buy-backs, or referrals). When logged out with no data at all, the
// normal empty-state prompts handle it, so we don't show the banner. This is the
// single place that enforces the "scanned data persists, but labelled as cached"
// rule across all current and future views.
// `lastLoggedOut` caches the most recent known login state so route() can re-apply
// the banner on view switches without re-fetching the account each time.
let lastLoggedOut = false;
function updateSignedOutBanner(loggedOut) {
  if (typeof loggedOut === 'boolean') lastLoggedOut = loggedOut;
  const el = $('#signedout-banner');
  if (!el) return;
  const hasData = state.items.length > 0 || state.buybacks.length > 0 || state.referral != null;
  el.hidden = !(lastLoggedOut && hasData);
}

// Saved data that failed its check on load was set aside (OH.getDamaged): say so
// until dismissed, with a way back (restore a backup file) and a copy of the
// original for a bug report.
async function renderDbNotice() {
  const el = $('#db-notice');
  if (!el) return;
  const damaged = await OH.getDamaged();
  el.hidden = !damaged.some((d) => !d.seen);
}
$('#db-restore')?.addEventListener('click', () => $('#import-file')?.click());
$('#db-save-damaged')?.addEventListener('click', async () => {
  const copies = await OH.exportDamaged();
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([JSON.stringify({ app: 'open-hangar', damaged: copies }, null, 2)], {
      type: 'application/json',
    }),
    `open-hangar-damaged-${date}.json`,
  );
});
$('#db-dismiss')?.addEventListener('click', async () => {
  await OH.dismissDamaged();
  renderDbNotice();
});

// Notice from our status file (the kill switch, see OH.getRemoteStatus). Text
// only, never HTML: it comes from the network.
async function renderSiteNotice() {
  const el = $('#site-notice');
  if (!el) return;
  const { banner } = await OH.getRemoteStatus();
  el.textContent = banner ? banner.message : '';
  el.classList.toggle('info', banner?.level === 'info');
  el.hidden = !banner;
}

function renderVersions() {
  const el = $('#versions');
  if (!el) return;
  const ext = chrome.runtime.getManifest().version;
  // Open Hangar → GitHub releases (once the repo URL is set), else plain text.
  const oh = REPO_URL
    ? `<a href="${REPO_URL}/releases" target="_blank" rel="noopener">Open Hangar v${ext}</a>`
    : `Open Hangar v${ext}`;
  const news = '<a href="#updates" data-view="updates">What’s New</a>';
  setHTML(el, `${oh} · ${news} · Star Citizen …`);
  OH.getScVersion().then((v) => {
    let sc = 'Star Citizen n/a';
    if (v.code) {
      const label = OH.escapeHtml(OH.formatScVersion(v.code)); // e.g. "4.8.0-LIVE"
      const semver = (v.code.match(/(\d+\.\d+(?:\.\d+)?)/) || [])[1]; // e.g. "4.8.0"
      sc = semver
        ? `<a href="https://starcitizen.tools/Star_Citizen_Alpha_${semver}" target="_blank" rel="noopener">Star Citizen ${label}</a>`
        : `Star Citizen ${label}`;
    }
    setHTML(el, `${oh} · ${news} · ${sc}`);
  });
}

// --- Wishlist entries and the store catalog -----------------------------------
// The wishlist (`state.wishlist`, kept in this browser) holds ships by name, as it
// always has, and anything else from the store catalog as an object:
//   { id: 'sku-123' | 'upgrade-7', kind: 'pack'|'paint'|'gear'|'addon'|'ccu', name,
//     from?, to?, fromMsrp?, price?, img? }   (a CCU starts from `from`)
// Whether each is in the store comes from openhangar.space's catalog feed
// (OH.getStoreCatalog: one download for the whole store), matched here on your
// machine. Nothing about the wishlist is ever sent anywhere.
const WISH_ITEM_KINDS = ['pack', 'paint', 'gear', 'addon', 'ccu'];
const isWishItem = (e) =>
  !!e &&
  typeof e === 'object' &&
  typeof e.id === 'string' &&
  /^(sku|upgrade)-\d+$/.test(e.id) &&
  typeof e.name === 'string' &&
  !!e.name.trim() &&
  WISH_ITEM_KINDS.includes(e.kind) &&
  (e.kind !== 'ccu' || (typeof e.from === 'string' && !!e.from.trim()));
// One key per entry: the ship's name, the item's id (a CCU's with where it starts).
const wishKey = (e) => (typeof e === 'string' ? e : e.kind === 'ccu' ? `${e.id}|${e.from}` : e.id);
const wishTitle = (e) => (typeof e === 'string' ? (shipEntry(e) || {}).name || e : e.name);
const wishShips = () => state.wishlist.filter((e) => typeof e === 'string');

// The catalog, kept in memory once read: { at, items, ships, byId, readAt }.
let catalog = null;
let catalogAsked = 0;
let catalogLoading = null;
const CATALOG_RECHECK_MS = 30 * 60e3;
function ensureCatalog({ force = false } = {}) {
  if (catalogLoading) return catalogLoading;
  if (!force && catalogAsked && Date.now() - catalogAsked < CATALOG_RECHECK_MS)
    return Promise.resolve(catalog);
  catalogAsked = Date.now();
  catalogLoading = OH.getStoreCatalog({ force })
    .then((feed) => {
      if (feed && feed.data) catalog = { ...OH.shapeCatalog(feed.data), readAt: feed.at };
      return catalog;
    })
    .catch(() => catalog)
    .finally(() => {
      catalogLoading = null;
      homeUpdated();
    });
  return catalogLoading;
}
// A special edition ("600i 2951 BIS") is a different store item from the plain ship.
const sameStoreShip = (a, b) => sameShip(a, b) && specialEdition(a) === specialEdition(b);
// One entry against the catalog: { status, price, warbond, url, img } (lib.js).
function wishStatus(e) {
  return OH.catalogWishStatus(catalog, e, {
    sameShip: sameStoreShip,
    msrpOf: (name) => (shipEntry(name) || {}).msrp || null,
  });
}

// --- Home: Wishlist Watch --------------------------------------------------------
// The last wishlist check, kept until the next one, so Home can say "Checked 2 days
// ago". Only Check Now and Scan → Store check (one catalog request); nothing runs by
// itself. Saved as { at, items: { [wishKey]: { status, price, warbond, url, img } } }.
let wishWatch = null;
let wishChecking = false;
function saveWishWatch() {
  if (!catalog) return; // never read: keep the last check
  const items = {};
  for (const e of state.wishlist) {
    const st = wishStatus(e);
    items[wishKey(e)] = {
      status: st.status,
      price: Number.isFinite(st.price) ? st.price : null,
      warbond: Number.isFinite(st.warbond) ? st.warbond : null,
      url: st.url || null,
      img: st.img || null,
    };
  }
  wishWatch = { at: catalog.readAt || Date.now(), items };
  chrome.storage.local.set({ wishWatch });
}
// Ask the catalog again (with its ETag) and save what it says about the wishlist.
// → how many are in the store, or null when the catalog has never loaded.
async function checkWishlistNow() {
  await ensureCatalog({ force: true });
  if (!catalog) return null;
  saveWishWatch();
  return wishWatchRows().filter((r) => r.status === 'in').length;
}
async function checkWishlist() {
  if (wishChecking || !state.wishlist.length) return;
  wishChecking = true;
  homeUpdated();
  try {
    await checkWishlistNow();
  } finally {
    wishChecking = false;
    homeUpdated();
  }
}
// The card's rows, in your wishlist order (generic items: ui/lib/wish-watch.js).
function wishWatchRows() {
  const saved = (wishWatch && wishWatch.items) || {};
  return wishlistOrder().map((e) => {
    const got = saved[wishKey(e)] || null;
    const ship = typeof e === 'string';
    const v = ship ? shipEntry(e) : null;
    return {
      kind: ship ? 'ship' : e.kind,
      name: wishTitle(e),
      from: ship ? '' : e.from || '',
      to: ship ? '' : e.to || '',
      lookup: ship ? e : e.kind === 'ccu' ? e.to : e.name,
      key: wishKey(e),
      price: got ? got.price : ship ? (v && v.msrp) || null : e.price || null,
      warbond: got ? got.warbond : null,
      status: got ? got.status : 'unknown',
      url: got ? got.url : null,
      img: (got && got.img) || (!ship && e.img) || '',
    };
  });
}
function renderHome() {
  ensurePrices();
  renderEventBanner();
  renderAccount();
  const has = state.items.length > 0;
  document.getElementById('view-home').classList.toggle('no-data', !has);
  // Everything below the Citizen Card is the Svelte Home (ui/home); tell it to redraw.
  homeUpdated();

  // First run: the welcome screen instead of empty cards (when you last scanned
  // shows on Account Value once there's data).
  renderWelcome();
}

function link(url, label, soon) {
  return url
    ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
    : `<span class="muted">${label} (soon)</span>`;
}

function renderFooter() {
  const gh = link(REPO_URL, 'GitHub');
  const dc = link(DISCORD_URL, 'Discord');
  const ideas = link(IDEAS_URL, 'Suggest a Feature');
  // The versions line (Open Hangar vX · What's new · Star Citizen X) lives here,
  // not on the Citizen Card: it's reference info, not about your character.
  setHTML(
    $('#footer'),
    `${gh} · ${dc} · ${ideas} · Source Available · <span id="versions"></span>`,
  );
  renderVersions();
}

// --- Inventory (fleet gallery) -------------------------------------------

function haystack(p) {
  const parts = [p.name];
  if (p.ccu) parts.push(p.ccu.from, p.ccu.to);
  for (const c of p.contents || []) parts.push(c.label, c.kind);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function cmpValue(a, b, dir) {
  const an = !Number.isFinite(a.value);
  const bn = !Number.isFinite(b.value);
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  return dir * (a.value - b.value);
}

function computeShown() {
  const q = state.query.trim().toLowerCase();
  // Filter chips are an INCLUDE selection: an empty set means "show everything"
  // (the default), and picking kinds narrows to just those.
  let list = state.shown.size
    ? state.items.filter((p) => state.shown.has(p.kind))
    : state.items.slice();
  // "Hide small stuff" tucks paints, add-ons and coupons away (unless picked).
  if (state.hideSmall)
    list = list.filter((p) => !SMALL_KINDS.has(p.kind) || state.shown.has(p.kind));
  // The sidebar's groups narrow further (see INV_GROUPS).
  list = applyInvFilters(list);
  if (q) list = list.filter((p) => haystack(p).includes(q));
  if (state.sort !== 'default') {
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    // ISO dates compare as strings; undated pledges (older scans) sink to the end.
    const byDate = (a, b, dir) => {
      if (!a.date || !b.date) return (a.date ? 0 : 1) - (b.date ? 0 : 1);
      return a.date === b.date ? 0 : (a.date < b.date ? -1 : 1) * dir;
    };
    list = list.slice().sort((a, b) => {
      switch (state.sort) {
        case 'date-desc':
          return byDate(a, b, -1);
        case 'date-asc':
          return byDate(a, b, 1);
        case 'value-desc':
          return cmpValue(a, b, -1);
        case 'value-asc':
          return cmpValue(a, b, 1);
        case 'store-desc':
          return (storeInfo(b)?.store ?? -1) - (storeInfo(a)?.store ?? -1);
        case 'name-asc':
          return byName(a, b);
        case 'name-desc':
          return byName(b, a);
        default:
          return 0;
      }
    });
  }
  return list;
}

// Trait filters cut ACROSS kinds (a multi-ship pack is still a "ship" pledge),
// so they're a second, AND-combined selection: Ships + LTI + Giftable = LTI ships
// you can gift. Only traits some pledge actually has are shown.
const GAME_ITEM_RE = /\b(star citizen|squadron 42)\b.*\b(digital|download|game|package)\b/i;

// Traits read a common "facets" view so the same filters work on hangar pledges
// (tagged items) and buy-backs (one free-text "Items" line, e.g.
// "Cutlass Black · Lifetime Insurance"). null = not known for that source.
function pledgeFacets(p) {
  return {
    name: p.name || '',
    items: p.contents || [],
    lti: p.insurance === 'LTI',
    giftable: p.giftable === true,
    meltable: p.meltable === undefined ? null : p.meltable === true,
    value: Number.isFinite(p.value) ? p.value : null,
    below: storeInfo(p) ? storeInfo(p).below : null,
  };
}
function buybackFacets(b) {
  const labels = String(b.contains || '')
    .split(/\s*[·•|;]\s*|\s*,\s+(?=[A-Z0-9])/)
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    name: b.name || '',
    items: labels.map((label) => ({ kind: '', label })),
    lti: labels.some((l) => /lifetime insurance|\bLTI\b/i.test(l)),
    giftable: null,
    meltable: null,
    value: null,
    below: null,
  };
}
const notInsurance = (c) => !/insurance/i.test(`${c.kind || ''} ${c.label || ''}`);

// Trait filters cut ACROSS kinds (a pack is still a "ship" pledge), so they're a
// second, AND-combined row under the kind chips: Ships + LTI + Giftable = LTI
// ships you can gift. A trait only shows if some item in that view has it.
const TRAITS = [
  {
    key: 'package',
    label: 'Game Packages',
    title: 'Pledges that include game access (Star Citizen / Squadron 42)',
    notLabel: 'No Game Package',
    test: (f) =>
      /^package\b/i.test(f.name) ||
      f.items.some((c) => /^game$/i.test(c.kind || '') || GAME_ITEM_RE.test(c.label || '')),
  },
  {
    // Most packs bundle a ship with paints and gear (e.g. Nine Tails Shogun Pack:
    // 1 vehicle + 1 paint + 8 gear items), so count every item, not just ships.
    key: 'pack',
    label: 'Packs',
    title: 'Pledges named "Pack", or that bundle two or more items (ships, paints, gear…)',
    notLabel: 'Single Items',
    // Owner's rules: "Pack" in the name makes it a pack, even with one item listed;
    // anything with game access is a Package (the chip above), never a Pack.
    test: (f) =>
      !TRAITS[0].test(f) &&
      (/\bpacks?\b/i.test(f.name) || f.items.filter(notInsurance).length >= 2),
  },
  { key: 'lti', label: 'LTI', notLabel: 'No LTI', title: 'Lifetime insurance', test: (f) => f.lti },
  {
    key: 'giftable',
    label: 'Giftable',
    title: 'RSI shows a Gift action for this pledge',
    notLabel: 'Not Giftable',
    test: (f) => f.giftable === true,
    neg: (f) => f.giftable === false,
  },
  {
    key: 'meltable',
    label: 'Meltable',
    title: 'RSI shows an Exchange action, so it can be melted for store credit',
    notLabel: 'Not Meltable',
    test: (f) => f.meltable === true,
    neg: (f) => f.meltable === false,
  },
  {
    key: 'warbond',
    label: 'Warbond',
    // RSI's hangar has no warbond marker, so this relies on the pledge name — some
    // warbond purchases (e.g. packs) aren't named that way and won't show here.
    title: "Pledges whose name says Warbond (RSI doesn't always include it)",
    notLabel: 'Not Warbond',
    test: (f) => /warbond/i.test(f.name),
  },
  {
    // Catches warbonds and sales that aren't named that way (see TODO.md).
    key: 'below',
    label: 'Below Store Price',
    title:
      "Paid less than today's store price: warbonds, sales, older cheaper pricing. Ship pledges and CCUs.",
    notLabel: 'At / Above Store Price',
    test: (f) => f.below === true,
    neg: (f) => f.below === false,
  },
  {
    key: 'free',
    label: 'Free / Rewards',
    title: '$0 pledges: referral, event and other rewards',
    notLabel: 'Paid Pledges',
    test: (f) => f.value === 0,
    neg: (f) => f.value != null && f.value > 0,
  },
];

// --- Inventory filters (Filters Pass, B2) -------------------------------------
// The sidebar's groups (ui/inventory). Inside a group any picked option matches;
// across groups every group with picks must match, so "MISC + Meltable" is a
// meltable MISC ship. state.traits holds the picks (group key → Set of option
// keys) and state.meltMax caps melt value. computeShown() applies both, so the
// list, the summary, Select All and the exports all follow the same filters.
// Ships in a pledge (a CCU: the ship it upgrades to), as ship-list entries.
function pledgeShips(p) {
  if (!state.shipOf) return [];
  const names =
    p.isCCU && p.ccu
      ? [p.ccu.to]
      : (p.contents || []).filter((c) => /^ship$/i.test(c.kind || '')).map((c) => c.label);
  return names.map((n) => state.shipOf(n)).filter(Boolean);
}
// Where a pledge came from: a game package, a $0 reward, a pack, or on its own.
function cameFrom(p) {
  const f = pledgeFacets(p);
  if (TRAITS[0].test(f)) return 'package';
  if (f.value === 0) return 'reward';
  if (TRAITS[1].test(f)) return 'pack';
  return 'standalone';
}
const SIZE_ORDER = ['vehicle', 'snub', 'small', 'medium', 'large', 'capital'];
const insMonths = (l) => (l === 'LTI' ? 1e6 : parseInt(l, 10) || 0);
const INV_GROUPS = [
  {
    key: 'ins',
    title: 'Insurance',
    of: (p) => (p.insurance ? [insLabel(p.insurance)] : []),
    order: (a, b) => insMonths(b) - insMonths(a),
  },
  {
    key: 'status',
    title: 'Status',
    fixed: [
      ['meltable', 'Meltable', (p) => p.meltable === true],
      ['notMeltable', 'Not Meltable', (p) => p.meltable === false],
      ['giftable', 'Giftable', (p) => p.giftable === true],
      ['notGiftable', 'Not Giftable', (p) => p.giftable === false],
    ],
  },
  {
    key: 'deals',
    title: 'Deals',
    fixed: [
      ['below', 'Below Store Price', (p) => storeInfo(p)?.below === true],
      ['warbond', 'Warbond', (p) => /warbond/i.test(p.name || '')],
      ['free', 'Rewards ($0)', (p) => p.value === 0],
    ],
  },
  {
    key: 'from',
    title: 'Came From',
    fixed: [
      ['standalone', 'Standalone'],
      ['pack', 'Pack'],
      ['package', 'Package'],
      ['reward', 'Reward'],
    ].map(([k, l]) => [k, l, (p) => cameFrom(p) === k]),
  },
  {
    key: 'mfr',
    title: 'Manufacturer',
    search: true,
    of: (p) => pledgeShips(p).map((v) => v.mfr),
    order: (a, b) => a.localeCompare(b),
  },
  {
    key: 'size',
    title: 'Size',
    of: (p) => pledgeShips(p).map((v) => v.size && titleCase(v.size)),
    order: (a, b) => SIZE_ORDER.indexOf(a.toLowerCase()) - SIZE_ORDER.indexOf(b.toLowerCase()),
  },
];
// Shared by Inventory and Buy-Backs (ui/lib/FilterSidebar.svelte): `groups` is a
// page's group list, `picks` its Map of group key → Set of picked option keys.
function groupOptionTest(g, key) {
  if (g.fixed) return (g.fixed.find(([k]) => k === key) || [])[2] || (() => false);
  return (x) => g.of(x).includes(key);
}
function applyGroups(list, groups, picks) {
  for (const g of groups) {
    const sel = picks.get(g.key);
    if (!(sel instanceof Set) || !sel.size) continue;
    const tests = [...sel].map((k) => groupOptionTest(g, k));
    list = list.filter((x) => tests.some((t) => t(x)));
  }
  return list;
}
// Everything a sidebar draws: type pills, each group's options with how many items
// have them (an option nobody has is left out unless it's picked), the range at the
// bottom (`cap`: { title, value, of(item) → number }), and the active filters as
// pills (the range's pill is group 'cap').
function filterView({ items, kinds, shown, groups, picks, cap }) {
  const types = kinds.map((k) => ({
    key: k.key,
    label: k.label,
    n: items.filter((x) => x.kind === k.key).length,
    on: shown.has(k.key),
  }));
  const view = groups
    .map((g) => {
      const sel = picks.get(g.key);
      const picked = sel instanceof Set ? sel : new Set();
      let opts;
      if (g.fixed)
        opts = g.fixed.map(([k, label, test]) => ({ key: k, label, n: items.filter(test).length }));
      else {
        const counts = new Map();
        for (const x of items)
          for (const k of new Set(g.of(x).filter(Boolean))) counts.set(k, (counts.get(k) || 0) + 1);
        for (const k of picked) if (!counts.has(k)) counts.set(k, 0);
        opts = [...counts.keys()]
          .sort(g.order)
          .map((k) => ({ key: k, label: k, n: counts.get(k) }));
      }
      const options = opts
        .filter((o) => o.n || picked.has(o.key))
        .map((o) => ({ ...o, on: picked.has(o.key) }));
      return { key: g.key, title: g.title, search: !!g.search, picked: picked.size, options };
    })
    .filter((g) => g.options.length);
  const values = items.map(cap.of).filter(Number.isFinite);
  const top = values.length ? Math.max(5, Math.ceil(Math.max(...values) / 5) * 5) : 0;
  const active = [
    ...types
      .filter((t) => t.on)
      .map((t) => ({ group: 'type', key: t.key, label: t.label, title: 'Type' })),
    ...view.flatMap((g) =>
      g.options
        .filter((o) => o.on)
        .map((o) => ({ group: g.key, key: o.key, label: o.label, title: g.title })),
    ),
  ];
  if (cap.value != null)
    active.push({
      group: 'cap',
      key: '',
      label: `Up to ${dollars(cap.value)}`,
      title: cap.pill,
    });
  return { types, groups: view, range: { title: cap.title, top, value: cap.value }, active };
}
function applyInvFilters(list) {
  list = applyGroups(list, INV_GROUPS, state.traits);
  if (state.meltMax != null)
    list = list.filter((p) => Number.isFinite(p.value) && p.value <= state.meltMax);
  return list;
}
// Inventory's sidebar.
function invFilters() {
  return {
    ...filterView({
      items: state.items,
      kinds: presentKinds(),
      shown: state.shown,
      groups: INV_GROUPS,
      picks: state.traits,
      cap: {
        title: 'Melt Value',
        pill: 'Melt',
        value: state.meltMax,
        of: (p) => p.value,
      },
    }),
    switches: [
      {
        key: 'inv-hide',
        label: 'Hide Small Stuff',
        on: state.hideSmall,
        title: 'Paints, add-ons and coupons',
      },
    ],
    closed: [...state.invClosed],
    folded: state.invFolded,
  };
}
// Buy-Backs' sidebar. Like Inventory's, minus what RSI doesn't say about a
// buy-back (giftable, meltable); its range caps the buy-back price.
// Ships a buy-back gives back: a CCU's target, a pack's ships once Load Details has
// read its page, else the ship its name points at.
function buybackShips(b) {
  if (!state.shipOf) return [];
  const d = bbDetail(b);
  const names = b.ccu
    ? [b.ccu.to]
    : d && Array.isArray(d.ships) && d.ships.length
      ? d.ships.map((x) => x.name)
      : [resolveImageName(b)];
  return names.map((n) => n && state.shipOf(n)).filter(Boolean);
}
// The insurance RSI's buy-back list spells out in a buy-back's contents line
// ("Cutter · Lifetime Insurance", "120 Month Insurance"), in the short form
// insLabel() reads ("LTI", "120M"), or ''.
function insuranceFromContains(text) {
  const t = String(text || '');
  if (/lifetime insurance|\bLTI\b/i.test(t)) return 'LTI';
  const m = t.match(/(\d+)[\s-]*(month|year)s?\s+insurance/i);
  return m ? `${m[1]}${/^y/i.test(m[2]) ? 'Y' : 'M'}` : '';
}
const BB_GROUPS = [
  {
    key: 'ins',
    title: 'Insurance',
    of: (b) => {
      const d = bbDetail(b);
      const t =
        (d && d.insurance) ||
        b.insurance ||
        window.OpenHangar.insuranceFromName(b.name) ||
        insuranceFromContains(b.contains);
      return t ? [insLabel(t)] : [];
    },
    order: (a, b) => insMonths(b) - insMonths(a),
  },
  {
    key: 'deals',
    title: 'Deals',
    fixed: [['below', 'Below Store Price', (b) => bbUnderStore(b)]],
  },
  {
    key: 'from',
    title: 'Came From',
    fixed: [
      ['standalone', 'Standalone'],
      ['pack', 'Pack'],
      ['package', 'Package'],
    ].map(([k, l]) => [
      k,
      l,
      (b) => {
        const f = buybackFacets(b);
        const from = TRAITS[0].test(f) ? 'package' : TRAITS[1].test(f) ? 'pack' : 'standalone';
        return from === k;
      },
    ]),
  },
  {
    key: 'mfr',
    title: 'Manufacturer',
    search: true,
    of: (b) => buybackShips(b).map((v) => v.mfr),
    order: (a, b) => a.localeCompare(b),
  },
  {
    key: 'size',
    title: 'Size',
    of: (b) => buybackShips(b).map((v) => v.size && titleCase(v.size)),
    order: (a, b) => SIZE_ORDER.indexOf(a.toLowerCase()) - SIZE_ORDER.indexOf(b.toLowerCase()),
  },
];
function bbFilters() {
  return {
    ...filterView({
      items: state.buybacks,
      kinds: presentBbKinds(),
      shown: state.bbShown,
      groups: BB_GROUPS,
      picks: state.bbTraits,
      cap: { title: 'Price', pill: 'Price', value: state.bbPriceMax, of: (b) => bbPrice(b) },
    }),
    switches: [
      {
        key: 'bb-hide',
        label: 'Hide Small Stuff',
        on: state.bbHideSmall,
        title: 'Paints, add-ons and coupons',
      },
      {
        key: 'bb-stack',
        label: 'Stack Identical',
        on: state.bbStack,
        title: 'Show identical buy-backs as one row with a count',
      },
    ],
    closed: [...state.bbClosed],
    folded: state.bbFolded,
  };
}
function resetInvFilters() {
  state.shown = new Set();
  state.traits = new Map();
  state.meltMax = null;
}
// Saved views from before the sidebar stored traits as [key, 'yes' | 'no']: read
// them as the matching sidebar options (anything with no match is dropped).
const OLD_TRAITS = {
  'lti:yes': ['ins', 'LTI'],
  'giftable:yes': ['status', 'giftable'],
  'giftable:no': ['status', 'notGiftable'],
  'meltable:yes': ['status', 'meltable'],
  'meltable:no': ['status', 'notMeltable'],
  'warbond:yes': ['deals', 'warbond'],
  'below:yes': ['deals', 'below'],
  'free:yes': ['deals', 'free'],
  'package:yes': ['from', 'package'],
  'pack:yes': ['from', 'pack'],
};
function invTraitsFrom(entries) {
  const map = new Map();
  for (const [g, v] of entries || []) {
    const pairs = Array.isArray(v)
      ? v.map((k) => [g, k])
      : OLD_TRAITS[`${g}:${v}`]
        ? [OLD_TRAITS[`${g}:${v}`]]
        : [];
    for (const [gg, k] of pairs) {
      if (!map.has(gg)) map.set(gg, new Set());
      map.get(gg).add(k);
    }
  }
  return map;
}

// M / G tags on a card: green = RSI says yes, red = no, grey = unknown (scans
// made before meltability was read). Colour isn't the only signal: the
// tooltip and aria-label spell it out.
function cardFlag(letter, value, yes, no) {
  return {
    letter,
    state: value === true ? 'yes' : value === false ? 'no' : 'unk',
    label: value === true ? yes : value === false ? no : `${yes}: unknown (rescan)`,
    word: value == null ? `${yes}?` : yes, // red / green carries the yes or no
  };
}

// Card data is read for every card (up to thousands) on each redraw, so each card's
// is kept until something it depends on changes: the item's picture, store prices,
// the currency, Streamer Mode, buy-back details. Same data back = no redraw.
const cardMemo = new WeakMap(); // item → { deps, data }
function memoCard(x, deps, make) {
  const hit = cardMemo.get(x);
  if (hit && hit.deps.every((d, i) => d === deps[i])) return hit.data;
  const data = make(x);
  cardMemo.set(x, { deps, data });
  return data;
}
const pledgeCard = (p) =>
  memoCard(p, [hangarValue(), fx.code, fx.rate, streamer.on, p.image, p.shipArt], pledgeCardData);

// What an Inventory card shows (drawn by ui/lib/Card.svelte). A CCU shows the ship
// it upgrades to (looked up by the card's picture); RSI's own art for it is a
// generic upgrade picture, kept only as the fallback (rsiImage).
function pledgeCardData(p) {
  const contents = extraContents(p);
  const ccuArt = p.isCCU && p.ccu && p.ccu.to && !p.shipArt;
  const type = pledgeType(p);
  const si = storeInfo(p);
  const tail = si && si.unpriced ? ` (+${si.unpriced} unpriced)` : '';
  return {
    id: String(p.id || ''),
    image: (ccuArt ? null : realImage(p.image)) || '',
    // Ship name for art lookup: used when RSI gives no image, and as a fallback if
    // RSI's image link turns out to be broken.
    resolve: resolveImageName(p),
    rsiImage: (ccuArt && realImage(p.image)) || '',
    kind: p.kind || '',
    ccu: p.isCCU && p.ccu ? { from: p.ccu.from, to: p.ccu.to } : null,
    name: cardName(p),
    title: plainName(p),
    // The contents cell is always drawn (empty when there's nothing) so the List
    // view's fixed column grid stays aligned; Gallery/Compact hide empties via CSS.
    contents:
      !p.isCCU && contents.length
        ? contents.slice(0, 4).join(' · ') + (contents.length > 4 ? ` +${contents.length - 4}` : '')
        : '',
    ins: insLabel(p.insurance),
    type,
    badge: TYPE_KEYS.includes(type) ? type : '',
    flags: [
      cardFlag('M', p.meltable, 'Meltable', 'Not Meltable'),
      cardFlag('G', p.giftable, 'Giftable', 'Not Giftable'),
    ],
    val: formatValue(p),
    // Hover text on the price: what the ships in it sell for today.
    valTitle: si && si.store ? `Ships at today's store price: ${dollars(si.store)}${tail}` : '',
    under: underStoreText(p),
  };
}

// --- Market (sale-sheet) view --------------------------------------------
// A per-category table — Items Name · Insurance · Melt Price · My Price · Stock
// — the layout grey-market sellers screenshot as a store listing. Everything
// but My Price comes from the scan: identical pledges are STACKED into one row
// and Stock is how many you own. My Price is the only seller annotation, stored
// locally (state.market) and keyed by item — never exported or sent anywhere.
// There's no "Sold" control: a re-scan drops items you no longer hold, so the
// scan itself is the source of truth for what's still for sale.

// Identity key for an item — what makes two pledges "the same" for stacking and
// for attaching a price. Keyed by display name + melt value (not RSI's per-copy
// pledge id, which differs between duplicates), so copies merge and a saved
// price survives re-scans where individual pledge ids churn.
function marketKey(p) {
  const v = Number.isFinite(p.value) ? p.value : '';
  return `${plainName(p).trim().toLowerCase()}|${v}`;
}

// Persist the price map. Debounced so typing in a field doesn't hammer storage.
let marketSaveTimer = null;
function saveMarket() {
  clearTimeout(marketSaveTimer);
  marketSaveTimer = setTimeout(() => {
    chrome.storage.local.set({ marketAnnotations: state.market });
  }, 300);
}

// Set this item's price, dropping the entry when cleared so the map stays tidy.
function setMarketPrice(key, value) {
  if (value === '' || value == null) delete state.market[key];
  else state.market[key] = { price: value };
  saveMarket();
}

// "$1,250" / "310.5" → 1250 / 310.5, or null.
function priceNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
// My price as a % of melt value, rounded (e.g. 55), or ''.
function pctOfMelt(price, melt) {
  const n = priceNumber(price);
  return n != null && melt > 0 ? String(Math.round((n / melt) * 1000) / 10) : '';
}
// Price at pct% of melt, to the cent without trailing zeros (170.5, 171).
function priceAtPct(pct, melt) {
  const n = priceNumber(pct);
  return n != null && melt > 0 ? String(Math.round(melt * n) / 100) : '';
}

// Insurance for display: the parser stores short terms (LTI / 6M / 120M / 5Y);
// people read "120 Months". Unknown phrasing passes through as RSI wrote it.
function insLabel(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d+)\s*([MY])$/i);
  if (!m) return String(t);
  // Older scans stored years ("10Y"): show them in months too ("120 Months").
  const n = Number(m[1]) * (/y/i.test(m[2]) ? 12 : 1);
  return `${n} Month${n === 1 ? '' : 's'}`;
}
// Today's standard store price for what's in the pledge (ships' prices, or a
// CCU's price gap), from the ship list. '' when unknown.
function marketStore(p) {
  const si = storeInfo(p);
  return si && si.store ? dollars(si.store) : '';
}
function marketInsurance(p) {
  return insLabel(p.insurance) || '----';
}

// A pledge is meltable when RSI offers to melt it (the hangar's "Exchange"
// action → p.meltable) AND it has a real store-credit value (> $0). Older scans
// predate p.meltable, so there the value alone decides. Non-meltable items
// (rewards, $0 reward gear, pledges RSI won't exchange) have no resale floor and
// are hidden from the Market view entirely.
function isMeltable(p) {
  return p.meltable !== false && Number.isFinite(p.value) && p.value > 0;
}

// Melt Price for the row. Non-meltable pledges are filtered out before render, so
// this is effectively always a price; the fallback is just defensive.
function meltLabel(p) {
  return isMeltable(p) ? formatValue(p) : 'Not meltable';
}

// Sale-sheet sections, in display order. A pledge lands in the FIRST section
// whose test matches. "Packs" vs "Standalone Ships" both contain a ship, so we
// split them with a best-effort heuristic: a pack is a game package / bundle
// (named "Package …", a "Star Citizen + Squadron 42" game pack, or a card that
// contains more than one ship). A single ship that merely ships with a paint
// (e.g. "Cutter plus Groundswell Paint") stays a Standalone Ship.
// The type shown on a pledge's badge (and its color, same everywhere):
// ccu · package (game access) · pack · ship · paint · addon · coupon.
const TYPE_KEYS = ['ccu', 'ship', 'pack', 'package', 'paint', 'addon', 'coupon'];
// Owner's definitions (2026-10-01): a PACKAGE includes game access (Star Citizen or
// Squadron 42), e.g. Mustang Alpha Starter Pack; a PACK is a bundle without the game,
// e.g. Nine Tails Shogun Pack, or anything with "Pack" in its name. Separate types,
// separate sections, apart from ships, CCUs and add-ons.
const hasGameAccess = (p) => TRAITS[0].test(pledgeFacets(p));
function pledgeType(p) {
  if (p.isCCU) return 'ccu';
  if (hasGameAccess(p)) return 'package';
  if (/\bpacks?\b/i.test(p.name || '')) return 'pack';
  if (isPack(p)) return 'pack';
  return p.kind;
}
function isPack(p) {
  if (!p.containsShip) return false;
  const name = p.name || '';
  if (/\bpackage\b/i.test(name)) return true;
  if (/squadron\s*42|\bsq42\b/i.test(name)) return true;
  const ships = (p.contents || []).filter((c) => /^ship$/i.test((c.kind || '').trim()));
  return ships.length > 1;
}

// A standalone hangar pledge ("VFG Industrial Hangar", "Self-Land Hangar",
// "Revel & York Hangar"…). Packs that include a hangar stay under Packs.
function isHangar(p) {
  return !p.containsShip && !p.isCCU && /\bhangar\b/i.test(plainName(p));
}
// A land claim: "Land Claim - …" pledges and Geotack beacons (Geotack
// Planetary Beacon, Geotack-X), which are how claims are placed in game.
const LAND_CLAIM_RE = /\b(land claim|geotack)\b/i;
function isLandClaim(p) {
  return !p.containsShip && !p.isCCU && LAND_CLAIM_RE.test(plainName(p));
}

const MARKET_SECTIONS = [
  // Same rule as the type badge (pledgeType): a pack that holds one ship belongs
  // under Packs, a starter pack with the game under Packages, never Standalone Ships.
  {
    key: 'ship',
    label: 'Standalone Ships',
    test: (p) => p.containsShip && !['ccu', 'pack', 'package'].includes(pledgeType(p)),
  },
  { key: 'pack', label: 'Packs', test: (p) => pledgeType(p) === 'pack' },
  { key: 'package', label: 'Packages', test: (p) => pledgeType(p) === 'package' },
  { key: 'ccu', label: 'Upgrades', test: (p) => p.isCCU },
  { key: 'landclaim', label: 'Land Claims', test: (p) => isLandClaim(p) },
  { key: 'hangar', label: 'Hangars', test: (p) => isHangar(p) },
  { key: 'paint', label: 'Paints', test: (p) => p.kind === 'paint' },
  { key: 'addon', label: 'Add-Ons', test: (p) => p.kind === 'addon' },
  { key: 'other', label: 'Other', test: () => true },
];

function marketSectionOf(p) {
  return MARKET_SECTIONS.find((s) => s.test(p)) || MARKET_SECTIONS[MARKET_SECTIONS.length - 1];
}

// One stacked row of the Market sale sheet (drawn by ui/inventory/MarketRow.svelte).
// `g` is { key, rep, stock, ids }: a representative pledge plus how many identical
// copies were merged into it (the Stock).
function marketRow(g) {
  const p = g.rep;
  const saved = state.market[g.key];
  const spot = hangarSpot(p);
  return {
    key: g.key,
    ids: g.ids,
    melt: Number.isFinite(p.value) ? p.value * fx.rate : '',
    name: plainName(p),
    ins: marketInsurance(p),
    gift: giftableLabel(g),
    giftNo: g.giftable === 0,
    meltText: meltLabel(p),
    store: marketStore(p),
    price: saved && saved.price != null ? String(saved.price) : '',
    stock: g.stock,
    picked: g.ids.every((id) => state.selected.has(id)),
    view: spot && {
      url: spot.url,
      title: `Opens page ${spot.page} of your RSI hangar; it's number ${spot.pos} on that page (as of your last scan)`,
    },
  };
}

// Stack identical pledges (same marketKey) within a section into one group,
// preserving the incoming (sorted) order of first appearance. `giftable` counts
// how many copies are giftable — copies of the "same" item can differ (e.g. a
// cash-bought copy is giftable, a store-credit one isn't), so we track the count
// rather than a single yes/no.
function stackPledges(pledges) {
  const order = [];
  const byKey = new Map();
  for (const p of pledges) {
    const key = marketKey(p);
    let g = byKey.get(key);
    if (!g) {
      g = { key, rep: p, stock: 0, giftable: 0, ids: [] };
      byKey.set(key, g);
      order.push(g);
    }
    g.stock += 1;
    g.ids.push(String(p.id));
    if (p.giftable) g.giftable += 1;
  }
  return order;
}

// Giftable cell text: Yes / No when all copies agree, else "<giftable>/<stock>".
function giftableLabel(g) {
  if (g.giftable === 0) return 'No';
  if (g.giftable === g.stock) return 'Yes';
  return `${g.giftable}/${g.stock}`;
}

// Pledges shown in Market: the inventory filters/sort, minus non-meltable items
// (no resale value), then the Giftable-only toggle (giftable is per-copy, so it
// keeps only the sellable copies).
function marketShown() {
  let shown = computeShown().filter(isMeltable);
  if (state.marketGiftableOnly) shown = shown.filter((p) => p.giftable);
  return shown;
}

// Group shown pledges into [{ section, groups }] for the non-empty sections.
// Shared by the renderer and the CSV/image exporters so they never diverge.
function computeMarketSections(shown) {
  const buckets = new Map(MARKET_SECTIONS.map((s) => [s.key, []]));
  for (const p of shown) buckets.get(marketSectionOf(p).key).push(p);
  return MARKET_SECTIONS.filter((s) => buckets.get(s.key).length).map((s) => ({
    section: s,
    groups: stackPledges(buckets.get(s.key)),
  }));
}

// " · exports use your 3 picked" (or nothing), kept live as boxes are ticked.
function marketSelText() {
  const n = state.selected.size;
  return n
    ? ` · exports use your ${n} picked (tick boxes to change)`
    : ' · tick rows to export just those';
}

// The Market sale sheet (ui/inventory/Market.svelte): its toolbar line and one table
// per section.
function marketView() {
  const shown = marketShown();
  return {
    n: shown.length,
    total: state.items.length,
    melt: money(OH.totalValue(shown)),
    sel: marketSelText(),
    giftableOnly: state.marketGiftableOnly,
    sections: computeMarketSections(shown).map(({ section, groups }) => ({
      key: section.key,
      label: section.label,
      rows: groups.map(marketRow),
    })),
  };
}

// --- Market export (CSV / image) -----------------------------------------
// Both operate on exactly what's on screen (filters + Giftable-only applied) so
// the file matches the view. Everything stays local: it's a download, nothing is uploaded.

function marketFilename(ext) {
  const who = (state.owner && (state.owner.nickname || state.owner.displayname)) || 'hangar';
  return `open-hangar-sale-sheet-${who}.${ext}`.replace(/[^\w.-]+/g, '_');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Every picture export (share image, Market/Buy-Backs tables, fleet image)
// downloads as a PNG.
function downloadImage(canvas, filename, statusEl) {
  canvas.toBlob((blob) => {
    if (!blob) return setExportStatus(statusEl, 'Image didn’t render. Try again?');
    downloadBlob(blob, filename);
    setExportStatus(statusEl, 'Downloaded. Go show off that fleet.');
  }, 'image/png');
}

let exportStatusTimer = null;
function setExportStatus(el, text) {
  if (!el) return;
  el.textContent = text;
  clearTimeout(exportStatusTimer);
  exportStatusTimer = setTimeout(() => {
    el.textContent = '';
  }, 4000);
}

// One CSV cell — quote when it contains a comma, quote, or newline (RFC 4180).
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function marketCsv(sections) {
  const lines = [
    [
      'Category',
      'Item',
      'Insurance',
      'Giftable',
      'Melt Price',
      'Store Price',
      '% of Melt',
      'My Price',
      'Stock',
    ],
  ];
  for (const { section, groups } of sections) {
    for (const g of groups) {
      const saved = state.market[g.key];
      lines.push([
        section.label,
        plainName(g.rep),
        marketInsurance(g.rep),
        giftableLabel(g),
        meltLabel(g.rep),
        marketStore(g.rep),
        pctOfMelt(saved && saved.price, g.rep.value * fx.rate),
        saved && saved.price != null ? saved.price : '',
        g.stock,
      ]);
    }
  }
  return lines.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// What the Market exports cover: the view, narrowed to the selection if any.
function marketExportShown() {
  const shown = marketShown();
  return state.selected.size ? shown.filter((p) => state.selected.has(String(p.id))) : shown;
}

function exportMarketCsv(statusEl) {
  const sections = computeMarketSections(marketExportShown());
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export. Empty cargo hold.');
  downloadBlob(
    new Blob([marketCsv(sections)], { type: 'text/csv;charset=utf-8' }),
    marketFilename('csv'),
  );
  setExportStatus(statusEl, 'CSV saved. Spreadsheet pilots, rejoice.');
}

// Text values for one row of the image (mirrors the table, price prefixed "$").
function marketImageCells(g) {
  const saved = state.market[g.key];
  return {
    name: plainName(g.rep),
    ins: marketInsurance(g.rep),
    gift: giftableLabel(g),
    melt: meltLabel(g.rep),
    store: marketStore(g.rep) || '—',
    price: saved && saved.price != null ? rawMoney(priceNumber(saved.price) ?? 0) : '—',
    stock: String(g.stock),
  };
}

const MK_IMG_COLS = [
  { key: 'name', label: 'Items Name' },
  { key: 'ins', label: 'Insurance' },
  { key: 'gift', label: 'Giftable' },
  { key: 'melt', label: 'Melt Price' },
  { key: 'store', label: 'Store Price' },
  { key: 'price', label: 'My Price' },
  { key: 'stock', label: 'Stock' },
];

// Render the sale sheet to a canvas — drawn cell-by-cell (no external lib, no
// images, so nothing taints the canvas) using the dashboard's dark palette.
// The page's color tokens, for canvas drawings (image exports) so they match.
function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--bg'),
    card: v('--panel'),
    card2: v('--panel-2'),
    line: v('--line'),
    text: v('--text'),
    muted: v('--muted'),
    good: v('--good'),
    bad: v('--bad'),
  };
}

function marketImageCanvas(
  sections,
  { title = '', cols = MK_IMG_COLS, cellsOf = marketImageCells } = {},
) {
  const P = palette();
  const SCALE = 2; // crisp on hi-dpi
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const PAD = 24;
  const CELL_X = 14;
  const ROW_H = 30;
  const HEAD_H = 34;
  const TITLE_H = 36;
  const SECTION_GAP = 18;
  const NAME_MAX = 380;
  const f = (weight, size) => `${weight} ${size}px ${FONT}`;

  const meas = document.createElement('canvas').getContext('2d');

  // One shared column grid: width = widest header/cell, name column capped.
  const widths = cols.map((c) => {
    meas.font = f(600, 13);
    let w = meas.measureText(c.label).width;
    meas.font = f(400, 13);
    for (const { groups } of sections) {
      for (const g of groups) w = Math.max(w, meas.measureText(cellsOf(g)[c.key]).width);
    }
    return Math.min(w, c.key === 'name' ? NAME_MAX : Infinity) + CELL_X * 2;
  });
  const tableW = widths.reduce((a, b) => a + b, 0);
  const W = tableW + PAD * 2;
  const HEADER_H = title ? 44 : 0;
  let H = PAD * 2 - SECTION_GAP + HEADER_H;
  for (const { groups } of sections) H += TITLE_H + HEAD_H + groups.length * ROW_H + SECTION_GAP;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  const colX = [];
  let cx = PAD;
  for (const w of widths) {
    colX.push(cx);
    cx += w;
  }
  const clip = (text, maxW) => {
    meas.font = f(400, 13);
    if (meas.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && meas.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  };

  let y = PAD;
  if (title) {
    ctx.fillStyle = P.text;
    ctx.font = f(700, 22);
    ctx.fillText(clip(title, tableW), PAD, y + 16);
    ctx.fillStyle = P.muted;
    ctx.font = f(400, 12);
    ctx.textAlign = 'right';
    ctx.fillText('Open Hangar · openhangar.space', PAD + tableW, y + 16);
    ctx.textAlign = 'left';
    y += HEADER_H;
  }
  for (const { section, groups } of sections) {
    ctx.fillStyle = P.text;
    ctx.font = f(600, 16);
    ctx.fillText(`${section.label}  (${groups.length})`, PAD, y + TITLE_H / 2);
    y += TITLE_H;

    ctx.fillStyle = P.card2;
    ctx.fillRect(PAD, y, tableW, HEAD_H);
    ctx.fillStyle = P.text;
    ctx.font = f(600, 13);
    cols.forEach((c, i) => ctx.fillText(c.label, colX[i] + CELL_X, y + HEAD_H / 2));
    y += HEAD_H;

    groups.forEach((g, ri) => {
      if (ri % 2 === 1) {
        ctx.fillStyle = P.card;
        ctx.fillRect(PAD, y, tableW, ROW_H);
      }
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + ROW_H + 0.5);
      ctx.lineTo(PAD + tableW, y + ROW_H + 0.5);
      ctx.stroke();

      const cells = cellsOf(g);
      cols.forEach((c, i) => {
        if (c.key === 'name' || c.key === 'price') ctx.fillStyle = P.text;
        else if (c.key === 'gift') ctx.fillStyle = g.giftable === 0 ? P.muted : P.good;
        else ctx.fillStyle = P.muted;
        ctx.font = f(c.key === 'gift' && g.giftable !== 0 ? 600 : 400, 13);
        ctx.fillText(clip(cells[c.key], widths[i] - CELL_X * 2), colX[i] + CELL_X, y + ROW_H / 2);
      });
      y += ROW_H;
    });
    y += SECTION_GAP;
  }
  return canvas;
}

function copyMarketImage(statusEl) {
  const sections = computeMarketSections(marketExportShown());
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export. Empty cargo hold.');
  downloadImage(marketImageCanvas(sections), marketFilename('png'), statusEl);
}

// --- Inventory / Buy-Backs pass (0.3.0) ------------------------------------------
// Paints, add-ons and coupons: what "Hide small stuff" tucks away.
const SMALL_KINDS = new Set(['paint', 'addon', 'coupon']);
// "$20" (a card shows "$20 under store" in green) when today's store price is above
// what the pledge holds, else ''.
function underStoreText(p) {
  const si = storeInfo(p);
  // Only for pledges that hold money (a $0 reward isn't a bargain on the store).
  const gap = si && si.store && Number.isFinite(p.value) && p.value > 0 ? si.store - p.value : 0;
  return gap >= 1 ? dollars(gap) : '';
}
// A buy-back cheaper than the same ship in today's store (exact price loaded).
function bbUnderStore(b) {
  const d = bbDetail(b);
  const sp = buybackStorePrice(b);
  return !!(d && d.price != null && sp && sp - d.price >= 1);
}
function bbUnderText(b) {
  return bbUnderStore(b) ? dollars(buybackStorePrice(b) - bbDetail(b).price) : '';
}
// Stack identical buy-backs (same name, contents and price) into one row with a
// count. Off by default: each buy-back is its own item.
function stackBuybacks(list) {
  const map = new Map();
  for (const b of list) {
    const key = `${b.name}|${b.contains || ''}|${bbPriceText(b)}`;
    const got = map.get(key);
    if (got) got._n++;
    else map.set(key, { ...b, _n: 1 });
  }
  return [...map.values()];
}
// Saved views: one click back to a set of filters (Inventory). The chips are drawn
// by ui/inventory; the [data-view-*] click handlers below do the work.
function currentView_inv() {
  return {
    shown: [...state.shown].sort(),
    traits: [...state.traits]
      .filter(([, sel]) => sel instanceof Set && sel.size)
      .map(([g, sel]) => [g, [...sel].sort()])
      .sort(),
    query: state.query.trim(),
    hideSmall: state.hideSmall,
    ...(state.meltMax != null && { meltMax: state.meltMax }),
  };
}
function saveViews() {
  chrome.storage.local.set({ savedViews: state.savedViews });
}

// Inventory is Svelte (ui/inventory): the page around the list (summary strip,
// toolbar, filter sidebar, active filters, saved views, melt planner) and the list in
// #results (cards in Gallery / Compact / List, or the Market sale sheet). Both redraw
// on 'oh:home'; this keeps the state they read up to date and tells them.
function renderInventory() {
  ensurePrices();
  updateSelectBar();
  homeUpdated();
}

// What Inventory's list shows (ui/inventory/InventoryList.svelte): nothing scanned,
// nothing matching, the cards (in sections when grouped by type) or the Market.
function invList() {
  if (!state.items.length) return { empty: true };
  const shown = computeShown();
  const out = {
    empty: false,
    shown,
    total: state.items.length,
    layout: state.layout,
    group: state.groupByType,
    sections: null,
  };
  if (shown.length && state.groupByType && state.layout !== 'market') {
    // One section per type (sort order kept inside each), sticky titles like Market.
    const buckets = new Map(INV_SECTIONS.map((x) => [x.key, []]));
    for (const p of shown) buckets.get(INV_SECTIONS.find((x) => x.test(p)).key).push(p);
    out.sections = INV_SECTIONS.filter((x) => buckets.get(x.key).length).map((x) => ({
      key: x.key,
      label: x.label,
      items: buckets.get(x.key),
    }));
  }
  return out;
}

// Inventory sections (Group by type): the Market's, plus Coupons on their own.
const INV_SECTIONS = [
  ...MARKET_SECTIONS.filter((x) => x.key !== 'other'),
  { key: 'coupon', label: 'Coupons', test: (p) => p.kind === 'coupon' },
  { key: 'other', label: 'Other', test: () => true },
];

// --- Select mode + fleet image -------------------------------------------
// "Select" in Inventory turns card clicks into picks (and adds a checkbox to
// Market rows). The bar at the bottom makes a picture of just the picked items
// — for a sale post, a fleet brag, a "what should I melt" thread. Drawn on a
// canvas locally; downloaded as a PNG, never uploaded.
const selectBar = $('#select-bar');

function toggleSelected(ids) {
  for (const id of ids) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
  }
  updateSelectBar();
}
function selectedItems() {
  return state.items.filter((p) => state.selected.has(String(p.id)));
}
function updateSelectBar() {
  if (!selectBar) return;
  const inMarket = currentView() === 'inventory' && state.layout === 'market';
  selectBar.hidden = !(state.selecting || (inMarket && state.selected.size));
  const priceSel = $('#sb-price');
  if (priceSel) priceSel.hidden = inMarket; // the table shows melt, store and your price
  const done = selectBar.querySelector('[data-sb="done"]');
  if (done) done.hidden = !state.selecting; // Market has no mode to leave
  const n = state.selected.size;
  $('#sb-count').textContent = n ? `${n} selected` : 'Click items to select them';
  homeUpdated(); // the Select button, the melt planner and the list (ui/inventory)
  selectBar.querySelectorAll('[data-sb="copy"],[data-sb="save"]').forEach((b) => {
    b.disabled = !n;
  });
  const title = $('#sb-title');
  if (title && !title.placeholder.includes("'s")) {
    const who = state.owner && (state.owner.displayname || state.owner.nickname);
    title.placeholder = who ? `${who}'s hangar` : 'My hangar';
  }
}
function setSelecting(on) {
  state.selecting = on;
  if (currentView() === 'inventory') renderInventory();
}

// Price text for the image, per the bar's "Price" choice.
function imagePriceText(p, mode) {
  if (mode === 'melt') return Number.isFinite(p.value) ? formatValue(p) : '';
  if (mode === 'store') {
    const si = storeInfo(p);
    return si && si.store ? dollars(si.store) : '';
  }
  if (mode === 'mine') {
    const saved = state.market[marketKey(p)];
    if (!saved || saved.price == null || saved.price === '') return '';
    const n = Number(saved.price);
    return Number.isFinite(n) ? rawMoney(n) : String(saved.price);
  }
  return '';
}

async function imageUrlFor(p) {
  const real = realImage(p.image);
  if (real) return real;
  const name = resolveImageName(p);
  if (!name) return null;
  try {
    return await OH.getShipImage(name);
  } catch {
    return null;
  }
}
// Load an image the canvas may read back (CORS). RSI's media CDN allows it;
// anything that doesn't just becomes a placeholder tile.
function loadCanvasImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function fleetImageCanvas(list, { title, price }) {
  const SCALE = 2;
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const f = (w, px) => `${w} ${px}px ${FONT}`;
  const P = palette();
  const C = { ...P, ph: P.card2 };
  const PAD = 28,
    GAP = 16,
    CW = 300,
    IH = 169,
    BH = 92,
    CH = IH + BH,
    HEAD = 62,
    FOOT = 30;
  const cols = list.length <= 2 ? list.length : list.length <= 6 ? 3 : 4;
  const rows = Math.ceil(list.length / cols);
  const W = PAD * 2 + cols * CW + (cols - 1) * GAP;
  const H = PAD + HEAD + rows * CH + (rows - 1) * GAP + FOOT + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  const imgs = await Promise.all(list.map(async (p) => loadCanvasImage(await imageUrlFor(p))));

  const clip = (text, maxW) => {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  };
  const wrap = (text, maxW, maxLines) => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
      const next = cur ? `${cur} ${words[i]}` : words[i];
      if (ctx.measureText(next).width <= maxW || !cur) cur = next;
      else {
        lines.push(cur);
        cur = words[i];
        if (lines.length === maxLines - 1) {
          cur = words.slice(i).join(' ');
          break;
        }
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines).map((l, i) => (i === maxLines - 1 ? clip(l, maxW) : l));
  };

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;
  ctx.font = f(700, 24);
  ctx.fillText(clip(title, W - PAD * 2), PAD, PAD + 26);
  let sub = `${list.length} item${list.length === 1 ? '' : 's'}`;
  if (price === 'melt') sub += ` · ${money(OH.totalValue(list))} melt value`;
  ctx.fillStyle = C.muted;
  ctx.font = f(400, 13);
  ctx.fillText(sub, PAD, PAD + 48);

  list.forEach((p, i) => {
    const x = PAD + (i % cols) * (CW + GAP);
    const y = PAD + HEAD + Math.floor(i / cols) * (CH + GAP);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, CW, CH, 10);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.clip();
    const img = imgs[i];
    if (img) {
      // cover-crop into the 16:9 slot
      const r = Math.max(CW / img.naturalWidth, IH / img.naturalHeight);
      const w = img.naturalWidth * r,
        h = img.naturalHeight * r;
      ctx.drawImage(img, x + (CW - w) / 2, y + (IH - h) / 2, w, h);
    } else {
      ctx.fillStyle = C.ph;
      ctx.fillRect(x, y, CW, IH);
      ctx.fillStyle = C.muted;
      ctx.font = f(600, 14);
      ctx.textAlign = 'center';
      ctx.fillText(String(p.kind || '').toUpperCase(), x + CW / 2, y + IH / 2 + 5);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, CW - 1, CH - 1, 10);
    ctx.stroke();

    const tx = x + 12,
      tw = CW - 24;
    const name = p.isCCU && p.ccu ? `${p.ccu.from} → ${p.ccu.to}` : cardName(p);
    ctx.fillStyle = C.text;
    ctx.font = f(600, 14);
    const nameLines = wrap(name, tw, 2);
    nameLines.forEach((line, k) => ctx.fillText(line, tx, y + IH + 22 + k * 18));
    // what's inside (minus insurance, which the bottom row shows)
    const inside = p.isCCU
      ? 'Ship upgrade'
      : (p.contents || [])
          .filter((c) => !/insurance/i.test(`${c.kind || ''} ${c.label || ''}`))
          .map((c) => c.label || c.kind)
          .filter(Boolean)
          .join(' · ');
    if (inside) {
      ctx.fillStyle = C.muted;
      ctx.font = f(400, 12);
      ctx.fillText(clip(inside, tw), tx, y + IH + 22 + nameLines.length * 18 + 2);
    }
    // bottom row: insurance · giftable on the left, price on the right
    const by = y + CH - 14;
    const pt = imagePriceText(p, price);
    ctx.font = f(700, 15);
    const pw = pt ? ctx.measureText(pt).width : 0;
    if (pt) {
      ctx.fillStyle = C.text;
      ctx.fillText(pt, x + CW - 12 - pw, by);
    }
    const ins = insLabel(p.insurance);
    const left = [
      ins,
      p.giftable === true ? 'Giftable' : p.giftable === false ? 'Not giftable' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    ctx.fillStyle = C.muted;
    ctx.font = f(400, 12);
    ctx.fillText(clip(left, tw - pw - 10), tx, by);
  });

  ctx.fillStyle = C.muted;
  ctx.font = f(400, 11);
  ctx.textAlign = 'right';
  ctx.fillText('Made with Open Hangar · openhangar.space', W - PAD, H - PAD + 6);
  ctx.textAlign = 'left';
  return canvas;
}

async function makeFleetImage(action) {
  const status = $('#sb-status');
  const list = selectedItems();
  if (!list.length) return setExportStatus(status, 'Pick some ships first, pilot.');
  if (list.length > 80)
    return setExportStatus(status, 'Pick 80 or fewer for one image. Even a Javelin has limits.');
  setExportStatus(status, 'Painting your fleet…');
  const titleEl = $('#sb-title');
  const title = (titleEl.value || titleEl.placeholder || 'My hangar').trim();
  // In Market view the picture is the table itself (rows are easy to scan);
  // elsewhere it's the card layout.
  const inMarket = currentView() === 'inventory' && state.layout === 'market';
  const canvas = inMarket
    ? marketImageCanvas(computeMarketSections(marketExportShown()), { title })
    : await fleetImageCanvas(list, { title, price: state.imagePrice });
  const who = (state.owner && (state.owner.nickname || state.owner.displayname)) || 'hangar';
  downloadImage(canvas, `open-hangar-fleet-${who}.png`.replace(/[^\w.-]+/g, '_'), status);
}

if (selectBar) {
  selectBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sb]');
    if (!b) return;
    const act = b.dataset.sb;
    if (act === 'all') {
      const shown = state.layout === 'market' ? marketShown() : computeShown();
      for (const p of shown) state.selected.add(String(p.id));
      renderInventory();
    } else if (act === 'none') {
      state.selected.clear();
      renderInventory();
    } else if (act === 'done') setSelecting(false);
    else if (act === 'save') makeFleetImage(act);
  });
  $('#sb-price').addEventListener('change', (e) => {
    state.imagePrice = e.target.value;
  });
}

// --- Store: your wishlist and CCUs -------------------------------------------

// Labels (roles, sizes, chart rows): every word capitalized, "light fighter" → "Light Fighter".
const titleCase = (t) =>
  String(t || '').replace(/(^|[\s/(-])(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase());

// Production state labels, as RSI words them.
const SHIP_STATES = [
  ['flight-ready', 'Flight Ready'],
  ['in-production', 'In Production'],
  ['in-concept', 'In Concept'],
];
// --- Store page -------------------------------------------------------------
// Your side of the store: Wishlist, Your CCUs and Find in Store, under a link to
// the website's full store (every ship, sales, Compare). Long lists scroll inside
// their panel. Whether something is in the store comes from openhangar.space's
// catalog feed (ensureCatalog); RSI's upgrade-tool feed (OH.getStoreShips) is
// still read for Add to RSI Cart (the upgrade SKUs).
let storeData = null; // { at, ships }
let storeByKey = null; // shipKey(name) → store entry
let storeRequested = null; // the pending/finished load (a promise)
function ensureStore() {
  if (storeRequested) return storeRequested;
  storeRequested = OH.getStoreShips().then((d) => {
    if (!d) return;
    storeData = d;
    storeByKey = new Map();
    for (const s of d.ships) {
      storeByKey.set(shipKey(s.name), s);
      storeByKey.set(s.lname, s);
    }
    if (currentView() === 'store') renderStore();
    homeUpdated(); // an open ship window shows In Store Now
  });
  return storeRequested;
}
// Store entries by catalog slug, built through the same fuzzy ship matching the
// rest of the dashboard uses ("Freelancer" ↔ "MISC Freelancer", "C2 Hercules" ↔
// "C2 Hercules Starlifter"). Rebuilt when the store data or ship list changes.
// A special edition ("600i 2951 BIS") is a different store item: never pair
// it with a plain name.
const specialEdition = (n) => /\b(bis|best in show|\d{4})\b/i.test(n || '');
let storeBySlug = null;
let storeBySlugFor = null;
function storeSlugMap() {
  if (!storeData || !state.shipOf) return null;
  if (storeBySlugFor !== storeData.at + ':' + (state.catalog || []).length) {
    storeBySlug = new Map();
    for (const s of storeData.ships) {
      const v = shipEntry(s.name);
      if (v && specialEdition(v.name) !== specialEdition(s.name)) continue;
      if (v && !storeBySlug.has(v.slug)) storeBySlug.set(v.slug, s);
    }
    // Exact names win over fuzzy ones for the same ship.
    for (const s of storeData.ships) {
      const v = (state.catalog || []).find((c) => c.lname === s.lname);
      if (v) storeBySlug.set(v.slug, s);
    }
    storeBySlugFor = storeData.at + ':' + (state.catalog || []).length;
  }
  return storeBySlug;
}
function storeOf(name) {
  if (!storeByKey || !name) return null;
  const v = shipEntry(name);
  const bySlug = storeSlugMap();
  const hit =
    (v && bySlug && bySlug.get(v.slug)) ||
    storeByKey.get(shipKey(name)) ||
    storeByKey.get(String(name).toLowerCase()) ||
    null;
  return hit && specialEdition(hit.name) === specialEdition(name) ? hit : null;
}
// What the catalog says about a wishlist entry or ship, as the "In Store Now" cell
// shows it: { cls, text, title, url }, or null before the catalog has loaded.
function stockLabel(e) {
  if (!catalog) return null;
  const st = wishStatus(e);
  if (st.status === 'in') {
    // The cheapest way to buy it now; a Warbond's usual price in the tooltip.
    const now = st.warbond || st.price;
    const wb = st.warbond ? `: Warbond ${dollars(st.warbond)}, usually ${dollars(st.price)}` : '';
    return {
      cls: 'on',
      text: now ? `In stock (${dollars(now)})` : 'In stock',
      title: `In RSI's store right now${wb}`,
      url: st.url,
    };
  }
  if (st.status === 'soldout')
    return {
      cls: 'wb',
      text: 'Sold out',
      title: 'Listed in the store, sold out for now',
      url: st.url,
    };
  return {
    cls: 'off',
    text: 'Not in store',
    title: "Not for sale in RSI's store right now",
    url: null,
  };
}

// Wishlist order: the saved order ("My order", drag to change) or a sort.
const WISH_SORTS = [
  ['name', 'Name (A–Z)'],
  ['price-desc', 'Price (high to low)'],
  ['price-asc', 'Price (low to high)'],
  ['stock', 'In stock first'],
  ['mine', 'My order (drag)'],
];
function wishlistOrder() {
  const list = state.wishlist.slice();
  if (state.wishSort === 'mine') return list;
  const price = (e) =>
    (typeof e === 'string' ? (shipEntry(e) || {}).msrp : wishStatus(e).price) || 0;
  const label = (e) => wishTitle(e).toLowerCase();
  const stockRank = (e) => {
    if (!catalog) return 3;
    const s = wishStatus(e).status;
    return s === 'in' ? 0 : s === 'soldout' ? 1 : 2;
  };
  const byName = (a, b) => label(a).localeCompare(label(b));
  const cmp =
    {
      name: byName,
      'price-desc': (a, b) => price(b) - price(a) || byName(a, b),
      'price-asc': (a, b) => price(a) - price(b) || byName(a, b),
      stock: (a, b) => stockRank(a) - stockRank(b) || byName(a, b),
    }[state.wishSort] || byName;
  return list.sort(cmp);
}
// The Store page is Svelte (ui/store, mounted into #oh-store); this loads what it
// needs (ship prices, the store catalog, RSI's upgrade feed) and tells it to redraw.
function renderStore() {
  ensurePrices();
  ensureStore();
  ensureCatalog();
  loadSubStore();
  homeUpdated();
}

// Your Subscriber Store (#418): the subscriber-only items RSI offers this account.
// The cached list shows at once; a fresh read runs at most once a day by itself
// (here on the Store page, or after a scan) and on the section's Refresh button.
// Signed out or not a subscriber: no request at all.
const subStore = { list: null, loading: false, error: null, done: 0, total: null, account: null };
async function loadSubStore({ force = false, auto = true } = {}) {
  if (subStore.loading) return;
  const account = await OH.getAccount().catch(() => null);
  subStore.account = account;
  if (!OH.isSubscriber(account)) {
    subStore.list = null;
    homeUpdated();
    return;
  }
  if (!subStore.list) subStore.list = await OH.getSubStoreCached(account);
  homeUpdated();
  if (!force && !(auto && (await OH.subStoreDue()))) return;
  subStore.loading = true;
  subStore.error = null;
  subStore.done = 0;
  homeUpdated();
  const r = await OH.getSubStore({
    force,
    account,
    onProgress: (done, total) => {
      subStore.done = done;
      subStore.total = total;
      homeUpdated();
    },
  });
  subStore.loading = false;
  if (r.ok) subStore.list = r.list;
  else {
    subStore.error = r.error;
    if (r.list) subStore.list = r.list;
  }
  homeUpdated();
}

function setWishSort(key) {
  if (!WISH_SORTS.some(([k]) => k === key)) return;
  state.wishSort = key;
  chrome.storage.local.set({ uiWishSort: key });
  renderStore();
}
// "My order" after a drag: the wishlist's entry keys in their new order.
function setWishOrder(keys) {
  const byKey = new Map(state.wishlist.map((e) => [wishKey(e), e]));
  const next = keys.map((k) => byKey.get(k)).filter(Boolean);
  for (const e of state.wishlist) if (!next.includes(e)) next.push(e);
  if (next.every((e, i) => e === state.wishlist[i])) return;
  state.wishlist = next;
  chrome.storage.local.set({ wishlist: state.wishlist });
  renderStore();
}

// --- Org fleet ------------------------------------------------------------
// Members' ship lists (from HTF exports or backups) combined into one fleet.
// Stored under `orgFleet` in this browser only: { members: [{ name, importedAt, ships }] }.
// The page itself is Svelte (ui/org); this keeps the stored list and the actions it
// calls through window.OHApp.org.
let orgMembers = null;
async function loadOrg() {
  if (!orgMembers) {
    const { orgFleet } = await chrome.storage.local.get('orgFleet');
    orgMembers = (orgFleet && Array.isArray(orgFleet.members) && orgFleet.members) || [];
  }
  return orgMembers;
}
async function saveOrg() {
  await chrome.storage.local.set({ orgFleet: { members: orgMembers } });
}
function upsertMember(name, ships, extra = {}) {
  const i = orgMembers.findIndex((m) => m.name.toLowerCase() === name.toLowerCase());
  const row = { name, importedAt: Date.now(), ships, ...extra };
  if (i >= 0) orgMembers[i] = row;
  else orgMembers.push(row);
}
// Your own entry follows your latest scan; "Add my fleet" used to be a one-off
// copy, so ships bought later never showed up. Matched by the flag, or (for
// entries saved before it existed) by your RSI name. True when it changed.
function syncMyOrgFleet() {
  if (!state.items.length || !state.owner) return false;
  const names = [state.owner.displayname, state.owner.nickname]
    .filter(Boolean)
    .map((n) => n.toLowerCase());
  const m = orgMembers.find((x) => x.mine || names.includes(String(x.name).toLowerCase()));
  if (!m) return false;
  const r = OH.shipsFromFile({ sources: { hangar: { items: state.items } } });
  if (r.error) return false;
  const changed = !m.mine || JSON.stringify(m.ships) !== JSON.stringify(r.ships);
  if (!changed) return false;
  Object.assign(m, { mine: true, ships: r.ships, importedAt: state.scannedAt || Date.now() });
  return true;
}

// Org Fleet is the Svelte page in ui/org (mounted into #oh-org); this loads the
// members (keeping your own entry in step with your scan) and tells it to redraw.
async function renderOrg() {
  ensurePrices();
  await loadOrg();
  if (syncMyOrgFleet()) await saveOrg();
  homeUpdated();
}

// The page's buttons (ui/org calls them through OHApp.org). Each resolves to the
// line shown next to the buttons.
async function importOrgFiles(files) {
  await loadOrg();
  let added = 0;
  const problems = [];
  for (const file of files) {
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      problems.push(`${file.name}: not JSON`);
      continue;
    }
    const r = OH.shipsFromFile(obj, file.name);
    if (r.error) {
      problems.push(`${file.name}: ${r.error}`);
      continue;
    }
    const name = (
      r.name ||
      prompt(`Whose fleet is ${file.name}?`, file.name.replace(/\.json$/i, '')) ||
      ''
    ).trim();
    if (!name) continue;
    upsertMember(name, r.ships);
    added++;
  }
  await saveOrg();
  renderOrg();
  return (
    `Added ${added} fleet${added === 1 ? '' : 's'}.` +
    (problems.length ? ` Skipped: ${problems.join('; ')}` : '')
  );
}
async function addMyOrgFleet() {
  if (!state.items.length) return 'Scan your hangar first, then bring your ships to the party.';
  await loadOrg();
  const who = (state.owner && (state.owner.displayname || state.owner.nickname)) || 'Me';
  const r = OH.shipsFromFile({ sources: { hangar: { items: state.items } } });
  if (r.error) return r.error;
  upsertMember(who, r.ships, { mine: true });
  await saveOrg();
  renderOrg();
  return `Added your fleet (${r.ships.length} ships).`;
}
// Ships only, like the page: no store prices or fleet values.
async function exportOrgCsv() {
  const members = await loadOrg();
  if (!members.length || !state.shipOf) return 'Nothing to export yet. Empty hangar bay.';
  const f = OH.orgFleet(members, state.shipOf, state.priceOf);
  const lines = [['Ship', 'Count', 'LTI', 'Owners']].concat(
    f.ships.map((r) => [
      r.name,
      r.count,
      r.lti,
      r.owners.map((o) => `${o.name} x${o.n}`).join('; '),
    ]),
  );
  downloadBlob(
    new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }),
    `open-hangar-org-fleet-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  return 'CSV saved. Time for the org meeting.';
}
async function removeOrgMember(name) {
  await loadOrg();
  orgMembers = orgMembers.filter((m) => m.name !== name);
  await saveOrg();
  renderOrg();
}

// --- Stats ----------------------------------------------------------------

// One line per history step: what changed between two snapshots.
function changeSummary(d) {
  const parts = [];
  if (d.added.length) parts.push(`+${d.added.length} new`);
  if (d.removed.length) parts.push(`${d.removed.length} gone`);
  if (d.changed.length) parts.push(`${d.changed.length} changed`);
  if (Math.abs(d.melt) >= 0.01)
    parts.push(`melt value ${d.melt > 0 ? '+' : '−'}${money(Math.abs(d.melt))}`);
  return parts.join(' · ') || 'no changes';
}
const fmtDay = (t) => new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });

// Account value of a history snapshot, on the same rules as the headline
// (OH.snapshotValue): pledges still owned count exactly as today; ones since melted
// or gifted are estimated from their name or their melt value.
// The latest scan is "now": if it predates Store Credit being recorded, it takes
// today's credit, so the chart always ends on the headline.
function snapshotStore(snap) {
  const hist = state.history || [];
  const latest = snap === hist[hist.length - 1];
  const s =
    !Number.isFinite(snap.credit) && latest && state.storeCredit != null
      ? { ...snap, credit: state.storeCredit }
      : snap;
  return OH.snapshotValue(s, accountValue(), state.priceOf);
}
// Tooltip note for chart points from scans that didn't record Store Credit.
function creditNote(snap) {
  const hist = state.history || [];
  return Number.isFinite(snap.credit) || snap === hist[hist.length - 1]
    ? ''
    : ' (Store Credit not recorded)';
}

// Stats is the Svelte page in ui/stats (mounted into #stats-body); this only loads
// what it needs and tells it to redraw.
function renderStats() {
  ensurePrices();
  if (state.statsTab === 'fleet') ensureLoaners();
  homeUpdated();
}

// Stats is split into tabs; the choice is remembered like the Inventory layout.
const STATS_TABS = [
  ['overview', 'Overview'],
  ['value', 'Value'],
  ['fleet', 'Fleet'],
  ['collection', 'Collection'],
  ['buybacks', 'Buy-Backs'],
  ['top', 'Top Lists'],
  ['spending', 'Spending'],
  ['history', 'History'],
];
function setStatsTab(tab) {
  if (!STATS_TABS.some(([k]) => k === tab)) return;
  state.statsTab = tab;
  chrome.storage.local.set({ uiStatsTab: tab });
  if (currentView() === 'stats') renderStats();
}
// Tab buttons, and links elsewhere (e.g. Home's "history") that open a tab.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-stats-tab]');
  if (el) setStatsTab(el.dataset.statsTab);
});

// --- Referrals (dedicated view) ------------------------------------------
// Charts are hand-built inline SVG — no chart lib, no network (extension CSP +
// the project's zero-runtime-deps rule). Data comes from OH.getReferral.

// Parse RSI's "YYYY-MM-DD HH:MM:SS" timestamps to a Date (treat as local).
function parseTs(s) {
  if (!s) return null;
  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(t) ? null : new Date(t);
}
// A recruit "happens" when they CONVERT (cross the spend threshold), not when they
// enlisted — so recruit time-stats key on convertedOn (fall back to enlistedOn for
// any older row missing it). Prospects never converted, so they use enlistedOn.
const recruitDate = (r) => parseTs(r.convertedOn) || parseTs(r.enlistedOn);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// The month with the most recruits → { k: '2024-03', n, label: 'Mar 2024' }, or
// null. A tie goes to the most recent month.
function bestMonth(dates) {
  const byMonth = new Map();
  for (const d of dates) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + 1);
  let best = null;
  for (const [k, n] of byMonth)
    if (!best || n > best.n || (n === best.n && k > best.k)) best = { k, n };
  if (!best) return null;
  const [y, m] = best.k.split('-').map(Number);
  best.label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return best;
}

// Return the bonus event whose [start,end] window contains date `d`, or null.
// Compared at day granularity (inclusive of the end day).
function eventForDate(d) {
  if (!d) return null;
  const t = d.getTime();
  for (const ev of referralEvents) {
    const s = parseTs(ev.start + ' 00:00:00');
    const e = parseTs(ev.end + ' 23:59:59');
    if (s && e && t >= s.getTime() && t <= e.getTime()) return ev;
  }
  return null;
}

// --- Referrals: progress, gallery, milestones, insights, share card ---------
// The bonus-event list starts as the built-in REFERRAL_EVENTS and is refreshed
// from openhangar.space's referral-events feed (OH.getReferralEvents, asked at
// most once a day) the first time the page opens; its rows replace built-in ones
// with the same start date.
let refEventsRequested = false;
function refreshReferralEvents() {
  if (refEventsRequested) return;
  refEventsRequested = true;
  OH.getReferralEvents().then((wiki) => {
    if (!wiki || !wiki.length) return;
    const byStart = new Map(REFERRAL_EVENTS.map((e) => [e.start, e]));
    for (const e of wiki) byStart.set(e.start, e);
    referralEvents = [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
    if (currentView() === 'referrals' && state.referral) renderReferrals();
    renderEventBanner();
  });
}

const fmtDate = (d) =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const rewardNames = (items) => (items || []).map((i) => i.n).join(' + ');

// The tier you're on and the next one, for a ladder.
function tierProgress(ladder, recruits) {
  const next = ladder.find((t) => recruits < t.at) || null;
  const done = ladder.filter((t) => recruits >= t.at);
  const prev = done.length ? done[done.length - 1] : null;
  const from = prev ? prev.at : 0;
  const pct = next ? Math.max(0, Math.min(1, (recruits - from) / (next.at - from))) : 1;
  return { next, prev, from, pct, done: done.length };
}

// The legacy rank you hold (e.g. "Sergeant"), or ''.
function legacyRank(recruits) {
  const done = REFERRAL_LADDER_LEGACY.filter((t) => recruits >= t.at);
  return done.length ? done[done.length - 1].rank : '';
}

// Bonus events you earned: once per event, dated by the first recruit who
// converted inside its window.
function earnedEvents(recruitsRows) {
  const hits = new Map();
  for (const r of recruitsRows) {
    const d = recruitDate(r);
    const ev = eventForDate(d);
    if (!ev) continue;
    const cur = hits.get(ev.name);
    if (!cur) hits.set(ev.name, { ev, firstDate: d });
    else if (d < cur.firstDate) cur.firstDate = d;
  }
  return [...hits.values()].sort((a, b) => b.firstDate - a.firstDate);
}

// Everything you've earned, as picture cards: tier rewards (both ladders) and
// event bonuses. Ship rewards get their art looked up after render.
function earnedRewards(recruits, recruitsRows, hasLegacy) {
  const out = [];
  const add = (items, sub, file) => {
    for (const it of items) {
      out.push({
        name: it.n,
        sub,
        file: file || '',
        resolve: it.ship ? it.img || it.n.replace(/\s*\(LTI\)/i, '').trim() : '',
      });
    }
  };
  for (const t of REFERRAL_LADDER_STANDARD.filter((x) => recruits >= x.at).reverse())
    add(t.items, `${t.at} recruit${t.at === 1 ? '' : 's'}`, t.file);
  if (hasLegacy) {
    for (const t of REFERRAL_LADDER_LEGACY.filter((x) => recruits >= x.at).reverse())
      add(t.items, `Legacy · ${t.rank}`, t.file);
  }
  for (const { ev } of earnedEvents(recruitsRows)) {
    out.unshift({
      name: shortReward(ev.reward),
      sub: `Event · ${ev.name}`,
      file: ev.image || '',
      resolve: ev.reward,
    });
  }
  return out;
}
// "Drake Interplanetary Dragonfly with lifetime insurance and …" → "Drake Interplanetary Dragonfly".
function shortReward(text) {
  return (
    String(text || '')
      .replace(/\s+(with|and)\b.*$/i, '')
      .replace(/,.*$/, '')
      .trim() || text
  );
}

// The event running today, or null.
function runningEvent() {
  const today = new Date();
  return eventForDate(today);
}

// --- Share card -----------------------------------------------------------
async function referralShareCanvas({ withCode }) {
  const P = palette();
  const ref = state.referral;
  const recruits = ref.legacy?.recruits ?? 0;
  const prospects = ref.prospects ?? 0;
  const hasLegacy = recruits > 0 && !!ref.legacy;
  const rows = ref.recruitsList || [];
  const p = tierProgress(REFERRAL_LADDER_STANDARD, recruits);
  const rank = hasLegacy ? legacyRank(recruits) : '';
  const earned = earnedRewards(recruits, rows, hasLegacy);
  const ships = earned.filter((r) => r.file || r.resolve).slice(0, 6);
  const who = (state.owner && (state.owner.nickname || state.owner.displayname)) || '';
  const url =
    ref.url || (ref.code ? `https://robertsspaceindustries.com/enlist?referral=${ref.code}` : '');
  const qr = withCode && url ? OpenHangarQR.encode(url) : null;

  const dates = rows.map(recruitDate).filter(Boolean);
  const last30 = dates.filter((d) => Date.now() - d < 30 * 86400000).length;
  const best = bestMonth(dates);

  const files = await OH.wikiImageUrls(ships.map((r) => r.file).filter(Boolean));
  const imgs = await Promise.all(
    ships.map(async (r) =>
      loadCanvasImage(
        (r.file && files[r.file]) || (r.resolve && (await OH.getShipImage(r.resolve))),
      ),
    ),
  );

  const SCALE = 2;
  const W = 900;
  const PAD = 36;
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const f = (w, s) => `${w} ${s}px ${FONT}`;
  const H = 1000; // drawn tall, cropped to the content at the end
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, P.bg);
  bg.addColorStop(1, '#131c2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  let y = PAD + 22;
  ctx.fillStyle = P.muted;
  ctx.font = f(600, 15);
  ctx.fillText(who ? `${who.toUpperCase()} · REFERRALS` : 'REFERRALS', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillText('Open Hangar', W - PAD, y);
  ctx.textAlign = 'left';

  y += 72;
  ctx.fillStyle = P.text;
  ctx.font = f(800, 72);
  const nText = recruits.toLocaleString('en-US');
  ctx.fillText(nText, PAD, y);
  const nW = ctx.measureText(nText).width;
  ctx.font = f(600, 24);
  ctx.fillStyle = P.muted;
  ctx.fillText(recruits === 1 ? 'recruit' : 'recruits', PAD + nW + 12, y);
  if (rank) {
    ctx.fillStyle = P.text;
    ctx.font = f(700, 18);
    ctx.fillText(rank.toUpperCase(), PAD, y + 30);
  }

  // Progress to the next tier.
  y += rank ? 70 : 50;
  ctx.fillStyle = P.text;
  ctx.font = f(600, 17);
  const next = p.next
    ? `${(p.next.at - recruits).toLocaleString('en-US')} more to ${rewardNames(p.next.items)}`
    : 'Every standard reward unlocked';
  ctx.fillText(next, PAD, y);
  y += 14;
  const barW = W - PAD * 2;
  ctx.fillStyle = P.card2;
  ctx.beginPath();
  ctx.roundRect(PAD, y, barW, 14, 7);
  ctx.fill();
  ctx.fillStyle = P.good;
  ctx.beginPath();
  ctx.roundRect(PAD, y, Math.max(14, barW * p.pct), 14, 7);
  ctx.fill();
  ctx.fillStyle = P.muted;
  ctx.font = f(400, 13);
  y += 32;
  ctx.fillText(p.from.toLocaleString('en-US'), PAD, y);
  if (p.next) {
    ctx.textAlign = 'right';
    ctx.fillText(p.next.at.toLocaleString('en-US'), W - PAD, y);
    ctx.textAlign = 'left';
  }

  // Stat boxes.
  y += 24;
  const stats = [
    [prospects.toLocaleString('en-US'), 'prospects'],
    [prospects ? `${((recruits / prospects) * 100).toFixed(1)}%` : '—', 'conversion'],
    [String(last30), 'last 30 days'],
    [best ? String(best.n) : '0', best ? `best month · ${best.label}` : 'best month'],
  ];
  const boxW = (barW - 3 * 12) / 4;
  stats.forEach(([big, lbl], i) => {
    const x = PAD + i * (boxW + 12);
    ctx.fillStyle = P.card;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 78, 10);
    ctx.fill();
    ctx.fillStyle = P.text;
    ctx.font = f(700, 26);
    ctx.fillText(big, x + 16, y + 38);
    ctx.fillStyle = P.muted;
    let size = 13;
    ctx.font = f(400, size);
    while (size > 10 && ctx.measureText(lbl).width > boxW - 24) ctx.font = f(400, --size);
    ctx.fillText(lbl, x + 16, y + 62);
  });
  y += 78;

  // Ship rewards earned.
  if (ships.length) {
    y += 34;
    ctx.fillStyle = P.text;
    ctx.font = f(600, 16);
    ctx.fillText(
      `Rewards earned: ${earned.length}${earned.length > ships.length ? ` (latest ${ships.length})` : ''}`,
      PAD,
      y,
    );
    y += 14;
    const tw = (barW - 5 * 12) / 6;
    const th = tw * 0.6;
    ships.forEach((r, i) => {
      const x = PAD + i * (tw + 12);
      ctx.fillStyle = P.card;
      ctx.beginPath();
      ctx.roundRect(x, y, tw, th, 8);
      ctx.fill();
      const im = imgs[i];
      if (im) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, tw, th, 8);
        ctx.clip();
        const s = Math.max(tw / im.width, th / im.height);
        ctx.drawImage(
          im,
          x + (tw - im.width * s) / 2,
          y + (th - im.height * s) / 2,
          im.width * s,
          im.height * s,
        );
        ctx.restore();
      }
      ctx.fillStyle = P.text;
      ctx.font = f(500, 12);
      let label = r.name;
      while (label.length > 3 && ctx.measureText(label).width > tw) label = label.slice(0, -2);
      if (label !== r.name) label = label.replace(/.$/, '…');
      ctx.fillText(label, x, y + th + 18);
    });
    y += th + 30;
  }

  // Footer, with the code + QR when asked for.
  const footY = y + (qr ? 140 : 56);
  if (qr) {
    const q = 132; // incl. a 3-module white quiet zone so phones can scan it
    const cell = q / (qr.size + 6);
    const qx = W - PAD - q;
    const qy = footY - q + 6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx, qy, q, q);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < qr.size; r++)
      for (let c = 0; c < qr.size; c++)
        if (qr.modules[r][c])
          ctx.fillRect(qx + (c + 3) * cell, qy + (r + 3) * cell, cell + 0.3, cell + 0.3);
    ctx.fillStyle = P.text;
    ctx.font = f(700, 18);
    ctx.fillText(`Enlist with my code: ${ref.code}`, PAD, footY - 22);
    ctx.fillStyle = P.muted;
    ctx.font = f(400, 13);
    ctx.fillText(
      'Scan the QR code, or enter the code when you sign up at robertsspaceindustries.com',
      PAD,
      footY,
    );
  } else {
    ctx.fillStyle = P.muted;
    ctx.font = f(400, 13);
    ctx.fillText('Made with Open Hangar · openhangar.space', PAD, footY);
  }
  const usedH = Math.min(H, footY + PAD);
  const out = document.createElement('canvas');
  out.width = W * SCALE;
  out.height = usedH * SCALE;
  out.getContext('2d').drawImage(canvas, 0, 0);
  return out;
}

async function shareReferralImage() {
  const status = $('#ref-share-status');
  const withCode = !!$('#ref-share-code')?.checked;
  setExportStatus(status, 'Painting your fleet…');
  const canvas = await referralShareCanvas({ withCode });
  downloadImage(canvas, marketFilename('png').replace('sale-sheet', 'referrals'), status);
}

// The Referrals page is Svelte (ui/referrals): tell it to redraw, and fetch newer
// bonus events from the wiki the first time it opens.
function renderReferrals() {
  refreshReferralEvents();
  homeUpdated();
}

// --- Buy-Backs ------------------------------------------------------------

// Only ever link to RSI itself — href can come from an imported file, so resolve
// it against RSI and reject anything that lands on another host or scheme.
function buybackUrl(b) {
  if (typeof b.href !== 'string' || !b.href) return '';
  try {
    const u = new URL(b.href, 'https://robertsspaceindustries.com');
    return u.protocol === 'https:' && u.hostname === 'robertsspaceindustries.com' ? u.href : '';
  } catch {
    return '';
  }
}

const buybackCard = (b) =>
  memoCard(
    b,
    [
      state.bbDetails,
      state.priceOf,
      state.buybacks,
      fx.code,
      fx.rate,
      streamer.on,
      b.image,
      b.shipArt,
    ],
    buybackCardData,
  );
// What a Buy-Backs card shows (drawn by ui/lib/Card.svelte, like the Inventory cards).
function buybackCardData(b) {
  const ccuArt = b.ccu && b.ccu.to && !b.shipArt; // show the target ship (see pledgeCard)
  const s = OH.shortBuybackName;
  const kind = b.isCCU ? 'ccu' : b.kind;
  return {
    id: String(b.id || ''),
    image: (ccuArt ? null : realImage(b.image)) || '',
    // A CCU resolves art from its target ship; a package from the first ship in it; a
    // plain buy-back from its own name. Also the broken-image fallback.
    resolve:
      b.ccu && b.ccu.to ? b.ccu.to : resolveImageName({ ...b, kind: 'ship' }) || b.name || '',
    rsiImage: (ccuArt && realImage(b.image)) || '',
    label: bbFullName(b),
    ccu: b.ccu ? { from: s(b.ccu.from), to: s(b.ccu.to) } : null,
    name: buybackName(b),
    n: b._n || 1,
    contents: b.contains || '',
    badge: TYPE_KEYS.includes(kind) ? kind : '',
    type: b.kind || 'buy-back',
    date: b.date || '',
    price: bbPriceData(b),
    under: bbUnderText(b),
    reclaim: reclaimOf(b),
  };
}

// Buy-back kinds actually present in the scanned data, in BB_KINDS order.
function presentBbKinds() {
  return BB_KINDS.filter((k) => state.buybacks.some((b) => b.kind === k.key));
}

// --- Buy-back tokens + prices ---------------------------------------------
// RSI adds one buy-back token per quarter (they don't roll over). Dates from
// RSI's "2026 Buy Back Token Schedule" Spectrum post; add next year's when
// it's announced.
// The dates and the rule past them live in lib.js (OH.nextBuybackToken). Shown
// on the page only in the last 30 days (soon); the tooltip always names it.
function nextTokenDate(now = Date.now(), { soon = true } = {}) {
  const t = soon ? OH.soonBuybackToken(now) : OH.nextBuybackToken(now);
  const d = t == null ? null : new Date(t);
  return d
    ? d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;
}
function tokenTitle() {
  const next = nextTokenDate(Date.now(), { soon: false });
  return `A token lets you buy back one melted pledge with store credit. RSI adds one each quarter${
    next ? ` (next: ${next})` : ''
  }; they don't roll over.`;
}
// Standard store price of what a buy-back gives back: the ship's price today
// (from the ship list), or a CCU's price gap. RSI's actual buy-back price can
// differ; this is for comparing and sorting. null when unknown.
function buybackStorePrice(b) {
  if (!state.priceOf) return null;
  if (b.isCCU && b.ccu) {
    const from = state.priceOf(b.ccu.from);
    const to = state.priceOf(b.ccu.to);
    return from && to && to.msrp > from.msrp ? to.msrp - from.msrp : null;
  }
  if (!['ship', 'pack', 'package'].includes(b.kind)) return null;
  // Once its page has been read, price every ship it holds: a pack's value is
  // all of its ships, not just the first one RSI's list names.
  const d = bbDetail(b);
  if (d && Array.isArray(d.ships) && d.ships.length) {
    let sum = 0;
    for (const x of d.ships) {
      const hit = state.priceOf(x.name);
      if (hit && hit.msrp) sum += hit.msrp;
    }
    return sum || null;
  }
  // Packs and packages hold several ships; without their contents any single
  // ship's price would badly understate them, so say nothing.
  if (b.kind !== 'ship') return null;
  const bare = String(b.name || '').replace(/^\s*[^-–]+?\s*[-–]\s/, '');
  const tries = [
    bare,
    bare.replace(/\s*[-–]\s*(lti|iae|ilw|warbond|standard edition|\d+\s*months?.*)$/i, ''),
    (b.contains || '').split(/\s+and\s+/i)[0],
  ];
  for (const t of tries) {
    const hit = t && state.priceOf(t.trim());
    if (hit && hit.msrp) return hit.msrp;
  }
  return null;
}

// "Load details" reads each shown buy-back's own page (price, contents,
// insurance), one at a time. Cached for good, so it's a one-off per buy-back.
let bbLoading = null; // { stop: bool, done, total }
// The Load Details bar above the list (ui/buybacks/DetailsBar.svelte): while
// reading, the progress and Stop; else how many could be read and how long it
// takes; null when there's nothing left to read.
function bbDetailsInfo(list) {
  if (bbLoading) return { loading: true, done: bbLoading.done, total: bbLoading.total };
  const need = list.filter((b) => !b.isCCU && /^\d+$/.test(String(b.id)) && bbNeedsRead(b));
  if (!need.length) return null;
  return {
    loading: false,
    need: need.length,
    have: list.filter((b) => !bbNeedsRead(b)).length,
    of: list.length,
    mins: Math.max(1, Math.round((need.length * 1.6) / 60)),
    // Big lists get a heads-up: hundreds of pages in a row is what makes RSI throttle.
    big: need.length > 100,
  };
}
// packsOnly: just the packs whose contents are unread (search's "Get Details").
// max: read at most this many (the automatic read after a scan); the rest wait.
// Anything already filled from your own hangar history is never read again.
async function loadBuybackDetails({ packsOnly = false, max = Infinity } = {}) {
  const list = (packsOnly ? state.buybacks : computeBuybacks())
    .filter(
      (b) =>
        !b.isCCU && bbNeedsRead(b) && (!packsOnly || b.kind === 'pack' || b.kind === 'package'),
    )
    .slice(0, max);
  bbLoading = { stop: false, done: 0, total: 0 };
  renderBuybacks();
  const res = await OH.fetchBuybackDetails(
    list.map((b) => String(b.id)),
    (done, total) => {
      bbLoading.done = done;
      bbLoading.total = total;
      if (done % 10 === 0 && currentView() === 'buybacks') {
        state.bbDetails = { ...state.bbDetails };
      }
      homeUpdated(); // the progress line (ui/buybacks)
    },
    () => !bbLoading.stop,
  );
  bbLoading = null;
  state.bbDetails = { ...(await OH.getBuybackDetails()) };
  if (res.rateLimited) {
    const mins = Math.max(1, Math.ceil((res.retryAt - Date.now()) / 60e3));
    setStatus(
      `RSI asked us to slow down, so we stopped${res.done ? ` after ${res.done} pages (kept)` : ''}. Give it about ${mins} min to cool off. Opening a single buy-back still works.`,
      true,
    );
  } else if (res.errors)
    setStatus(`Read ${res.done - res.errors} buy-back pages; ${res.errors} couldn't be read.`);
  if (currentView() === 'buybacks') renderBuybacks();
}

function computeBuybacks() {
  const q = state.bbQuery.trim().toLowerCase();
  // Same include-selection model as the inventory chips: empty = show all.
  let list = state.bbShown.size
    ? state.buybacks.filter((b) => state.bbShown.has(b.kind))
    : state.buybacks.slice();
  // Opened from a Hangar Alert: just the buy-backs it was about.
  if (state.bbOnly) list = list.filter((b) => state.bbOnly.ids.has(String(b.id)));
  if (state.bbHideSmall && !state.bbOnly)
    list = list.filter((b) => !SMALL_KINDS.has(b.kind) || state.bbShown.has(b.kind));
  list = applyGroups(list, BB_GROUPS, state.bbTraits);
  if (state.bbPriceMax != null)
    list = list.filter((b) => {
      const v = bbPrice(b);
      return v != null && v <= state.bbPriceMax;
    });
  if (q) list = list.filter((b) => `${b.name || ''} ${b.contains || ''}`.toLowerCase().includes(q));
  if (state.bbSort !== 'default') {
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    const dt = (b) => {
      const t = Date.parse(b.date);
      return Number.isNaN(t) ? 0 : t;
    };
    list = list.slice().sort((a, b) => {
      switch (state.bbSort) {
        case 'name-asc':
          return byName(a, b);
        case 'name-desc':
          return byName(b, a);
        case 'date-desc':
          return dt(b) - dt(a);
        case 'date-asc':
          return dt(a) - dt(b);
        case 'price-desc':
        case 'price-asc': {
          const pa = bbPrice(a);
          const pb = bbPrice(b);
          if (pa == null || pb == null) return (pa == null) - (pb == null); // unknown last
          return state.bbSort === 'price-desc' ? pb - pa : pa - pb;
        }
        default:
          return 0;
      }
    });
  }
  return list;
}

// Buy-Backs is Svelte (ui/buybacks): the page around the list and the list in
// #buybacks-body (cards, or the Market reclaim sheet, with the Load Details bar and
// a Hangar Alert's "Showing the…" line). Both redraw on 'oh:home'.
function renderBuybacks() {
  if (state.buybacks.length && !state.priceOf) ensurePrices();
  homeUpdated();
}

// What the Buy-Backs list shows (ui/buybacks/BuybacksList.svelte).
function bbList() {
  if (!state.buybacks.length) return { empty: true };
  let list = computeBuybacks();
  if (state.bbStack) list = stackBuybacks(list);
  return {
    empty: false,
    list,
    total: state.buybacks.length,
    when: state.buybacksScannedAt ? new Date(state.buybacksScannedAt).toLocaleString() : '',
    layout: state.bbLayout,
    // Opened from a Hangar Alert: say so, with a way back to everything.
    only: state.bbOnly ? state.bbOnly.label : null,
    details: list.length ? bbDetailsInfo(list) : null,
  };
}

// Buy-back "Market": one reclaim table per kind (Ships, CCUs, Paints, …), with
// the columns a buy-back has — name, reclaim cost, quantity, and a reclaim link.
// Identical copies are stacked into one row with a Qty count, mirroring the
// inventory Market's per-category stacked tables.
// A buy-back's title as shown in lists: without the type label and Warbond /
// Standard Edition (OH.shortBuybackName, #176). The details window's title and
// exports keep RSI's full name; the card's tooltip shows it too.
// Both are OH.buybackTitle (#273): short for lists, full for windows and exports.
function buybackName(b) {
  return OH.buybackTitle(b);
}
function bbFullName(b) {
  return OH.buybackTitle(b, { short: false });
}

// The buy-back list DOES honour pagesize=1 (unlike the hangar), so page N is
// exactly the Nth buy-back in scan order. Right until your buy-backs change.
let bbPos = null;
function buybackViewUrl(b) {
  if (!bbPos || bbPos.items !== state.buybacks) {
    bbPos = { items: state.buybacks, at: new Map(state.buybacks.map((x, i) => [String(x.id), i])) };
  }
  const i = bbPos.at.get(String(b.id));
  return i == null
    ? null
    : `https://robertsspaceindustries.com/account/buy-back-pledges?pagesize=1&page=${i + 1}`;
}

// One "Reclaim" link for every buy-back: RSI's reclaim page, or for CCUs (which
// have no page of their own; RSI reclaims them in a pop-up) the one-item
// buy-back list entry where that button is.
// Where a buy-back's Reclaim link goes: { blocked } | { url, tip, retired? } | { retired } | null.
function reclaimOf(b) {
  // Retired ships (#306): RSI still sells their buy-backs back, so they keep the link
  // and get a "Retired, Buy-Back Still Open" label (`retired` is its note).
  const retired = OH.retiredBuyback(b);
  // Pledges RSI never sells back (#403): say why instead of a link.
  const block = OH.buybackBlock(b, bbDetail(b));
  if (block) return { blocked: OH.BUYBACK_BLOCK_REASONS[block] };
  // A CCU's button on RSI has no page of its own: its href is just the pledge
  // store, which opened the store's front page instead of this upgrade (owner,
  // 2026-10-05). CCUs always use the one-item buy-back list, where RSI's own Buy
  // Back button opens the upgrade pop-up for exactly this pledge.
  const direct = b.ccu || b.isCCU ? '' : buybackUrl(b);
  const url = direct || buybackViewUrl(b);
  if (!url) return retired ? { retired } : null;
  const tip = direct
    ? 'Open the buy-back page on RSI'
    : "Opens just this CCU in RSI's buy-back list, where its reclaim button is";
  return retired ? { url, tip, retired } : { url, tip };
}
function bbDetail(b) {
  return state.bbDetails[b.id] || null;
}
// Still worth reading its RSI page: nothing known yet, or only its value (from the
// scan history; its contents are still unknown).
function bbNeedsRead(b) {
  const d = state.bbDetails[b.id];
  return !d || !!d.partial;
}
function bbInsurance(b) {
  const d = bbDetail(b);
  return (
    insLabel((d && d.insurance) || b.insurance || window.OpenHangar.insuranceFromName(b.name)) ||
    (d && !d.partial ? 'None' : '—')
  );
}

// The buy-back's real price once its page has been read; else today's store
// price for the ship as an estimate.
function bbPrice(b) {
  const d = bbDetail(b);
  if (d && d.price != null) return d.price;
  return buybackStorePrice(b);
}
// Where a known price came from, when it wasn't RSI's buy-back page.
const BB_PRICE_TITLE = {
  history: 'What it was worth in your hangar before it was melted',
  'scan-history': 'What it was worth in your hangar before it was melted (from your scan history)',
};
// The small print in a buy-back's window when its details came from this browser.
const BB_SOURCE_NOTE = {
  history: 'From your hangar history',
  'scan-history': 'Price from your hangar history',
};
// The price a buy-back card or row shows: { text, title, est } or null.
function bbPriceData(b) {
  const d = bbDetail(b);
  if (d && d.price != null)
    return {
      text: money(d.price),
      title: BB_PRICE_TITLE[d.src] || 'Buy-back price on RSI',
      est: false,
    };
  if (b.price) return { text: String(b.price), title: '', est: false };
  const sp = buybackStorePrice(b);
  return sp
    ? {
        text: dollars(sp),
        title: "An estimate from today's store price. Load details for RSI's exact buy-back price.",
        est: true,
      }
    : null;
}

// --- Buy-Backs Market -------------------------------------------------------
// One row per buy-back: each is its own pledge (own insurance, own extras), so
// identical names are never merged. Like the Inventory Market: tick rows to
// total and export them; My Price / % (of the buy-back price) are saved
// alongside the Inventory ones under "bb:<id>".
const bbKey = (b) => `bb:${b.id}`;
function bbStoreText(b) {
  const sp = buybackStorePrice(b);
  return sp ? dollars(sp) : '';
}
// Store price minus RSI's real buy-back price (only once details are loaded).
// Ships and CCUs only: a pack's extras make a ship-price comparison misleading.
function bbVsStore(b) {
  if (!b.isCCU && b.kind !== 'ship') return null;
  const d = bbDetail(b);
  const sp = buybackStorePrice(b);
  return d && d.price != null && sp ? sp - d.price : null;
}
function bbVsStoreText(b) {
  const v = bbVsStore(b);
  if (v == null) return '';
  if (Math.abs(v) < 1) return 'Same';
  return v > 0 ? `Save ${dollars(v)}` : `${dollars(-v)} more`;
}
function bbPriceText(b) {
  const d = bbDetail(b);
  if (d && d.price != null) return money(d.price);
  if (b.price) return String(b.price);
  const sp = buybackStorePrice(b);
  return sp ? dollars(sp) : '';
}

// One row of the Buy-Backs Market (drawn by ui/buybacks/BbRow.svelte).
function bbRow(b) {
  const s = OH.shortBuybackName;
  const saved = state.market[bbKey(b)];
  const price = bbPrice(b);
  const vs = bbVsStore(b);
  return {
    id: String(b.id || ''),
    key: bbKey(b),
    melt: price ? price * fx.rate : '',
    ccu: b.ccu ? { from: s(b.ccu.from), to: s(b.ccu.to) } : null,
    name: buybackName(b),
    ins: bbInsurance(b),
    price: bbPriceData(b),
    store: bbStoreText(b),
    vs: bbVsStoreText(b),
    gain: vs != null && vs >= 1,
    mine: saved && saved.price != null ? String(saved.price) : '',
    picked: state.bbPicked.has(String(b.id)),
    reclaim: reclaimOf(b),
  };
}

// [{ section, groups }] per buy-back kind (groups = the buy-backs themselves),
// shared by the table and the CSV/image exports.
function bbMarketSections(list) {
  const buckets = new Map(BB_KINDS.map((k) => [k.key, []]));
  for (const b of list) (buckets.get(b.kind) || buckets.get('other')).push(b);
  return BB_KINDS.filter((k) => buckets.get(k.key).length).map((k) => ({
    section: k,
    groups: buckets.get(k.key),
  }));
}

// The Buy-Backs Market (ui/buybacks/BbMarket.svelte): one reclaim table per kind.
function bbMarketView(list) {
  return bbMarketSections(list).map(({ section, groups }) => ({
    key: section.key,
    label: section.label,
    rows: groups.map(bbRow),
  }));
}

// " · 3 picked · $420 · 3 tokens with store credit (you have 2)".
function bbSelText() {
  const picked = state.buybacks.filter((b) => state.bbPicked.has(String(b.id)));
  if (!picked.length) return ' · tick rows to total and export them';
  let total = 0;
  for (const b of picked) {
    const v = bbPrice(b);
    if (v) total += v;
  }
  const n = picked.length;
  const tokens =
    state.bbTokens != null
      ? ` · ${n} token${n === 1 ? '' : 's'} with store credit (you have ${state.bbTokens})`
      : '';
  return ` · ${n} picked · ${money(total)}${tokens}`;
}
// Exports cover the view, narrowed to the picked rows if any.
function bbExportSections() {
  const list = computeBuybacks();
  const picked = list.filter((b) => state.bbPicked.has(String(b.id)));
  return bbMarketSections(picked.length ? picked : list);
}
function bbMine(b) {
  const saved = state.market[bbKey(b)];
  return saved && saved.price != null ? saved.price : '';
}
function bbFilename(ext) {
  return marketFilename(ext).replace('sale-sheet', 'buy-backs');
}
function exportBuybackCsv(statusEl) {
  const sections = bbExportSections();
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export. Empty cargo hold.');
  const lines = [
    [
      'Category',
      'Item',
      'Insurance',
      'Buy-Back Price',
      'Store Price',
      'vs Store',
      '% of Price',
      'My Price',
    ],
  ];
  for (const { section, groups } of sections) {
    for (const b of groups) {
      const price = bbPrice(b);
      lines.push([
        section.label,
        bbFullName(b),
        bbInsurance(b),
        bbPriceText(b),
        bbStoreText(b),
        bbVsStoreText(b),
        pctOfMelt(bbMine(b), price ? price * fx.rate : 0),
        bbMine(b),
      ]);
    }
  }
  const csv = lines.map((r) => r.map(csvCell).join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), bbFilename('csv'));
  setExportStatus(statusEl, 'CSV saved. Spreadsheet pilots, rejoice.');
}
const BB_IMG_COLS = [
  { key: 'name', label: 'Items Name' },
  { key: 'ins', label: 'Insurance' },
  { key: 'melt', label: 'Buy-Back Price' },
  { key: 'store', label: 'Store Price' },
  { key: 'price', label: 'My Price' },
];
function bbImageCells(b) {
  const mine = bbMine(b);
  return {
    name: bbFullName(b),
    ins: bbInsurance(b),
    melt: bbPriceText(b) || '—',
    store: bbStoreText(b) || '—',
    vs: bbVsStoreText(b) || '—',
    price: mine !== '' ? rawMoney(priceNumber(mine) ?? 0) : '—',
  };
}
function copyBuybackImage(statusEl) {
  const sections = bbExportSections();
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export. Empty cargo hold.');
  const canvas = marketImageCanvas(sections, { cols: BB_IMG_COLS, cellsOf: bbImageCells });
  downloadImage(canvas, bbFilename('png'), statusEl);
}

// --- Events ---------------------------------------------------------------

// Typing waits for a short pause before redrawing, so a big list doesn't redraw on
// every letter.
const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
const renderInventorySoon = debounce(() => renderInventory());
const renderBuybacksSoon = debounce(() => renderBuybacks());
// --- Inventory: hover preview + click detail modal ------------------------
const itemPreview = $('#item-preview');
const itemPreviewImg = itemPreview ? itemPreview.querySelector('img') : null;
let previewId = null;

// Sharper versions of an RSI media thumbnail (store_small ≈ 350px), best first.
// Every RSI media image comes in named size variants in the SAME file type as
// the thumbnail (a .png thumb has source.png, not source.jpg). slideshow_wide
// (~1200px) is plenty for the modal/popup and a fraction of the 4K "source";
// source is the fallback. Non-RSI or already-large URLs have no candidates.
function hiResCandidates(url) {
  if (!url) return [];
  // The other RSI form (buy-backs, pledge contents): the size is a folder,
  // robertsspaceindustries.com/media/<id>/<variant>/<file>.
  const dir = url.match(
    /^(https:\/\/robertsspaceindustries\.com\/media\/[^/]+\/)([^/]+)(\/[^/?]+)(\?.*)?$/,
  );
  if (dir) {
    const [, base, variant, file, query = ''] = dir;
    if (/^(source|slideshow_wide|wallpaper_\d+x\d+)$/.test(variant)) return [];
    return ['slideshow_wide', 'source'].map((v) => `${base}${v}${file}${query}`);
  }
  if (!/media\.robertsspaceindustries\.com/.test(url)) return [];
  const m = url.match(/^(.*\/)([^/?]+)\.(\w+)(\?.*)?$/);
  if (!m) return [];
  const [, base, variant, ext, query = ''] = m;
  if (/^(source|slideshow_wide|wallpaper_\d+x\d+)$/.test(variant)) return [];
  return ['slideshow_wide', 'source'].map((v) => `${base}${v}.${ext}${query}`);
}

function hidePreview() {
  if (itemPreview) itemPreview.classList.remove('show');
  previewId = null;
}
function positionPreview(x, y) {
  if (!itemPreview) return;
  const pw = itemPreview.offsetWidth || 360;
  const ph = itemPreview.offsetHeight || 220;
  const pad = 16;
  let left = x + 22;
  let top = y + 22;
  if (left + pw > window.innerWidth - pad) left = x - pw - 22;
  if (top + ph > window.innerHeight - pad) top = window.innerHeight - ph - pad;
  if (top < pad) top = pad;
  itemPreview.style.left = left + 'px';
  itemPreview.style.top = top + 'px';
}
const loadImage = (src) =>
  new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });

// Each thumbnail's sharp version is resolved at most once and shared:
// Map<thumb, Promise<url|null>> — the first candidate that loads (now in the
// browser cache), or null to keep the thumbnail.
const hiResLoads = new Map();
function loadHiRes(thumb) {
  if (!hiResLoads.has(thumb)) {
    hiResLoads.set(
      thumb,
      (async () => {
        for (const url of hiResCandidates(thumb)) if (await loadImage(url)) return url;
        return null;
      })(),
    );
  }
  return hiResLoads.get(thumb);
}

// Show `thumb` in <img> right away (already cached from the card, so it's
// instant and sharp enough), then quietly swap in the sharper copy once loaded.
function progressiveImage(imgEl, thumb, isCurrent = () => imgEl.isConnected) {
  imgEl.src = thumb;
  if (!hiResCandidates(thumb).length) return;
  loadHiRes(thumb).then((hi) => {
    if (hi && isCurrent()) imgEl.src = hi;
  });
}

// Hover preview for reward items (ship art) — these are text links with no
// picture, so the popup is the only way to see the ship. Keyed on the item's
// resolve name since they have no id. (Listeners attach near referralsBodyEl.)
function onRewardHover(e) {
  // Reward links (ship art) and the ladder dots (each tier's reward picture).
  const item = e.target.closest('.reward-item.ship[data-image], .rt-step[data-image]');
  const img = item && item.dataset.image;
  if (!img) {
    if (previewId) hidePreview();
    return;
  }
  const dot = item.classList.contains('rt-step');
  const key = dot ? 'dot:' + item.dataset.tip : 'reward:' + item.dataset.resolve;
  if (key !== previewId && itemPreviewImg) {
    previewId = key;
    const cap = itemPreview.querySelector('.ip-cap');
    if (cap) {
      cap.textContent = dot ? item.dataset.tip : '';
      cap.hidden = !dot;
    }
    itemPreview.classList.add('show');
    progressiveImage(itemPreviewImg, img, () => previewId === key);
  }
  positionPreview(e.clientX, e.clientY);
}

function fmtScan() {
  return state.scannedAt ? new Date(state.scannedAt).toLocaleString() : '—';
}
// "Store price" row in the item modal: the ships' current price, the gap to
// what was paid, and per-ship prices when there's more than one.
function storeRow(p, row) {
  const si = storeInfo(p);
  if (!si || !si.store) return '';
  let v = dollars(si.store) + (si.ccu ? ' standard' : '');
  if (si.unpriced) v += ` + ${si.unpriced} unpriced`;
  else if (si.paid != null && si.paid > 0) {
    const d = si.store - si.paid;
    if (d >= 1) v += ` <span class="gain">(paid ${dollars(d)} less)</span>`;
    else if (d <= -1) v += ` <span class="muted">(paid ${dollars(-d)} more — likely extras)</span>`;
  }
  const parts = si.ccu
    ? `<div class="mr-sub">${dollars(si.from)} → ${dollars(si.to)} ships</div>`
    : si.ships.length > 1
      ? `<div class="mr-sub">${si.ships
          .map((x) => `${OH.escapeHtml(x.label)} ${x.msrp ? dollars(x.msrp) : '—'}`)
          .join(' · ')}</div>`
      : '';
  return row('Store price', v + parts);
}

// RSI has no per-pledge address, and its hangar always shows 10 per page
// (a smaller page size is ignored), so link the page the pledge is on and say
// where on it: "page 4, #3". Positions are from the last scan (newest first),
// so they shift after buying or melting until the next scan.
const RSI_PAGE = 10;
let hangarPos = null;
function hangarSpot(p) {
  if (!hangarPos || hangarPos.items !== state.items) {
    hangarPos = { items: state.items, at: new Map(state.items.map((x, i) => [String(x.id), i])) };
  }
  const i = hangarPos.at.get(String(p.id));
  if (i == null) return null;
  const page = Math.floor(i / RSI_PAGE) + 1;
  return {
    page,
    pos: (i % RSI_PAGE) + 1,
    url: `https://robertsspaceindustries.com/account/pledges?page=${page}`,
  };
}
function viewOnRsiLink(p) {
  const s = hangarSpot(p);
  if (!s) return '';
  return `<a class="bb-reclaim" href="${OH.escapeHtml(s.url)}" target="_blank" rel="noopener" title="Opens page ${s.page} of your RSI hangar; it's number ${s.pos} on that page (as of your last scan)">View ↗</a>`;
}

// A pledge item's type. RSI leaves some blank (armor pieces, hangars), so
// infer those from the name: helmet/core/arms/legs/backpack… are Gear.
const GEAR_RE =
  /\b(helmet|core|arms|legs|backpack|undersuit|armou?r|jacket|shirt|pants|boots|gloves|hat)\b/i;
function contentKind(c) {
  if (c.kind) return c.kind;
  const l = c.label || '';
  if (LAND_CLAIM_RE.test(l)) return 'Land Claim';
  if (/\bhangar\b/i.test(l)) return 'Hangar';
  if (GEAR_RE.test(l)) return 'Gear';
  return '—';
}

// --- Detail windows ---------------------------------------------------------
// The pledge, buy-back and ship windows are Svelte (ui/details: one window, and the
// full-size picture viewer on top of it). These open or close it; it reads what to
// show from window.OHApp.detail (itemView, bbView and shipView below), redrawing
// whenever the data changes.
function openDetail(what) {
  hidePreview();
  document.dispatchEvent(new CustomEvent('oh:detail', { detail: what }));
}
function openItemModal(p) {
  openDetail({ kind: 'item', item: p });
}
function openBuybackModal(b) {
  openDetail({ kind: 'bb', item: b });
}
function closeItemModal() {
  openDetail(null);
}

// A pledge's window: its facts, store price, where it is on RSI, what's inside.
function itemView(p) {
  const type = pledgeType(p);
  // "Store price": the ships' current price, the gap to what was paid, and per-ship
  // prices when there's more than one.
  const si = storeInfo(p);
  let store = null;
  if (si && si.store) {
    store = { text: dollars(si.store) + (si.ccu ? ' standard' : ''), note: null, sub: '' };
    if (si.unpriced) store.text += ` + ${si.unpriced} unpriced`;
    else if (si.paid != null && si.paid > 0) {
      const d = si.store - si.paid;
      if (d >= 1) store.note = { text: `(paid ${dollars(d)} less)`, cls: 'gain' };
      else if (d <= -1)
        store.note = { text: `(paid ${dollars(-d)} more, likely extras)`, cls: 'muted' };
    }
    store.sub = si.ccu
      ? `${dollars(si.from)} → ${dollars(si.to)} ships`
      : si.ships.length > 1
        ? si.ships.map((x) => `${x.label} ${x.msrp ? dollars(x.msrp) : '—'}`).join(' · ')
        : '';
  }
  const spot = hangarSpot(p);
  return {
    name: plainName(p),
    type,
    badge: TYPE_KEYS.includes(type) ? type : '',
    value: formatValue(p),
    id: p.id || '—',
    date: p.date || '',
    giftable: !!p.giftable,
    meltable: p.meltable,
    store,
    currency: p.currency || '',
    upgrade: p.isCCU && p.ccu ? `${p.ccu.from} → ${p.ccu.to}` : '',
    // RSI has no per-pledge address: link the page it's on and say where on it.
    spot: spot && {
      url: spot.url,
      title: `Opens page ${spot.page} of your RSI hangar; it's number ${spot.pos} on that page (as of your last scan)`,
    },
    // Melt on RSI (#403): the same hangar page, behind an in-window confirm with
    // what melting means. We never melt anything; RSI's own button does. Left out
    // when RSI showed no melt button for it.
    melt:
      spot && p.meltable !== false
        ? (() => {
            const f = OH.meltFacts(p);
            return {
              url: spot.url,
              page: spot.page,
              pos: spot.pos,
              reason: f.block ? OH.BUYBACK_BLOCK_REASONS[f.block] : '',
              lines: f.lines,
            };
          })()
        : null,
    scanned: fmtScan(),
    contents: (p.contents || []).map((c) => ({
      kind: contentKind(c),
      label: c.label || '',
      ship: /^ship$/i.test(c.kind || '') && !!c.label,
    })),
    // RSI's art, except a CCU shows the ship it upgrades to.
    art: {
      real: realImage(p.image),
      resolve: resolveImageName(p),
      preferShip: !!(p.isCCU && !p.shipArt),
      placeholder: p.kind || '',
    },
  };
}

// A buy-back's window. What's inside comes from its own RSI page, read when the
// window opens (one page, because someone asked) and kept.
function bbView(b) {
  const d = bbDetail(b);
  const shipish = b.ccu || ['ship', 'pack', 'package'].includes(b.kind);
  return {
    name: b.ccu ? `${b.ccu.from} → ${b.ccu.to}` : b.name || '—',
    badge: {
      cls: b.isCCU ? 'ccu' : TYPE_KEYS.includes(b.kind) ? b.kind : '',
      text: b.isCCU ? 'CCU' : b.kind || 'buy-back',
    },
    price: bbPriceData(b),
    upgrade: b.ccu ? `${b.ccu.from} → ${b.ccu.to}` : '',
    insurance: b.isCCU ? '' : bbInsurance(b),
    date: b.date || '',
    id: b.id ? String(b.id) : '',
    reclaim: reclaimOf(b),
    // Can't Be Bought Back (#403): the reason, shown under the Reclaim row.
    block: (() => {
      const k = OH.buybackBlock(b, d);
      return k ? OH.BUYBACK_BLOCK_REASONS[k] : '';
    })(),
    // Next to the price: a buy-back never keeps a sale price or a coupon (#403).
    priceNote: b.isCCU
      ? "A buy-back upgrade costs today's upgrade price, not what you paid."
      : "Buy-backs cost full price: sale prices and subscriber coupons don't carry over.",
    contents:
      d && !d.partial
        ? {
            ships: d.ships.map((x) => ({
              name: x.name,
              sub: [x.manufacturer, x.focus].filter(Boolean).join(' · '),
            })),
            also: d.also,
          }
        : null,
    canLoad: bbNeedsRead(b) && !b.isCCU && /^\d+$/.test(String(b.id)),
    // Add to RSI Cart (#288): a buy-back upgrade whose button carried both ships.
    cart: bbCartOf(b),
    // Filled from this browser instead of RSI's page: the small print says so.
    source: (d && BB_SOURCE_NOTE[d.src]) || '',
    art: {
      real: realImage(b.image),
      resolve: b.ccu && b.ccu.to ? b.ccu.to : shipish ? b.name : '',
      preferShip: !!b.ccu && !b.shipArt,
      placeholder: 'Buy-Back',
    },
  };
}
// A buy-back upgrade RSI can put back in the cart: its pledge id and the from/to
// ship and SKU ids from its buy-back button (parser.js). null for anything else,
// A retired ship (#306) keeps the button: RSI still sells its buy-backs back, and
// `retired` words a refusal if RSI has closed it since.
function bbCartOf(b) {
  if (!b || !b.isCCU || !b.ccu || OH.buybackBlock(b)) return null;
  const n = (v) => (/^\d+$/.test(String(v || '')) ? Number(v) : null);
  const [pledgeId, fromShipId, toShipId, toSkuId] = [b.id, b.fromShipId, b.toShipId, b.toSkuId].map(
    n,
  );
  if (!pledgeId || !fromShipId || !toShipId || !toSkuId) return null;
  return {
    pledgeId,
    retired: !!OH.retiredBuyback(b),
    from: { id: fromShipId, name: b.ccu.from },
    target: { toShipId, toSkuId, name: b.ccu.to },
  };
}
// Fills buy-back details from your own hangar history (OH.fillBuybackDetailsFromHistory:
// the pledge archive, then the scan history; no RSI requests), so RSI's pages are
// only read for what's left. Never stops a scan or the page from loading.
async function fillBbFromHistory() {
  try {
    await OH.fillBuybackDetailsFromHistory(state.buybacks, { history: state.history });
    state.bbDetails = { ...(await OH.getBuybackDetails()) };
  } catch (e) {
    OH.log('warn', 'buybacks', `details from history failed: ${e?.message || e}`);
  }
}
// Reads a buy-back's page for its window: null when done, else what went wrong.
async function loadBbContents(b) {
  const r = await OH.fetchBuybackDetail(String(b.id));
  if (r.error) return r.error;
  state.bbDetails = { ...(await OH.getBuybackDetails()) };
  if (currentView() === 'buybacks') renderBuybacks();
  homeUpdated();
  return null;
}

// Keyboard: Enter or Space on a clickable card or row that isn't a real button or
// link (Inventory and Buy-Back cards, Stats rows) does what a click does. Like a real
// button, Enter fires on the way down and Space on the way up (so the pop-up it opens
// doesn't catch the same Space on its Close button).
const kbdClickable = (el) =>
  el instanceof HTMLElement &&
  el.matches('.card[tabindex], [role="button"]:not(button, a, input, select, textarea)');
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.altKey || e.ctrlKey || e.metaKey || !kbdClickable(e.target)) return;
  e.preventDefault(); // Space would scroll the page
  if (e.key === 'Enter' && !e.repeat) e.target.click();
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && kbdClickable(e.target)) e.target.click();
});

// Referral list tab switching (Recruits / Prospects) + reward-item hover preview.
const referralsBodyEl = $('#referrals-body');
// The Referrals page itself is Svelte (ui/referrals); the reward hover preview stays here.
if (referralsBodyEl) {
  referralsBodyEl.addEventListener('mousemove', onRewardHover);
  referralsBodyEl.addEventListener('mouseleave', hidePreview);
}

// Inventory / Buy-Backs pass: switches, Clear filters, Below store price, saved
// views and the Export ▾ menus.
document.addEventListener('click', (e) => {
  const t = e.target;
  const sw = t.closest('[data-switch]');
  if (sw) {
    const k = sw.dataset.switch;
    if (k === 'inv-hide') {
      state.hideSmall = !state.hideSmall;
      chrome.storage.local.set({ hideSmallInv: state.hideSmall });
      return renderInventory();
    }
    if (k === 'bb-hide') {
      state.bbHideSmall = !state.bbHideSmall;
      chrome.storage.local.set({ hideSmallBb: state.bbHideSmall });
    } else if (k === 'bb-stack') {
      state.bbStack = !state.bbStack;
      chrome.storage.local.set({ bbStack: state.bbStack });
    }
    return renderBuybacks();
  }
  const apply = t.closest('[data-view-apply]');
  if (apply) {
    const v = state.savedViews[+apply.dataset.viewApply];
    if (!v) return;
    state.shown = new Set(v.f.shown);
    state.traits = invTraitsFrom(v.f.traits);
    state.meltMax = Number.isFinite(v.f.meltMax) ? v.f.meltMax : null;
    state.query = v.f.query || '';
    state.hideSmall = !!v.f.hideSmall;
    return renderInventory();
  }
  const del = t.closest('[data-view-del]');
  if (del) {
    state.savedViews.splice(+del.dataset.viewDel, 1);
    saveViews();
    return renderInventory();
  }
  if (t.closest('[data-view-save]')) {
    const name = (prompt('Name this view (for example "Giftable ships")') || '').trim();
    if (!name) return;
    state.savedViews.push({ name: name.slice(0, 40), f: currentView_inv() });
    saveViews();
    return renderInventory();
  }
  const ex = t.closest('[data-export]');
  if (ex) {
    closeCardMenus();
    const act = ex.dataset.export;
    if (act === 'inv-csv') exportMarketCsv($('#sb-status'));
    else if (act === 'inv-image') setSelecting(true);
    else if (act === 'bb-csv') exportBuybackCsv(null);
    else if (act === 'backup') $('#export-db')?.click();
  }
});

// Buy-Backs opened from a Hangar Alert: Show all clears the filter.
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-bb-all]')) return;
  state.bbOnly = null;
  renderBuybacks();
});

// The automatic buy-back pack read after a scan reads at most this many pages.
const BB_AUTO_MAX = 30;

// Scan a chosen set of sources. Each is independent and persisted on its own, so
// a partial scan (e.g. just referrals) refreshes only those and leaves the rest
// of your data untouched; a failure in one still keeps the others' results.
async function runScan({ hangar = true, buybacks = true, referrals = true, store = true } = {}) {
  if (!hangar && !buybacks && !referrals && !store) return;
  topBar.busy = true;
  topBar.report = null;
  scanProgress.i = 0;
  scanProgress.n = [hangar, buybacks, referrals, store].filter(Boolean).length || 1;
  setScanning('Scanning…');
  scanDetail(OH.quip('scan'));
  const parts = [];
  let anyErr = false;
  // One account lookup for the whole scan; every save reuses it (each lookup is
  // two RSI requests once the 10-minute cache runs out). If it fails, each save
  // looks it up itself, as before.
  const account =
    (hangar || buybacks || referrals ? await OH.getAccount().catch(() => null) : null) || undefined;
  // Signed out of RSI: its signed-out pages can read as an empty hangar or buy-back
  // list, and a complete scan of nothing would be saved over your data. Skip what
  // needs your account (the store check still runs) and say so.
  const signedOut = account?.loggedIn === false && (hangar || buybacks || referrals);
  if (signedOut) {
    hangar = buybacks = referrals = false;
    parts.push("You're not logged in to RSI, so we can't see inside your hangar");
    anyErr = true;
  }
  // One row per source for the scan report: what came home, or what went wrong.
  const rows = [];

  if (hangar) {
    const h = await OH.scanSource(
      'hangar',
      (page, c, retry) => {
        setScanning(retry ? `hangar… retrying` : `hangar… ${c}`);
        scanDetail(
          retry
            ? `Inventory · RSI hiccup on page ${page}, retrying (${retry.attempt}/${retry.of})`
            : `Inventory · page ${page} · ${c} items`,
        );
      },
      { account },
    );
    if (h.ok) {
      state.items = h.items;
      state.scannedAt = h.scannedAt;
      state.history = await OH.getHistory();
      // Same hangar as before (#294): your selection and filters still fit, keep them.
      if (!h.unchanged) {
        state.selected.clear();
        state.shown = new Set(); // default: no filter selected = show all
        state.traits = new Map();
        state.meltMax = null;
      }
      if (account?.loggedIn && account.nickname) {
        state.owner = { nickname: account.nickname, displayname: account.displayname || null };
      }
      const text = h.unchanged
        ? `${h.items.length} pledges (hangar's exactly how you left it)`
        : `${h.items.length} pledges${h.partial ? ` (partial: ${h.partial})` : ''}`;
      parts.push(text);
      rows.push({ name: 'Hangar', ok: !h.partial, text });
      if (h.partial) anyErr = true;
    } else {
      parts.push(`hangar: ${h.error}`);
      rows.push({ name: 'Hangar', ok: false, text: h.error });
      anyErr = true;
    }
  }

  if (hangar) scanProgress.i++;
  if (buybacks) {
    const b = await OH.scanSource(
      'buybacks',
      (page, c, retry) => {
        setScanning(retry ? `buy-backs… retrying` : `buy-backs… ${c}`);
        scanDetail(
          retry
            ? `Buy-backs · RSI hiccup on page ${page}, retrying (${retry.attempt}/${retry.of})`
            : `Buy-backs · page ${page} · ${c} items`,
        );
      },
      { account },
    );
    if (b.ok) {
      state.buybacks = b.items;
      state.buybacksScannedAt = b.scannedAt;
      await fillBbFromHistory();
      state.bbShown = new Set(); // default: no filter selected = show all
      state.bbTraits = new Map();
      state.bbPriceMax = null;
      const text = `${b.items.length} buy-backs${b.partial ? ` (partial: ${b.partial})` : ''}`;
      parts.push(text);
      rows.push({ name: 'Buy-Backs', ok: !b.partial, text });
      if (b.partial) anyErr = true;
    } else {
      parts.push(`buy-backs: ${b.error}`);
      rows.push({ name: 'Buy-Backs', ok: false, text: b.error });
      anyErr = true;
    }
  }

  // Referrals — separate source (GraphQL, not in OH.SOURCES).
  if (buybacks) scanProgress.i++;
  if (referrals) {
    const r = await OH.getReferral(
      (phase, n) => {
        setScanning(`referrals ${phase}… ${n}`);
        scanDetail(`Referrals · ${phase} · ${n}`);
      },
      { account },
    );
    if (r?.ok) {
      state.referral = r.referral;
      const text = `${r.referral.legacy?.recruits ?? 0} recruits${r.partial ? ` (kept last scan's ${r.partial}: RSI didn't answer)` : ''}`;
      parts.push(text);
      rows.push({ name: 'Referrals', ok: !r.partial, text });
      if (r.partial) anyErr = true;
    } else if (r) {
      parts.push(`referrals: ${r.error}`);
      rows.push({ name: 'Referrals', ok: false, text: r.error });
      anyErr = true;
    }
  }

  // Store: read the store catalog again (one request) and check your wishlist
  // against it; Home's Wishlist Watch shows this check.
  if (store && state.wishlist.length) {
    if (referrals) scanProgress.i++;
    setScanning('store');
    scanDetail('Store · checking your wishlist');
    const n = await checkWishlistNow();
    const text =
      n == null
        ? 'store list still on its way, checked next time'
        : `${n} wishlist item${n === 1 ? '' : 's'} on sale`;
    parts.push(text);
    rows.push({ name: 'Store', ok: true, text });
  }

  const summary = parts.join(' · ') || 'Nothing scanned';
  // The counts are already on Home (the summary boxes), so only a problem is
  // spelled out: in the scan report under the Scan button, on every page. The
  // button carries the full recap on hover.
  scanDetail('');
  setStatus('');
  if (anyErr) {
    const bad = rows.filter((x) => !x.ok).length;
    topBar.report = {
      kind: signedOut ? 'out' : bad && bad === rows.length ? 'none' : 'part',
      rows: signedOut ? [] : rows,
      bad,
      summary,
      last: state.scannedAt ? fmtDay(state.scannedAt) : '',
      n: Date.now(), // a new report, so the top bar opens it
    };
    OH.log('error', 'status', summary);
  }
  // @sync-start
  // Connected: every finished scan syncs by itself, as the Scan button's last step
  // ("Syncing to Website…"; owner, 2026-10-05). The server refuses an empty or older
  // hangar, so this can't wipe one; a refusal shows in the scan report. It sends
  // nothing while the website asked to wait, or for an account this link hasn't
  // synced before you say yes (OH.siteSync).
  if (site.link && !signedOut) {
    await siteSyncNow({
      scan: true,
      onSend: () => {
        scanProgress.i = scanProgress.n;
        setScanning('Sending this scan to openhangar.space', false, 'Syncing to Website…');
      },
    });
  }
  // @sync-end
  setScanning(`${anyErr ? '⚠ ' : '✓ '}${summary}`, true);
  route();
  renderAccount(); // refresh the Citizen Card pill with the new referral counts
  renderSiteNotice();
  if (hangar) warmPictures(computeShown(), state.layout);
  if (buybacks) warmPictures(computeBuybacks(), state.bbLayout);
  topBar.busy = false;
  homeUpdated(); // the welcome card and the top bar follow topBar.busy
  // Buy-back packs whose contents we've never read get read now, in the background
  // and paced like Get Details (owner, 2026-10-06: fully automatic). Only the
  // never-read ones, so after the first time it's usually none, and only after a
  // buy-back scan that worked. The scan itself is already done: it stays as fast.
  // Packs filled from your own hangar history (at the buy-back scan above) are
  // skipped, and at most BB_AUTO_MAX are read per scan: the rest wait for the next.
  const unreadPack = (b) =>
    !b.isCCU && bbNeedsRead(b) && (b.kind === 'pack' || b.kind === 'package');
  const bbRead = rows.some((x) => x.name === 'Buy-Backs' && x.ok);
  if (bbRead && !bbLoading && state.buybacks.some(unreadPack))
    loadBuybackDetails({ packsOnly: true, max: BB_AUTO_MAX });
  // Your Subscriber Store's once-a-day read, after the scan (never part of it).
  if (!signedOut) loadSubStore();
}

// The top bar's Scan runs what's ticked in its ▾ menu: "Scan All" by default,
// "Scan Custom" once anything is unticked (owner, 2026-09-30). Remembered.
function scanChoice() {
  const on = new Set(topBar.sources);
  return Object.fromEntries(SCAN_SOURCES.map((k) => [k, on.has(k)]));
}
function setScanSources(list) {
  topBar.sources = SCAN_SOURCES.filter((k) => list.includes(k));
  chrome.storage.local.set({ scanSources: topBar.sources });
  homeUpdated();
}
function scanChosen() {
  const c = scanChoice();
  if (!Object.values(c).some(Boolean)) {
    setStatus('Nothing ticked, nothing to scan. Pick at least one with the ▾ next to Scan.', true);
    return;
  }
  closeCardMenus();
  runScan(c);
}
chrome.storage.local.get('scanSources').then(({ scanSources }) => {
  if (Array.isArray(scanSources)) {
    topBar.sources = SCAN_SOURCES.filter((k) => scanSources.includes(k));
  }
  homeUpdated();
});

// The top bar's menus (Scan options, Hangar Alerts, your menu) are Svelte
// (ui/topbar/menus.svelte.js); this closes whichever one is open.
function closeCardMenus() {
  document.dispatchEvent(new CustomEvent('oh:close-menus'));
}

// Your menu → Log Out of RSI: only clears RSI's cookies, the saved data stays.
async function logOut() {
  topBar.loggingOut = true;
  homeUpdated();
  setStatus('Signing out of RSI…');
  const res = await OH.logout();
  if (!res.ok) {
    setStatus(
      res.error || 'Couldn’t sign out of RSI. Try again, or log out on robertsspaceindustries.com.',
      true,
    );
  } else {
    await OH.getAccount({ force: true }); // refresh the now signed-out state
    setStatus(`Signed out of RSI. ${OH.quip('signedOut')}`);
    renderHome(); // flips the card to the signed-out wall
  }
  topBar.loggingOut = false;
  homeUpdated();
}

// Your menu → Clear Data.
// Asked first in your menu (YouMenu.svelte), so no browser confirm box here.
async function clearData() {
  await OH.clearData();
  state.items = [];
  state.scannedAt = null;
  state.history = [];
  state.selected.clear();
  state.buybacks = [];
  state.buybacksScannedAt = null;
  state.owner = null;
  state.shown = new Set();
  state.traits = new Map();
  state.meltMax = null;
  state.bbShown = new Set();
  state.bbTraits = new Map();
  state.bbPriceMax = null;
  state.referral = null;
  subStore.list = null;
  setStatus('Local data cleared. Clean hangar, fresh start.');
  renderAccount(); // clear the referral pill too
  refreshRecoveryUI(); // a full manual wipe also drops any recovery snapshot
  route();
}

// --- Developers: export / import -----------------------------------------
// The page is Svelte (ui/developers, mounted into #view-developers). These are its
// actions, published on window.OHApp.dev; the note under the buttons, the restore
// button and the saved accounts live in `dev` so a redraw ('oh:home') shows them.
const dev = { msg: '', msgError: false, recovery: false, profiles: null };

function setDataMsg(text, isError = false) {
  dev.msg = text;
  dev.msgError = isError;
  if (isError) OH.log('error', 'data', text);
  homeUpdated();
}

// Show the "Restore previous hangar" button only when an auto-cleared snapshot
// exists (i.e. a different RSI account triggered a backup-and-clear).
async function refreshRecoveryUI() {
  dev.recovery = !!(await OH.getRecovery());
  homeUpdated();
}

async function restoreBackup() {
  const db = await OH.recoverData();
  if (!db) {
    dev.recovery = false;
    setDataMsg('Nothing to restore. That hangar’s already clean.', true);
    return;
  }
  // Reload from the restored DB via the normal init path — guarantees state,
  // pills, and views all reflect the recovered data consistently.
  location.reload();
}

const sourceItemCount = (sources) =>
  Object.values(sources || {}).reduce(
    (s, src) => s + (Array.isArray(src.items) ? src.items.length : 0),
    0,
  );

// Download the whole DB (scans + history) as a JSON backup and remember when,
// so the History tab can nudge people whose last backup is old or missing.
async function downloadBackup() {
  const data = await OH.exportDB();
  const who = data.account?.handle ? `-${data.account.handle}` : '';
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `open-hangar${who}-${date}.json`,
  );
  state.lastBackupAt = Date.now();
  chrome.storage.local.set({ lastBackupAt: state.lastBackupAt });
  return data;
}

// Developers → Export JSON (#export-db; the card menus' Backup item clicks it too).
async function exportJson() {
  const data = await downloadBackup();
  setDataMsg(
    `Exported ${sourceItemCount(data.sources)} item(s) and ${data.history.length} history snapshot(s).`,
  );
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-backup]')) return;
  await downloadBackup();
  if (currentView() === 'stats') renderStats();
});

// Hangar Transfer Format: ships only, one entry per ship, the file community
// fleet tools read. No tool is named (owner, 2026-10-07).
async function exportHtf() {
  const { ships, unmatched } = await OH.exportHTF();
  if (!ships.length) {
    setDataMsg('No ships to export yet. Scan your hangar first.');
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([JSON.stringify(ships, null, 2)], { type: 'application/json' }),
    `open-hangar-htf-${(state.owner && state.owner.nickname) || 'me'}-${date}.json`.replace(
      /[^\w.-]+/g,
      '_',
    ),
  );
  setDataMsg(
    `Exported ${ships.length} ship(s) in Hangar Transfer Format` +
      (unmatched ? ` · ${unmatched} without a ship code (kept by name)` : '') +
      '. Import it into any fleet tool that reads HTF.',
  );
}

// Developers → Import JSON: the file picked in #import-file (the damaged-database
// notice's Restore button opens that picker too).
async function importBackup(file) {
  if (!file) return;
  if (
    (state.items.length || state.scannedAt) &&
    !confirm(
      'Importing replaces your current data. Your scan history is kept and merged with the file’s. Continue?',
    )
  )
    return;
  let obj;
  try {
    obj = JSON.parse(await file.text());
  } catch {
    setDataMsg('That file isn’t valid JSON. Is it really an Open Hangar backup?', true);
    return;
  }
  const res = await OH.importDB(obj);
  if (!res.ok) {
    setDataMsg(res.error, true);
    return;
  }
  const hangar = res.db.sources.hangar || { items: [], scannedAt: null };
  state.items = hangar.items || [];
  state.scannedAt = hangar.scannedAt || null;
  state.history = Array.isArray(res.db.history) ? res.db.history : [];
  state.selected.clear();
  const bb = res.db.sources.buybacks || { items: [], scannedAt: null };
  state.buybacks = bb.items || [];
  state.buybacksScannedAt = bb.scannedAt || null;
  const refSrc = res.db.sources.referral;
  state.referral =
    refSrc && refSrc.items && !Array.isArray(refSrc.items)
      ? OH.normalizeReferral(refSrc.items)
      : null;
  // A backup isn't attributed to an account; the website's file is (see importDB).
  state.owner = res.db.owner || null;
  await OH.dismissDamaged(); // restored from a backup: the damage notice has done its job
  renderDbNotice();
  state.shown = new Set(); // default: no filter selected = show all
  state.traits = new Map();
  state.meltMax = null;
  state.bbShown = new Set(); // default: no filter selected = show all
  state.bbTraits = new Map();
  state.bbPriceMax = null;
  renderAccount(); // reflect imported referral in the pill
  const count = sourceItemCount(res.db.sources);
  if (res.site) {
    renderProfiles(); // parked accounts show under Saved Accounts
    const others = res.site.parked;
    setDataMsg(
      others.length
        ? `Imported ${others.length + 1} RSI accounts from your website data. ${res.site.live} is loaded (${count} item(s)). ${listNames(others)} ${others.length > 1 ? 'are' : 'is'} under Saved Accounts and load when you sign in as them.`
        : `Imported ${count} item(s) for ${res.site.live} from your website data. Open Inventory, Buy-Backs or Stats to view.`,
    );
    return;
  }
  setDataMsg(`Imported ${count} item(s). Open Inventory, Buy-Backs or Stats to view.`);
}
// ["A", "B", "C"] → "A, B and C".
function listNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '';
}

// Fill `state` from a stored DB (init, account switches, restores).
function loadStateFromDB(db) {
  const hangar = db.sources.hangar || { items: [], scannedAt: null };
  state.items = hangar.items || [];
  state.scannedAt = hangar.scannedAt || null;
  state.history = Array.isArray(db.history) ? db.history : [];
  const buybacks = db.sources.buybacks || { items: [], scannedAt: null };
  // Re-sort with today's rules (older scans stored older kinds, e.g. add-ons
  // filed under ships).
  state.buybacks = (buybacks.items || []).map((b) => ({
    ...b,
    kind: window.OpenHangar.classifyBuyback(b.name, b.contains),
  }));
  state.buybacksScannedAt = buybacks.scannedAt || null;
  state.bbTokens =
    buybacks.meta && Number.isFinite(buybacks.meta.tokens) ? buybacks.meta.tokens : null;
  const referral = db.sources.referral;
  state.referral =
    referral && referral.items && !Array.isArray(referral.items)
      ? OH.normalizeReferral(referral.items)
      : null;
  state.owner = db.owner || null;
  state.selected.clear();
  state.shown = new Set();
  state.traits = new Map();
  state.meltMax = null;
  state.bbShown = new Set();
  state.bbTraits = new Map();
  state.bbPriceMax = null;
}

// Multi-account: force a fresh read of the signed-in RSI account (the cache could
// still hold the previous user). If it's a *different* account from the stored
// data, park the current data under its owner and load the new account's saved
// scans (OH.switchProfile), so alts never wipe each other. Returns a notice or ''.
async function reconcileAccount() {
  let acct;
  try {
    acct = await OH.getAccount({ force: true });
  } catch {
    return ''; // offline / can't determine: keep showing what we have
  }
  if (
    acct.loggedIn &&
    acct.nickname &&
    state.owner &&
    acct.nickname.toLowerCase() !== String(state.owner.nickname || '').toLowerCase()
  ) {
    const who = acct.displayname || acct.nickname;
    const { restored, parked } = await OH.switchProfile(acct.nickname, acct.displayname);
    loadStateFromDB(await OH.loadDB());
    await OH.getAccount({ force: true }); // re-cache the new account
    renderAccount();
    const kept = parked
      ? ` ${parked}'s hangar is parked safely and comes back when you sign in as them.`
      : '';
    return restored
      ? `Welcome back, ${who}: your last scan is loaded.${kept}`
      : `Switched to ${who}. Hit Scan to load this hangar.${kept}`;
  }
  return '';
}

// Developers → Saved accounts: every account with data in this browser. Loads the
// list for ui/developers and tells it to redraw.
async function renderProfiles() {
  dev.profiles = await OH.listProfiles();
  homeUpdated();
}
async function removeProfile(nick) {
  if (!confirm(`Remove the saved data for ${nick} from this browser?`)) return;
  await OH.deleteProfile(nick);
  renderProfiles();
}

// Returning to the tab (e.g. after logging in/out on RSI in another tab)
// re-checks the account so the UI reflects it without a manual reload. Debounced
// so rapid tab-switching doesn't refetch repeatedly.
let lastFocusCheck = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  if (topBar.busy) return; // mid-scan: switching accounts now would race the scan's saves
  const now = Date.now();
  if (now - lastFocusCheck < 3000) return;
  lastFocusCheck = now;
  const notice = await reconcileAccount();
  if (currentView() === 'home') renderHome();
  if (notice) setStatus(notice);
});

// --- Updates ----------------------------------------------------------------
// The Updates page reads the CHANGELOG.md that ships in the extension (see
// scripts/pack.mjs). The background worker sets `updateReady` when a new
// version is waiting and `justUpdated` right after one installs.
let changelog = null;
async function loadChangelog() {
  if (!changelog) {
    try {
      const res = await fetch(chrome.runtime.getURL('CHANGELOG.md'));
      changelog = res.ok ? OH.parseChangelog(await res.text()) : [];
    } catch {
      changelog = [];
    }
  }
  return changelog;
}

// Updates page: "Check for Updates" (ui/updates/Updates.svelte shows the result).
// Chrome and Edge can ask their store right now (a found update downloads, then
// the Reload bar appears); Firefox can't, so it reads the version Firefox Add-ons
// has live from our own site's openhangar.space/versions.json (stores.firefox.live,
// OH.getStoreVersions) and compares. Resolves to the line to show under the button.
async function checkForUpdates() {
  const cur = chrome.runtime.getManifest().version;
  // Looked up by name so Firefox's linter doesn't flag it (see initUpdates).
  const check = chrome.runtime[['request', 'Update', 'Check'].join('')];
  if (typeof check !== 'function') {
    try {
      const feed = await OH.getStoreVersions({ force: true });
      const live = feed && feed.data.stores && feed.data.stores.firefox;
      const latest = live && typeof live.live === 'string' ? live.live : null;
      if (!latest || !/^\d+(\.\d+)*$/.test(latest)) throw new Error('no version');
      chrome.storage.local.set({ lastUpdateCheck: Date.now() });
      return OH.compareVersions(latest, cur) > 0
        ? `Open Hangar ${latest} is out. Firefox installs it on its own within a day, or get it now: about:addons, gear icon, Check for Updates.`
        : 'You’re on the latest version. Fly safe.';
    } catch {
      return 'The version check is still in the comm queue. Try again in a bit.';
    }
  }
  try {
    const r = await check.call(chrome.runtime);
    const status = (r && r.status) || r;
    chrome.storage.local.set({ lastUpdateCheck: Date.now() });
    return status === 'update_available'
      ? `Open Hangar ${(r && r.version) || ''} is downloading. A Reload bar appears at the top when it's ready.`
      : status === 'throttled'
        ? 'Checked a moment ago. Try again in a few minutes.'
        : 'You’re on the latest version. Fly safe.';
  } catch {
    return "Couldn't check. Developer builds (loaded unpacked) don't update from the store.";
  }
}

// Known Issues (#175): open bugs from the public GitHub tracker, through our own
// site's feed (OH.getKnownIssues), asked only when this page opens and cached for
// an hour. Nothing about the user sent. Never loaded yet (site busy or offline):
// the page links to the list on GitHub instead.
async function loadKnownIssues() {
  const feed = await OH.getKnownIssues();
  if (!feed) throw new Error('known issues not loaded yet');
  return OH.shapeKnownIssues(feed.data.issues);
}

// What the Svelte Updates and Known Issues pages (ui/updates) draw. These two
// load it each time the page opens and fire 'oh:home' so the pages redraw.
const updatesPage = { from: null, releases: null };
const issuesPage = { status: 'loading', quip: '', list: [] };

async function renderKnownIssues() {
  issuesPage.status = 'loading';
  issuesPage.quip = OH.quip('loading');
  homeUpdated();
  try {
    issuesPage.list = await loadKnownIssues();
    issuesPage.status = 'ok';
  } catch {
    issuesPage.status = 'error';
  }
  homeUpdated();
}

async function renderUpdates() {
  const cur = chrome.runtime.getManifest().version;
  const { justUpdated } = await chrome.storage.local.get('justUpdated');
  updatesPage.from = justUpdated && justUpdated.to === cur ? justUpdated.from : null;
  updatesPage.releases = await loadChangelog();
  homeUpdated();
}

function showUpdateBanner(version) {
  const cur = chrome.runtime.getManifest().version;
  const bar = $('#update-banner');
  if (!bar || !version || OH.compareVersions(version, cur) <= 0) return;
  $('#update-text').textContent = `Open Hangar ${version} has landed. Reload to start using it.`;
  // Shown in your menu (a dot on the portrait, "Update ready" in the menu, drawn by
  // ui/topbar) rather than a banner across the page.
  topBar.update = version;
  homeUpdated();
}

async function initUpdates() {
  const cur = chrome.runtime.getManifest().version;
  const { updateReady, justUpdated, lastUpdateCheck } = await chrome.storage.local.get([
    'updateReady',
    'justUpdated',
    'lastUpdateCheck',
  ]);
  showUpdateBanner(updateReady);
  chrome.storage.onChanged?.addListener((ch, area) => {
    if (area === 'local' && ch.updateReady) showUpdateBanner(ch.updateReady.newValue);
  });
  $('#update-reload')?.addEventListener('click', async () => {
    $('#update-reload').disabled = true;
    await chrome.storage.local.set({ reopenAfterUpdate: true });
    chrome.runtime.reload(); // closes this tab; the new version reopens it on Updates
  });

  const note = $('#updated-note');
  if (note && justUpdated && justUpdated.to === cur && !justUpdated.seen) {
    setHTML(
      note,
      `<span>Patch landed: Open Hangar ${OH.escapeHtml(cur)}. <a href="#updates" data-view="updates">See What’s New</a></span><button type="button" class="note-close" aria-label="Dismiss">×</button>`,
    );
    note.hidden = false;
    const seen = () => {
      note.hidden = true;
      chrome.storage.local.set({ justUpdated: { ...justUpdated, seen: true } });
    };
    note.addEventListener('click', (e) => {
      if (e.target.closest('.note-close, a')) seen();
    });
  }

  // Nudge the browser to look for a new version (at most every 6 hours). If
  // one exists it downloads in the background and `updateReady` follows.
  // Chrome/Edge only: Firefox checks on its own schedule and has no such call
  // (looked up by name so Firefox's linter doesn't flag it).
  const check = chrome.runtime[['request', 'Update', 'Check'].join('')];
  if (typeof check === 'function' && !(Date.now() - (lastUpdateCheck || 0) < 6 * 3600e3)) {
    chrome.storage.local.set({ lastUpdateCheck: Date.now() });
    try {
      await check.call(chrome.runtime);
    } catch {
      /* unpacked builds and throttling land here; nothing to do */
    }
  }
}

// @sync-start: the `sync` build flag's code, in every store build (src/flags.js, #187)
// --- openhangar.space: connect + sync (optional) -----------------------------
// It's Svelte (ui/site, owner sign-off 2026-10-04 and -05): the Connect card in the
// Citizen Card's corner until you connect, then the top bar's Scan button (a status
// beside it, a section in its ▾ menu, problems in its scan report). This holds the
// state and does what they ask. On in every build with a built-in site (the store
// builds and the beta sync to production, scripts/pack.mjs); developers point it
// elsewhere with the `siteUrl` storage key (the staging site, say). Nothing is sent
// until you Connect; after that, every scan syncs by itself, and Sync Now sends right away.
const site = {
  enabled: false,
  link: null, // { name, connectedAt, lastSync } once connected (the token stays in lib.js)
  waiting: null, // { code, url, until, stop } while the website hasn't approved the code yet
  syncing: false,
  msg: '', // the last thing that went wrong, or ''
  // Firefox, and whether it already lets us share (else Connect explains first).
  firefox: false,
  dataOk: true,
  // Connect was pressed on the website before Firefox said yes: Home opens with
  // Firefox's card up (background.js oh-connect-begin; ui/site/SiteConnect.svelte).
  askFirefox: false,
};
async function refreshSite() {
  site.enabled = await OH.siteEnabled();
  const link = site.enabled ? await OH.getSiteLink() : null;
  site.link = link && { name: link.name, connectedAt: link.connectedAt, lastSync: link.lastSync };
  site.firefox = !!chrome.runtime.getManifest().browser_specific_settings?.gecko;
  site.dataOk = !site.firefox || (await chrome.permissions.contains(SITE_DATA).catch(() => false));
  if (site.firefox && !site.dataOk && !site.link && chrome.storage.session) {
    const { siteAskFirefox: at } = await chrome.storage.session.get('siteAskFirefox');
    if (at) {
      await chrome.storage.session.remove('siteAskFirefox');
      if (Date.now() - at < 5 * 60e3) site.askFirefox = true;
    }
  }
  homeUpdated();
}
function siteProblem(err) {
  site.msg = String(err?.message || err);
  OH.log('warn', 'site', site.msg);
}
// Connect (owner, 2026-10-04): the browser's sign-in window opens the website's
// /connect page; you sign in if needed and press Approve, and the window closes by
// itself. It hands back a one-time code, traded for the sync token with PKCE (proof
// that this extension is the one that asked). "Sync My Hangar Now" there (on by
// default) sends the first sync right away. Without the window (no identity
// permission, or it couldn't open), the device code below is the fallback.
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const randomB64 = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
// → { link, sync } once approved, { cancelled: true } if the window was closed or
// Cancel pressed, or null when the window can't be used (then: the code).
async function siteConnectWindow() {
  const identity = globalThis.chrome?.identity || globalThis.browser?.identity;
  if (!identity?.launchWebAuthFlow || !identity.getRedirectURL) return null;
  const redirect = identity.getRedirectURL();
  const verifier = randomB64(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const state = randomB64(16);
  const base = await OH.siteUrl();
  const url = `${base}/connect?${new URLSearchParams({
    response_type: 'code',
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
    state,
    redirect_uri: redirect,
  })}`;
  let back;
  try {
    back = await identity.launchWebAuthFlow({ url, interactive: true });
  } catch (err) {
    // Closing the window reads as "did not approve" (Chrome) or "cancelled" (Firefox).
    if (/approve|cancel|denied|closed/i.test(String(err?.message || err)))
      return { cancelled: true };
    OH.log('warn', 'site', `sign-in window: ${err?.message || err}`);
    return null;
  }
  const answer = new URL(back).searchParams;
  if (answer.get('state') !== state)
    throw new Error('That connect attempt got crossed. Connect again.');
  if (answer.get('error') || !answer.get('code')) return { cancelled: true };
  const res = await fetch(`${base}/api/link/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: answer.get('code'),
      code_verifier: verifier,
      redirect_uri: redirect,
    }),
  });
  if (!res.ok) throw new Error("openhangar.space couldn't finish connecting. Connect again.");
  const j = await res.json();
  const link = { token: j.token, name: j.name || '', connectedAt: Date.now(), lastSync: null };
  await chrome.storage.local.set({ siteLink: link });
  return { link, sync: answer.get('sync') === '1' };
}
// Firefox asks before an extension sends anything off the device: the Firefox
// manifest lists what sync sends as optional data collection (scripts/pack.mjs,
// SYNC_DATA), so the first Connect or Sync Now shows Firefox's own prompt. Called
// first thing in a click, before any await, so Firefox can show it. Other browsers:
// always yes. Outside a click (the sync after a scan) it only checks.
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
// On Firefox, Connect explains first (ui/site/FirefoxExplain.svelte) until it's allowed;
// that card's Continue is the click that asks.
function siteDataOk() {
  if (!chrome.runtime.getManifest().browser_specific_settings?.gecko) return Promise.resolve(true);
  return chrome.permissions
    .request(SITE_DATA)
    .catch(() => chrome.permissions.contains(SITE_DATA).catch(() => false))
    .then((ok) => (site.dataOk = !!ok));
}
const SITE_DATA_NO =
  'No problem. Sync stays off until you let Firefox share your hangar with openhangar.space.';
function siteDataNo() {
  site.msg = SITE_DATA_NO;
  homeUpdated();
}

async function siteConnect() {
  if (site.waiting) return;
  site.msg = '';
  if (!(await siteDataOk())) return void siteDataNo();
  try {
    site.waiting = { window: true };
    homeUpdated();
    const got = await siteConnectWindow();
    site.waiting = null;
    if (got) {
      await refreshSite();
      if (got.sync) await siteSyncNow(); // "Sync My Hangar Now" on the Approve page
      return;
    }
  } catch (err) {
    site.waiting = null;
    siteProblem(err);
    return void (await refreshSite());
  }
  // Fallback: a code, the website's link page in a new tab (code filled in, one
  // Approve click), then wait here until it's approved, expires or you cancel.
  try {
    const start = await OH.siteLinkStart();
    const w = {
      code: start.user_code,
      url: `${start.verification_uri}?code=${encodeURIComponent(start.user_code)}`,
      // When the code runs out: the card counts down to it.
      until: Date.now() + (start.expires_in || 600) * 1000,
      stop: false,
    };
    site.waiting = w;
    homeUpdated();
    chrome.tabs.create({ url: w.url });
    const link = await OH.siteLinkWait(start, () => site.waiting === w && !w.stop);
    if (site.waiting === w) site.waiting = null;
    if (!link && !w.stop) site.msg = 'That code expired before it was approved. Connect again.';
  } catch (err) {
    site.waiting = null;
    siteProblem(err);
  }
  await refreshSite();
}
// "Sync My Hangar Now" from the website's Connect This Browser (background.js sets
// siteSyncRequested): once, in the dashboard that opened.
let siteSyncAsked = false;
async function siteSyncIfAsked() {
  const { siteSyncRequested } = await chrome.storage.local.get('siteSyncRequested');
  if (!siteSyncRequested || siteSyncAsked) return;
  siteSyncAsked = true;
  await chrome.storage.local.remove('siteSyncRequested');
  siteSyncAsked = false;
  if (Date.now() - siteSyncRequested < 10 * 60e3) await siteSyncNow();
}
function siteCancel() {
  if (site.waiting) site.waiting.stop = true;
  site.waiting = null;
  homeUpdated();
}
// A sync that didn't go through shows in the scan report under the Scan button:
// "Scan Done, Not Synced" after a scan (a row of its own if the scan had problems
// too), "Not Synced" for Sync Now. A calm refusal (sync isn't open yet, or the website
// took one moments ago; OH.siteSync) is a note instead: "Not Synced Yet" with an info
// sign, no problem counted, and the Scan button stays as it was. An RSI account this
// link hasn't synced asks first (siteSyncAsk). `scan` is the sync after a scan;
// `onSend` runs when it really sends; `dataOk` is a siteDataOk() the click already asked.
async function siteSyncNow({ scan = false, onSend, dataOk } = {}) {
  if (site.syncing || !site.link) return;
  let problem = '';
  let calm = false;
  let ask = null;
  let quiet = false;
  if (!(await (dataOk || siteDataOk()))) problem = SITE_DATA_NO;
  else {
    site.syncing = true;
    site.msg = '';
    homeUpdated();
    try {
      await OH.siteSync({ auto: scan, onSend });
    } catch (err) {
      problem = String(err?.message || err);
      calm = !!err?.calm;
      ask = err?.ask || null;
      quiet = !!err?.quiet;
      // These two name the RSI account, and the flight log never does.
      if (ask) OH.log('info', 'site', 'asked before syncing an RSI account new to this link');
      else if (quiet) OH.log('info', 'site', 'not synced: you chose to keep this account here');
      else OH.log(calm ? 'info' : 'warn', 'site', problem);
    }
    site.syncing = false;
  }
  if (ask) siteSyncAsk(ask, problem, scan);
  else if (quiet) {
    // Your answer for this account stands: nothing to show.
  } else if (problem) siteSyncReport(problem, scan, calm);
  else if (topBar.report?.kind === 'sync') topBar.report = null; // went through this time
  await refreshSite();
}
// "Sync <handle> to your openhangar.space account?" in the scan report, with Sync It
// and Don't Sync (siteSyncAnswer). After a scan with problems their rows stay under
// it, and they come back as the report once you answer.
function siteSyncAsk(ask, question, scan) {
  const before = scan && topBar.report ? topBar.report : null;
  topBar.report = {
    kind: 'sync',
    calm: !before?.bad,
    ask,
    title: 'New Pilot Aboard',
    sub: question,
    hint: `Open Hangar checks before beaming up a hangar from another RSI account. We'll remember your answer for ${ask.handle}.`,
    rows: before ? before.rows : [],
    bad: before ? before.bad : 0,
    summary: before ? before.summary : 'Not synced yet: asked about a new RSI account', // no handle
    last: '',
    before,
    n: Date.now(), // a new report, so the top bar opens it
  };
}
async function siteSyncAnswer(yes) {
  const r = topBar.report;
  if (!r?.ask) return;
  // Sync It is the click Firefox's prompt needs, so it's asked before any await.
  const dataOk = yes ? siteDataOk() : null;
  topBar.report = r.before || null;
  homeUpdated();
  await OH.siteSyncAnswer(r.ask, yes);
  if (yes) await siteSyncNow({ dataOk });
}
function siteSyncReport(text, scan, calm = false) {
  const n = Date.now(); // a new report, so the top bar opens it
  if (scan && topBar.report) {
    topBar.report.rows.push({ name: 'Website', ok: false, calm, text });
    if (!calm) topBar.report.bad++;
    topBar.report.n = n;
    return;
  }
  topBar.report = {
    kind: 'sync',
    calm,
    title: `${scan ? 'Scan Done, ' : ''}Not Synced${calm ? ' Yet' : ''}`,
    sub: text,
    label: 'Not Synced',
    rows: [],
    bad: calm ? 0 : 1,
    summary: text,
    last: '',
    n,
  };
}
async function siteDisconnect() {
  site.msg = '';
  if (topBar.report?.kind === 'sync') topBar.report = null;
  try {
    await OH.siteDisconnect();
  } catch (err) {
    siteProblem(err);
  }
  await refreshSite();
}
// @sync-end

// --- Display currency -------------------------------------------------------
function currencyNote() {
  return fx.code === 'USD'
    ? ''
    : `Converted from USD at the ${fx.date ? `${fx.date} ` : ''}exchange rate, before tax. RSI's own EUR/GBP store prices include VAT, so they'll look higher.`;
}
function renderCurrencyNote() {
  document.querySelectorAll('.currency-note').forEach((el) => {
    el.textContent = currencyNote();
    el.hidden = !el.textContent;
  });
  homeUpdated(); // the top bar's Currency picker shows the note on hover
}
async function applyCurrency(code) {
  const want = OH.CURRENCIES.includes(code) ? code : 'USD';
  let rate = 1;
  let date = null;
  if (want !== 'USD') {
    const r = await OH.getFxRates();
    if (r && r.rates && r.rates[want]) {
      rate = r.rates[want];
      date = r.date;
    } else {
      setStatus?.('Couldn’t load exchange rates, showing USD for now.');
      Object.assign(fx, { code: 'USD', rate: 1, date: null });
      renderCurrencyNote();
      return;
    }
  }
  Object.assign(fx, { code: want, rate, date });
  valueCache = { items: null, priceOf: null, value: null };
  renderCurrencyNote();
  route(); // re-render the current view in the new currency
}
// Your menu → Currency (ui/topbar).
async function pickCurrency(code) {
  topBar.currency = code;
  homeUpdated();
  await chrome.storage.local.set({ currency: code });
  applyCurrency(code);
}

// --- Ships: details window, loaners, global search ------------------------
// Any element with data-ship="<name>" opens that ship's details window; with
// data-open-item / data-open-bb, that pledge or buy-back (see the click
// handler below, shared by every view and the search box).

// RSI's loaner matrix (OH.getLoanerMatrix, cached a week), fetched on first use.
let loanerMatrix = null;
let includedVessels = null; // RSI's "Included Vessels" list (kept for good)
let loanersRequested = false;
function ensureLoaners() {
  if (loanersRequested) return;
  loanersRequested = true;
  Promise.all([OH.getLoanerMatrix(), OH.getIncludedVessels()]).then(([m, inc]) => {
    if (m) loanerMatrix = m;
    if (inc) includedVessels = inc;
    if ((m || inc) && currentView() === 'stats') renderStats();
    if (m || inc) homeUpdated(); // an open ship window shows them
  });
}
// What a ship comes with for keeps ("G12* (currently Cyclone)" → clean text).
function includedOf(name) {
  const row = includedVessels && OH.loanersFor(name, includedVessels);
  return row ? row.loaners.map((t) => t.replace(/\*/g, '').trim()) : null;
}

const shipKey = (name) => OH.normShipName(name || '').toLowerCase();
// The catalog entry for a ship name, or null.
function shipEntry(name) {
  if (!name) return null;
  return (
    (state.shipOf && state.shipOf(name)) ||
    (state.catalog || []).find((v) => v.lname === String(name).toLowerCase()) ||
    null
  );
}
function sameShip(a, b) {
  if (!a || !b) return false;
  const va = shipEntry(a);
  const vb = shipEntry(b);
  if (va && vb) return va.slug === vb.slug;
  return shipKey(a) === shipKey(b);
}
// Ships in the hangar, one entry per ship: [{ label, pledges: [p…] }].
function ownedShips() {
  const byKey = new Map();
  for (const p of state.items) {
    for (const c of p.contents || []) {
      if (!/^ship$/i.test(c.kind || '') || !c.label) continue;
      const v = shipEntry(c.label);
      const key = v ? v.slug : shipKey(c.label);
      if (!byKey.has(key)) byKey.set(key, { label: v ? v.name : c.label, pledges: [] });
      byKey.get(key).pledges.push(p);
    }
  }
  return [...byKey.values()];
}
// A buy-back that gives back this ship (standalone or its CCU target).
function buybackHasShip(b, name) {
  if (b.ccu) return sameShip(b.ccu.to, name);
  if (!['ship', 'pack', 'package'].includes(b.kind)) return false;
  const bare = String(b.name || '').replace(/^\s*[^-–]+?\s*[-–]\s/, '');
  const base = bare.replace(
    /\s*[-–]\s*(lti|iae|ilw|warbond|standard edition|\d+\s*(months?|years?).*)$/i,
    '',
  );
  if (sameShip(base, name) || sameShip(bare, name)) return true;
  if (b.kind === 'ship') return false;
  // A pack: its full ship list once "Load details" has read its page, else the
  // one item RSI's list names ("400i and 9 other items").
  const d = state.bbDetails && state.bbDetails[b.id];
  if (d && Array.isArray(d.ships) && d.ships.length)
    return d.ships.some((x) => sameShip(x.name, name));
  const first = String(b.contains || '').split(/\s+and\s+\d+\s+other\b/i)[0];
  return first.split(/\s*,\s*|\s+and\s+/i).some((t) => t && sameShip(t, name));
}
// Packs whose contents haven't been read yet (only their first item is known).
function uncheckedPacks() {
  return state.buybacks.filter(
    (b) =>
      !b.ccu &&
      (b.kind === 'pack' || b.kind === 'package') &&
      !(state.bbDetails && state.bbDetails[b.id] && (state.bbDetails[b.id].ships || []).length),
  ).length;
}
// Loaners only apply while a ship can't be flown yet; RSI's list sometimes still
// names ships that are already flight ready, so those are skipped.
function loanersOf(name) {
  if (!loanerMatrix) return null;
  const v = shipEntry(name);
  if (v && v.status === 'flight-ready') return null;
  return OH.loanersFor(name, loanerMatrix);
}

function openShipModal(name) {
  openDetail({ kind: 'ship', name });
  if (!loanerMatrix) ensureLoaners();
  ensureStore();
  ensureCatalog();
}
// A ship's window: its specs, the store, what it comes with, loaners, links, and
// your copies of it (pledges and buy-backs).
function shipView(name) {
  const v = shipEntry(name);
  const title = (v && v.name) || name;
  const pledges = state.items.filter((p) =>
    (p.contents || []).some((c) => /^ship$/i.test(c.kind || '') && sameShip(c.label, title)),
  );
  const bbs = state.buybacks.filter((b) => buybackHasShip(b, title));
  const status = v && (SHIP_STATES.find(([k]) => k === v.status) || [])[1];
  const loan = loanersOf(title);
  const inc = includedOf(title);
  const st = storeOf(title);
  return {
    title,
    known: !!v,
    status: status ? { text: status, cls: v.status === 'flight-ready' ? 'good' : 'warn' } : null,
    msrp: v && v.msrp ? dollars(v.msrp) : '',
    wished: onWishlist(title),
    mfr: (v && v.mfr) || '',
    role: v && (v.role || v.career) ? titleCase(v.role || v.career) : '',
    size: v && v.size ? titleCase(v.size) : '',
    crew: v && v.crew ? String(v.crew) : '',
    cargo: v && v.cargo ? `${v.cargo} SCU` : '',
    // Add to RSI Cart (#288): RSI's upgrade tool sells an upgrade to it.
    upgrade: (() => {
      const u = st && st.forSale ? OH.upgradeSku(st) : null;
      return u
        ? { toShipId: u.toShipId, toSkuId: u.toSkuId, skus: u.skus, name: st.name || title }
        : null;
    })(),
    comesWith: inc
      ? inc.map((t) => ({ name: t.replace(/\s*\(.*\)\s*$/, '').trim(), text: t }))
      : null,
    loaners: loan ? loan.loaners : null,
    q: encodeURIComponent(title),
    pledges: pledges.map((p) => ({ id: String(p.id), name: plainName(p), value: formatValue(p) })),
    bbs: bbs.map((b) => ({ id: String(b.id), name: buybackName(b), reclaim: reclaimOf(b) })),
  };
}

// One click handler for ship / pledge / buy-back links anywhere on the page.
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-ship]');
  if (s) {
    e.preventDefault();
    closeSearches();
    return void openShipModal(s.dataset.ship);
  }
  const it = e.target.closest('[data-open-item]');
  if (it) {
    const p = state.items.find((x) => String(x.id) === it.dataset.openItem);
    closeSearches();
    if (p) openItemModal(p);
    return;
  }
  const bb = e.target.closest('[data-open-bb]');
  if (bb) {
    const b = state.buybacks.find((x) => String(x.id) === bb.dataset.openBb);
    closeSearches();
    if (b) openBuybackModal(b);
  }
});

// --- Wishlist ---------------------------------------------------------------
// What you want, kept in this browser (`wishlist`): ships by name (toggled from the
// ship window or Find in Store) and other store items (Find in Store, see
// isWishItem). Listed on the Store page with price, and for ships any buy-back
// copies you could reclaim instead of buying new.
function onWishlist(name) {
  return state.wishlist.some((n) => typeof n === 'string' && sameShip(n, name));
}
function toggleWishlist(name) {
  state.wishlist = onWishlist(name)
    ? state.wishlist.filter((n) => typeof n !== 'string' || !sameShip(n, name))
    : [...state.wishlist, name];
  chrome.storage.local.set({ wishlist: state.wishlist });
}
// A store item from Find in Store: ships go in by name; the rest as an entry.
const onWishlistItem = (entry) =>
  typeof entry === 'string'
    ? onWishlist(entry)
    : state.wishlist.some((e) => typeof e !== 'string' && wishKey(e) === wishKey(entry));
function toggleWishItem(entry) {
  if (typeof entry === 'string') toggleWishlist(entry);
  else if (isWishItem(entry)) {
    state.wishlist = onWishlistItem(entry)
      ? state.wishlist.filter((e) => typeof e === 'string' || wishKey(e) !== wishKey(entry))
      : [...state.wishlist, entry];
    chrome.storage.local.set({ wishlist: state.wishlist });
  }
  if (currentView() === 'store') renderStore();
  homeUpdated();
}
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-wish-remove]');
  if (r) {
    // One click removes; an Undo bar brings it back (same spot) for 8 seconds.
    const key = r.dataset.wishRemove;
    const at = state.wishlist.findIndex((x) => wishKey(x) === key);
    if (at < 0) return;
    const entry = state.wishlist[at];
    state.wishlist = state.wishlist.filter((_, i) => i !== at);
    chrome.storage.local.set({ wishlist: state.wishlist });
    renderStore();
    showWishUndo(entry, at);
    return;
  }
  if (e.target.closest('[data-wish-undo]') && wishUndo) {
    const { entry, at } = wishUndo;
    if (!state.wishlist.some((x) => wishKey(x) === wishKey(entry))) {
      state.wishlist.splice(Math.max(0, at), 0, entry);
      chrome.storage.local.set({ wishlist: state.wishlist });
    }
    hideWishUndo();
    renderStore();
  }
});
// The Undo bar on the Store page (ui/store) shows while this is set.
let wishUndo = null; // { entry, at, timer }
function showWishUndo(entry, at) {
  clearTimeout(wishUndo && wishUndo.timer);
  wishUndo = { entry, at, timer: setTimeout(hideWishUndo, 8000) };
  homeUpdated();
}
function hideWishUndo() {
  clearTimeout(wishUndo && wishUndo.timer);
  wishUndo = null;
  homeUpdated();
}

// --- Home: event heads-up -----------------------------------------------------
// A banner while a referral bonus event runs (they come with the big sales:
// IAE, Invictus, CitizenCon, Luminalia…), from the wiki's event list.
function renderEventBanner() {
  refreshReferralEvents(); // calls back here when newer events arrive
  homeUpdated();
}

// --- Global Hangar Search ------------------------------------------------------
// Searches what's yours: hangar pledges (names and what's inside), buy-backs
// and earned referral rewards. Not the store catalog: a ship you don't own
// finds nothing. The two boxes (Home's, the top bar's) are Svelte (ui/search);
// this finds the matches. Rows open with data-open-item / data-open-bb (the click
// handler above), which closes the searches.
function closeSearches() {
  document.dispatchEvent(new Event('oh:close-search'));
}
// What matches `q`, grouped by where it lives: hangar pledges (first 12), buy-backs
// (first 8), earned referral rewards (first 4), each group with its full count, and
// how many buy-back packs were never read (they can't match on what's inside).
function searchResults(q) {
  const needle = q.trim().toLowerCase();
  const has = (s) =>
    String(s || '')
      .toLowerCase()
      .includes(needle);
  // RSI dates arrive as "2015-06-08" (read as UTC so it never shifts a day) or already readable.
  const day = (d) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(d);
    const t = Date.parse(d);
    return isNaN(t)
      ? d
      : new Date(t).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...(iso ? { timeZone: 'UTC' } : {}),
        });
  };
  const tag = (text, cls = '') => (text ? { text, cls } : null);

  // Type order inside each group (owner, #169): packs first (a ship found inside a
  // pack is the pack's row), then packages, ships, paints, CCUs, the rest. Sorted
  // before the row caps, so packs never get cut for add-ons. sort() keeps today's
  // order within a type.
  const TYPE_RANK = { pack: 0, package: 1, ship: 2, paint: 3, ccu: 4 };
  const byType = (typeOf) => (a, b) => (TYPE_RANK[typeOf(a)] ?? 5) - (TYPE_RANK[typeOf(b)] ?? 5);

  const hits = state.items
    .filter((p) => has(plainName(p)) || (p.contents || []).some((c) => has(c.label)))
    .sort(byType(pledgeType));
  const pledges = hits.slice(0, 12).map((p) => {
    // Matched a ship inside a package: lead with that ship, say what it's in.
    const inner = !has(plainName(p)) && (p.contents || []).find((c) => has(c.label));
    const type = pledgeType(p);
    return {
      key: `p${p.id}`,
      item: String(p.id),
      img: realImage(p.image),
      resolve: inner ? inner.label : resolveImageName(p),
      name: inner ? inner.label : cardName(p),
      // The group heading already says where it is; the row says what it's inside.
      inside: inner ? cardName(p) : '',
      date: p.date ? `Pledged ${day(p.date)}` : '',
      tags: [
        tag(TYPE_KEYS.includes(type) ? type.toUpperCase() : p.kind, `badge ${type}`),
        tag(p.insurance),
        isMeltable(p) ? tag('Meltable', 'good') : null,
        p.giftable ? tag('Giftable', 'good') : null,
      ].filter(Boolean),
      val: isMeltable(p) ? formatValue(p) : '',
      valLbl: 'melt value',
    };
  });
  // A buy-back pack also matches on the ships inside it, once its details have
  // been read (#167). Each pack stays its own row, never merged with the ship.
  const bbInner = (b) =>
    has(b.name) ? null : ((bbDetail(b) || {}).ships || []).find((x) => has(x.name)) || null;
  const bbType = (b) => (b.isCCU ? 'ccu' : b.kind);
  const bbHits = state.buybacks
    .filter(
      (b) =>
        has(b.name) ||
        has(b.contains) ||
        (b.ccu && (has(b.ccu.from) || has(b.ccu.to))) ||
        bbInner(b),
    )
    .sort(byType(bbType));
  const buybacks = bbHits.slice(0, 8).map((b) => {
    const type = bbType(b);
    const inner = bbInner(b);
    return {
      key: `b${b.id}`,
      bb: String(b.id),
      img: inner || (b.ccu && b.ccu.to && !b.shipArt) ? null : realImage(b.image),
      resolve: inner
        ? inner.name
        : b.ccu && b.ccu.to
          ? b.ccu.to
          : resolveImageName({ ...b, kind: 'ship' }) || b.name,
      name: inner ? inner.name : buybackName(b),
      inside: inner ? buybackName(b) : '',
      note: inner ? '' : b.contains || '',
      date: b.date ? `Melted ${day(b.date)}` : '',
      tags: [
        tag(
          TYPE_KEYS.includes(type) ? type.toUpperCase() : type || 'BUY-BACK',
          `badge ${type || ''}`,
        ),
        tag(b.insurance),
      ].filter(Boolean),
      val: bbPriceText(b),
    };
  });
  const ref = state.referral;
  const rewards = ref
    ? earnedRewards(
        ref.legacy?.recruits ?? 0,
        ref.recruitsList || [],
        (ref.legacy?.recruits ?? 0) > 0,
      )
        .filter((r) => has(r.name))
        .slice(0, 4)
        .map((r, i) => ({ key: `r${i}`, name: r.name, sub: r.sub }))
    : [];
  return {
    pledges,
    pledgeCount: hits.length,
    buybacks,
    bbCount: bbHits.length,
    rewards,
    unchecked: uncheckedPacks(),
  };
}

// --- Init -----------------------------------------------------------------

(async () => {
  const {
    uiLayout,
    bbLayout,
    marketAnnotations,
    uiStatsTab,
    lastBackupAt,
    remindRescan,
    streamerMode,
    hideSmallInv,
    invFiltersFolded,
    invClosedGroups,
    hideSmallBb,
    bbFiltersFolded,
    bbClosedGroups,
    bbStack,
    savedViews,
    currency,
    uiGroupByType,
    wishlist,
    uiWishSort,
    wishWatch: savedWishWatch,
  } = await chrome.storage.local.get([
    'wishlist',
    'wishWatch',
    'uiWishSort',
    'currency',
    'uiGroupByType',
    'remindRescan',
    'streamerMode',
    'hideSmallInv',
    'invFiltersFolded',
    'invClosedGroups',
    'hideSmallBb',
    'bbFiltersFolded',
    'bbClosedGroups',
    'bbStack',
    'savedViews',
    'lastBackupAt',
    'uiStatsTab',
    'uiLayout',
    'bbLayout',
    'marketAnnotations',
  ]);
  if (LAYOUTS.includes(uiLayout)) state.layout = uiLayout;
  if (uiGroupByType === false) state.groupByType = false;
  // Ships by name, and store items (isWishItem); anything else is dropped.
  if (Array.isArray(wishlist))
    state.wishlist = wishlist.filter((n) => (typeof n === 'string' && n) || isWishItem(n));
  if (savedWishWatch && Number.isFinite(savedWishWatch.at) && savedWishWatch.items)
    wishWatch = savedWishWatch;
  if (WISH_SORTS.some(([k]) => k === uiWishSort)) state.wishSort = uiWishSort;
  if (STATS_TABS.some(([k]) => k === uiStatsTab)) state.statsTab = uiStatsTab;
  if (Number.isFinite(lastBackupAt)) state.lastBackupAt = lastBackupAt;
  streamer.on = streamerMode === true;
  state.hideSmall = hideSmallInv === true;
  state.invFolded = invFiltersFolded === true;
  if (Array.isArray(invClosedGroups)) state.invClosed = new Set(invClosedGroups);
  state.bbHideSmall = hideSmallBb !== false; // on unless turned off
  state.bbFolded = bbFiltersFolded === true;
  if (Array.isArray(bbClosedGroups)) state.bbClosed = new Set(bbClosedGroups);
  state.bbStack = bbStack === true;
  if (Array.isArray(savedViews)) state.savedViews = savedViews.filter((v) => v && v.name && v.f);
  document.documentElement.classList.toggle('streamer', streamer.on);
  // Your menu's Streamer Mode and Rescan Reminder switches (ui/topbar) read these.
  topBar.remind = remindRescan !== false;
  homeUpdated();
  if (LAYOUTS.includes(bbLayout)) state.bbLayout = bbLayout;
  if (marketAnnotations && typeof marketAnnotations === 'object') state.market = marketAnnotations;

  OH.dropRetiredCaches(); // the old wiki, GitHub and store-page caches (now feeds)
  state.bbDetails = { ...(await OH.getBuybackDetails()) };
  await OH.migrateRecovery(); // old "Restore previous hangar" snapshot → saved account
  loadStateFromDB(await OH.loadDB());

  const notice = await reconcileAccount();
  await fillBbFromHistory(); // no requests: buy-backs your hangar history already knows
  state.shown = new Set(); // default: no filter selected = show all
  state.traits = new Map();
  state.meltMax = null;
  state.bbShown = new Set(); // default: no filter selected = show all
  state.bbTraits = new Map();
  state.bbPriceMax = null;
  route();
  if (notice) setStatus(notice);
  await refreshRecoveryUI();
  renderProfiles();
  renderFooter();
  initUpdates();
  renderSiteNotice();
  renderDbNotice();
  // @sync-start
  refreshSite().then(siteSyncIfAsked);
  // Connected from the website (background.js): the card follows, and "Sync My
  // Hangar Now" there runs here.
  chrome.storage.onChanged?.addListener((ch, area) => {
    if (area !== 'local' || !(ch.siteLink || ch.siteUrl || ch.siteSyncRequested)) return;
    refreshSite().then(siteSyncIfAsked);
  });
  // @sync-end
  if (currency && currency !== 'USD') {
    topBar.currency = currency;
    applyCurrency(currency);
  }
})();

// --- Bridge for the Svelte pages (ui/) -------------------------------------------
// ui/ is compiled by Vite into src/ui/ and loaded as a module after this script. It
// reads the app through window.OHApp and redraws on the 'oh:home' event.
let homeUpdateQueued = false;
function homeUpdated() {
  if (homeUpdateQueued) return;
  homeUpdateQueued = true;
  queueMicrotask(() => {
    homeUpdateQueued = false;
    document.dispatchEvent(new CustomEvent('oh:home'));
  });
}
// Soft launch notice until the November 10 release (owner, 2026-10-04): the card
// in dashboard.html with a countdown, shown until it's closed (✕ or Maybe Later,
// remembered here) and never after release day. In 0.3.0 it replaces the status
// file's green banner (that one has maxVersion 0.2.99). Remove after the release.
(function () {
  const note = document.getElementById('beta-note');
  const close = document.getElementById('beta-close');
  if (!note || !close) return;
  const days = Math.ceil((Date.parse('2026-11-10T00:00:00') - Date.now()) / 86400e3);
  const left = document.getElementById('beta-days');
  if (left)
    left.textContent = days > 1 ? `${days} days to go` : days === 1 ? 'Tomorrow' : 'Release day';
  const KEY = 'ohBetaNoteClosed';
  let closed = false;
  try {
    closed = localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: show it.
  }
  if (closed || Date.now() > Date.parse('2026-11-11')) return;
  note.hidden = false;
  const later = document.getElementById('beta-later');
  later?.addEventListener('click', () => close.click());
  close.addEventListener('click', () => {
    note.hidden = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Not remembered; it just shows again next time.
    }
  });
})();

window.OHApp = {
  get state() {
    return state;
  },
  get recruits() {
    return state.referral?.legacy?.recruits ?? 0;
  },
  // Citizen Card and welcome card (ui/home): the RSI account, the first scan's
  // progress, and the formatting the card shares with the classic pages.
  get account() {
    return homeCard.account;
  },
  get welcomeReady() {
    return homeCard.welcomeReady;
  },
  get loggedOut() {
    return lastLoggedOut;
  },
  get scanning() {
    return topBar.busy;
  },
  get scanDetail() {
    return homeCard.scan;
  },
  get streamer() {
    return streamer.on;
  },
  scanAll: () => {
    if (!topBar.busy) runScan(); // everything, whatever the ▾ menu has ticked
  },
  safeBgUrl,
  fmtEnlisted,
  conciergeColor: (level) => CONCIERGE_COLORS[String(level).toLowerCase()] || '#d2a8ff',
  compactNum,
  shortMoney: (n) => shortMoney(n, money),
  tokenTitle,
  hangarValue,
  // A history snapshot's ships at today's store prices (same as Stats → History).
  accountValue,
  creditNote,
  // A history snapshot's value on the headline's rules (same as Stats → History).
  snapshotStore: (snap) => (state.priceOf ? snapshotStore(snap) : null),
  money,
  dollars,
  // Whole amounts in the chosen currency: exact under 100,000, then "$1.24M" /
  // "$184.5K" so a huge hangar never breaks a layout (exact value goes in a tooltip).
  bigMoney: (n) => {
    if (streamer.on) return MASK;
    const v = n * fx.rate;
    if (Math.abs(v) < 100000) return fmtCurrency(v, 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: fx.code,
      notation: 'compact',
      maximumFractionDigits: Math.abs(v) >= 1e6 ? 2 : 1,
    }).format(v);
  },
  fmtDay,
  changeSummary,
  pledgeType,
  typeKeys: TYPE_KEYS,
  cardName,
  plainName,
  realImage,
  resolveImageName,
  formatValue,
  runningEvent,
  shortReward,
  parseTs,
  tierProgress: (recruits) => tierProgress(REFERRAL_LADDER_STANDARD, recruits),
  rewardNames,
  // Referrals page (ui/referrals).
  referralLadders: { standard: REFERRAL_LADDER_STANDARD, legacy: REFERRAL_LADDER_LEGACY },
  get referralEvents() {
    return referralEvents;
  },
  eventForDate,
  recruitDate,
  bestMonth,
  monthKey,
  fmtDate,
  legacyRank,
  earnedRewards,
  shareReferralImage,
  // Inventory (ui/inventory): what the page around the list shows, and the actions
  // its controls call. Each action updates state and redraws through renderInventory().
  inv: {
    get empty() {
      return !state.items.length;
    },
    get query() {
      return state.query;
    },
    get sort() {
      return state.sort;
    },
    get layout() {
      return state.layout;
    },
    get selecting() {
      return state.selecting;
    },
    get savedViews() {
      return state.savedViews;
    },
    // The current filters as a saved view's `f`, to mark the matching chip.
    viewKey: () => JSON.stringify(currentView_inv()),
    filters: invFilters,
    // Summary strip: totals follow the filters.
    summary: () => {
      const shown = computeShown();
      let store = 0;
      for (const p of shown) store += (storeInfo(p) || {}).store || 0;
      return {
        n: shown.length,
        nText: compactNum(shown.length),
        total: state.items.length,
        melt: OH.totalValue(shown),
        store,
      };
    },
    // Melt planner (Select mode): the picked pledges and what melting them gives back.
    picked: () => state.items.filter((p) => state.selected.has(p.id)),
    isMeltable,
    bbPrice,
    setQuery: (q) => {
      state.query = q;
      renderInventorySoon();
    },
    setSort: (v) => {
      state.sort = v;
      renderInventory();
    },
    setLayout: (v) => {
      if (!LAYOUTS.includes(v)) return;
      state.layout = v;
      chrome.storage.local.set({ uiLayout: state.layout });
      renderInventory();
    },
    toggleSelecting: () => setSelecting(!state.selecting),
    toggleType: (k) => {
      if (state.shown.has(k)) state.shown.delete(k);
      else state.shown.add(k);
      renderInventory();
    },
    toggleOption: (g, k) => {
      if (!(state.traits.get(g) instanceof Set)) state.traits.set(g, new Set());
      const sel = state.traits.get(g);
      if (sel.has(k)) sel.delete(k);
      else sel.add(k);
      renderInventory();
    },
    remove: (g, k) => {
      if (g === 'type') state.shown.delete(k);
      else if (g === 'cap') state.meltMax = null;
      else state.traits.get(g)?.delete(k);
      renderInventory();
    },
    clearGroup: (g) => {
      state.traits.delete(g);
      renderInventory();
    },
    clearAll: () => {
      resetInvFilters();
      renderInventory();
    },
    setMeltMax: (v) => {
      state.meltMax = v == null ? null : Number(v);
      renderInventorySoon();
    },
    setFolded: (on) => {
      state.invFolded = !!on;
      chrome.storage.local.set({ invFiltersFolded: state.invFolded });
      homeUpdated();
    },
    setGroupOpen: (g, open) => {
      if (open) state.invClosed.delete(g);
      else state.invClosed.add(g);
      chrome.storage.local.set({ invClosedGroups: [...state.invClosed] });
    },
    // The list (ui/inventory/InventoryList.svelte): cards and the Market sale sheet.
    list: invList,
    card: pledgeCard,
    isSelected: (id) => state.selecting && state.selected.has(id),
    market: marketView,
    emptyQuip: () => OH.quip('emptyHangar'),
    setGroupByType: (on) => {
      state.groupByType = !!on;
      chrome.storage.local.set({ uiGroupByType: state.groupByType });
      renderInventory();
    },
    setGiftableOnly: (on) => {
      state.marketGiftableOnly = !!on;
      renderInventory();
    },
    // A card click: a pick in Select mode, else the details pop-up.
    click: (id) => {
      if (state.selecting) return toggleSelected([id]);
      const p = state.items.find((it) => String(it.id) === id);
      if (p) openItemModal(p);
    },
    // Market ticks (no Select mode needed): every copy in a stacked row.
    pick: (ids, on) => {
      for (const id of ids) on ? state.selected.add(id) : state.selected.delete(id);
      updateSelectBar();
    },
    exportCsv: exportMarketCsv,
    exportImage: copyMarketImage,
  },
  // Buy-Backs (ui/buybacks): like `inv`, for the page around the buy-back list.
  bb: {
    get empty() {
      return !state.buybacks.length;
    },
    get query() {
      return state.bbQuery;
    },
    get sort() {
      return state.bbSort;
    },
    get layout() {
      return state.bbLayout;
    },
    filters: bbFilters,
    // Summary strip: count, tokens with the next date, and how many cost less than
    // the same ship in today's store.
    summary: () => {
      const next = nextTokenDate();
      return {
        n: compactNum(state.buybacks.length),
        tokens: state.bbTokens != null ? state.bbTokens : '—',
        next: next ? next.replace(/^\w+, /, '').replace(/, \d{4}$/, '') : '',
        tokenTitle: tokenTitle(),
        under: state.buybacks.filter(bbUnderStore).length,
        underText: compactNum(state.buybacks.filter(bbUnderStore).length),
      };
    },
    setQuery: (q) => {
      state.bbQuery = q;
      renderBuybacksSoon();
    },
    setSort: (v) => {
      state.bbSort = v;
      renderBuybacks();
    },
    setLayout: (v) => {
      if (!LAYOUTS.includes(v)) return;
      state.bbLayout = v;
      chrome.storage.local.set({ bbLayout: state.bbLayout });
      renderBuybacks();
    },
    toggleType: (k) => {
      if (state.bbShown.has(k)) state.bbShown.delete(k);
      else state.bbShown.add(k);
      renderBuybacks();
    },
    toggleOption: (g, k) => {
      if (!(state.bbTraits.get(g) instanceof Set)) state.bbTraits.set(g, new Set());
      const sel = state.bbTraits.get(g);
      if (sel.has(k)) sel.delete(k);
      else sel.add(k);
      renderBuybacks();
    },
    remove: (g, k) => {
      if (g === 'type') state.bbShown.delete(k);
      else if (g === 'cap') state.bbPriceMax = null;
      else state.bbTraits.get(g)?.delete(k);
      renderBuybacks();
    },
    clearGroup: (g) => {
      state.bbTraits.delete(g);
      renderBuybacks();
    },
    clearAll: () => {
      state.bbShown = new Set();
      state.bbTraits = new Map();
      state.bbPriceMax = null;
      renderBuybacks();
    },
    setPriceMax: (v) => {
      state.bbPriceMax = v == null ? null : Number(v);
      renderBuybacksSoon();
    },
    setFolded: (on) => {
      state.bbFolded = !!on;
      chrome.storage.local.set({ bbFiltersFolded: state.bbFolded });
      homeUpdated();
    },
    setGroupOpen: (g, open) => {
      if (open) state.bbClosed.delete(g);
      else state.bbClosed.add(g);
      chrome.storage.local.set({ bbClosedGroups: [...state.bbClosed] });
    },
    // The list (ui/buybacks/BuybacksList.svelte): cards, or the Market reclaim sheet.
    list: bbList,
    card: buybackCard,
    market: bbMarketView,
    selText: bbSelText,
    open: (id) => {
      const b = state.buybacks.find((it) => String(it.id) === id);
      if (b) openBuybackModal(b);
    },
    pick: (ids, on) => {
      for (const id of ids) on ? state.bbPicked.add(id) : state.bbPicked.delete(id);
      homeUpdated();
    },
    exportCsv: exportBuybackCsv,
    exportImage: copyBuybackImage,
    // Load Details stays opt-in: one page at a time, with Stop (OH.fetchBuybackDetails).
    loadDetails: () => loadBuybackDetails(),
    stopDetails: () => {
      if (bbLoading) bbLoading.stop = true;
    },
  },
  // Market My Price (both pages): saved as it's typed, without a redraw, so the field
  // keeps focus; % of the melt (or buy-back) price and back.
  setMarketPrice,
  pctOf: pctOfMelt,
  priceAt: priceAtPct,
  // Card pictures (ui/lib/Thumb.svelte): the two RSI sizes and the sizes hint, the
  // sharp copy started on hover (so the details pop-up opens sharp), and art found
  // for a card kept on its item (the details pop-up and the hover use it too).
  srcsetFor,
  cardSizes,
  preloadPicture: (url) => {
    if (url) loadHiRes(url);
  },
  setArt: (list, id, url, isArt) => {
    const item = (list === 'bb' ? state.buybacks : state.items).find((x) => String(x.id) === id);
    if (!item || !url) return;
    item.image = url;
    if (isArt) item.shipArt = true; // a CCU's target art is in hand now
  },
  openItem: (id) => {
    const p = state.items.find((x) => String(x.id) === String(id));
    if (p) openItemModal(p);
  },
  // Open Buy-Backs showing only these (a Hangar Alert's matches), with Show all.
  showBuybacks: (ids, label) => {
    state.bbOnly = { ids: new Set(ids.map(String)), label };
    if (location.hash === '#buybacks') renderBuybacks();
    else location.hash = '#buybacks';
  },
  // Open Inventory with one kind or trait filter on ("ship", "ccu", "lti", "all").
  showInventory: (key) => {
    state.shown = new Set(OH.KINDS.some((k) => k.key === key) ? [key] : []);
    state.traits = new Map(key === 'lti' ? [['ins', new Set(['LTI'])]] : []);
    state.meltMax = null;
    location.hash = '#inventory';
    renderInventory();
  },
  shipOf: (name) => (state.shipOf ? state.shipOf(name) : null),
  // Updates and Known Issues pages (ui/updates).
  repoUrl: REPO_URL,
  updates: {
    get current() {
      return chrome.runtime.getManifest().version;
    },
    // Releases from the bundled CHANGELOG.md (null until loaded, [] if missing).
    get releases() {
      return updatesPage.releases;
    },
    // The version you updated from, when this install is fresh from an update.
    get from() {
      return updatesPage.from;
    },
    check: checkForUpdates,
  },
  // { status: 'loading' | 'ok' | 'error', quip, list }
  get knownIssues() {
    return issuesPage;
  },
  priceOf: (name) => (state.priceOf ? state.priceOf(name) : null),
  // For Stats (ui/stats): which page is showing, what's still loading, and the
  // helpers its tabs share with the classic pages.
  get view() {
    return currentView();
  },
  get pricesLoading() {
    return !!pricesLoading;
  },
  get loanersLoaded() {
    return { matrix: !!loanerMatrix, included: !!includedVessels };
  },
  statsTabs: STATS_TABS,
  bbKinds: BB_KINDS,
  presentKinds,
  insLabel,
  titleCase,
  nextTokenDate,
  buybackName,
  bbDetail,
  bbPrice,
  ownedShips,
  loanersOf,
  includedOf,
  // For Org Fleet (ui/org): whether it's showing, the stored members (null until it
  // first shows), the fleet math, and its buttons (each resolves to a message).
  org: {
    get active() {
      return currentView() === 'org';
    },
    get members() {
      return orgMembers;
    },
    fleet: (members) => OH.orgFleet(members, state.shipOf, state.priceOf),
    titleCase,
    importFiles: importOrgFiles,
    addMine: addMyOrgFleet,
    exportCsv: exportOrgCsv,
    remove: removeOrgMember,
  },
  // For the Store page (ui/store): what it reads, and the few actions it takes.
  store: {
    get active() {
      return currentView() === 'store';
    },
    // The store catalog has loaded (In Store Now can be answered).
    get feedLoaded() {
      return !!catalog;
    },
    get undo() {
      return wishUndo ? { name: wishTitle(wishUndo.entry) } : null;
    },
    wishSorts: WISH_SORTS,
    shipStates: SHIP_STATES,
    wishlistOrder,
    wishKey,
    wishTitle,
    wishShips,
    shipEntry,
    shipKey,
    ownedShips,
    storeOf,
    // A wishlist entry (or ship name) as the "In Store Now" cell shows it: { cls,
    // text, title, url }, or null until the catalog has loaded.
    stock: stockLabel,
    wishStatus: (e) => (catalog ? wishStatus(e) : null),
    upgradeCost: (cat, item, fromMsrp) => OH.upgradeCost(cat, item, fromMsrp),
    // Find in Store: the catalog (null until loaded), and adding or removing one
    // of its items (a ship by name, anything else as an entry) on the wishlist.
    get catalog() {
      return catalog;
    },
    loadCatalog: () => ensureCatalog(),
    onWishlist: onWishlistItem,
    toggleWish: toggleWishItem,
    sameShip,
    // Home's Wishlist Watch: the last check (null if never), its rows, Check Now.
    get wishWatch() {
      return wishWatch
        ? { at: wishWatch.at, checking: wishChecking }
        : { at: null, checking: wishChecking };
    },
    wishWatchRows,
    checkWishlist,
    buybackHasShip,
    buybackName,
    bbFullName,
    bbPriceText,
    reclaimOf,
    uncheckedPacks,
    setWishSort,
    setWishOrder,
    // Your Subscriber Store: { list, loading, error, done, total, account } and Refresh.
    get sub() {
      return subStore;
    },
    refreshSub: () => loadSubStore({ force: true }),
  },
  // For Developers (ui/developers): its links, supporters, the data tools' state
  // (note under the buttons, restore button, saved accounts) and their actions.
  // The top bar (ui/topbar): the Scan button and its ▾ menu, your menu's switches
  // and actions. The page links' counts, the account, Streamer Mode and the alerts
  // come from the getters above (state, account, streamer, alerts).
  top: {
    get bar() {
      return topBar;
    },
    get view() {
      return currentView();
    },
    get currencyNote() {
      return currencyNote();
    },
    scan: scanChosen,
    setSources: setScanSources,
    setCurrency: pickCurrency,
    setStreamer: async (on) => {
      streamer.on = !!on;
      document.documentElement.classList.toggle('streamer', streamer.on);
      homeUpdated();
      await chrome.storage.local.set({ streamerMode: streamer.on });
      route(); // redraw the page with (or without) amounts
      renderAccount();
    },
    setRemind: (on) => {
      topBar.remind = !!on;
      homeUpdated();
      chrome.storage.local.set({ remindRescan: topBar.remind });
    },
    logOut,
    clearData,
    reload: () => $('#update-reload')?.click(),
    closeMenus: closeCardMenus,
    // The scan report's buttons: Send Flight Log (copy, then #bug-reports on
    // Discord, #315), and a prefilled Scan Broken issue (#250).
    sendFlightLog: () => sendFlightLog(null),
    reportProblem: () => topBar.report && openScanReport(topBar.report.summary),
  },
  // The detail windows (ui/details): what each shows, and what they do.
  detail: {
    item: itemView,
    bb: bbView,
    ship: shipView,
    loadBb: loadBbContents,
    toggleWish: (name) => {
      toggleWishlist(name);
      if (currentView() === 'store') renderStore();
      homeUpdated();
    },
    // A thumbnail's sharper copy (resolved once, shared): a promise of its URL or null.
    hiRes: (thumb) => (hiResCandidates(thumb).length ? loadHiRes(thumb) : Promise.resolve(null)),
    loadImage,
  },
  // @sync-start
  // The website (ui/site): the Connect card's and the Scan button's state and
  // actions. Cut only from a build with the `sync` flag off.
  site: {
    get state() {
      return site;
    },
    connect: siteConnect,
    cancel: siteCancel,
    reopen: () => site.waiting && chrome.tabs.create({ url: site.waiting.url }),
    sync: siteSyncNow,
    // The scan report's Sync It (true) and Don't Sync (false) for a new RSI account.
    answer: siteSyncAnswer,
    open: async () => chrome.tabs.create({ url: `${await OH.siteUrl()}/hangar` }),
    disconnect: siteDisconnect,
  },
  // @sync-end
  // Global Hangar Search (ui/search): what matches (see searchResults), and its
  // one action, reading the buy-back packs never checked (opt-in, on Buy-Backs).
  search: {
    results: (q) => {
      ensurePrices();
      return searchResults(q);
    },
    getDetails: () => {
      location.hash = '#buybacks';
      loadBuybackDetails({ packsOnly: true });
    },
  },
  dev: {
    links: [
      [REPO_URL, 'GitHub'],
      [DISCORD_URL, 'Discord'],
      [IDEAS_URL, 'Suggest a Feature'],
      [KOFI_URL, 'Tip on Ko-fi'],
      [PATREON_URL, 'Support on Patreon'],
    ],
    repoUrl: REPO_URL,
    discordUrl: DISCORD_URL,
    contributors: CONTRIBUTORS,
    boosters: BOOSTERS,
    get msg() {
      return { text: dev.msg, error: dev.msgError };
    },
    get recovery() {
      return dev.recovery;
    },
    get profiles() {
      return dev.profiles;
    },
    exportJson,
    exportHtf,
    importBackup,
    restoreBackup,
    removeProfile,
    copyFlightLog: () => copyFlightLog(null),
  },
};
