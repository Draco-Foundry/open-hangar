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
const chipsEl = $('#chips');
const resultsEl = $('#results');
const scanBtn = $('#scan-home');
const scanMenuBtn = $('#scan-menu-btn');
const scanMenu = $('#scan-menu');
const scanSelectedBtn = $('#scan-selected');
const logoutBtn = $('#logout-home');
const clearBtn = $('#clear-home');
const searchEl = $('#search');
const sortEl = $('#sort');
const layoutEl = $('#layout');
const buybacksBodyEl = $('#buybacks-body');
const bbSearchEl = $('#bb-search');
const bbSortEl = $('#bb-sort');
const bbChipsEl = $('#bb-chips');
const bbLayoutEl = $('#bb-layout');

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
// [start, end]. Will go stale as CIG adds ~monthly events — see TODO for the planned
// auto-refresh; until then, append new events here.
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
  bbUnder: false, // Buy-Backs: only ones below today's store price
  bbStack: false, // Buy-Backs: stack identical ones (off: each buy-back is its own)
  bbHideSmall: true, // Buy-Backs: paints, add-ons, coupons tucked away
  hideSmall: false, // Inventory: same
  savedViews: [], // Inventory saved views: { name, shown, traits, query, sort }
  bbSort: 'date-desc', // default to newest buy-backs first
  groupByType: true, // Inventory: one section per type
  bbDetails: {}, // pledge id → details read from the buy-back's own RSI page
  bbShown: new Set(), // buy-back kind filter
  bbTraits: new Map(), // buy-back trait filter (AND): key → 'yes' | 'no'
  bbLayout: 'gallery', // gallery | compact | list | market (independent of inventory)
  owner: null, // { nickname, displayname } the stored data was scanned from
  storeCredit: null, // dollars, from the RSI account (counts in Account Value)
  shown: new Set(), // inventory kind filter
  traits: new Map(), // inventory trait filter (AND): key → 'yes' | 'no' (exclude)
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
  priceTab: 'flight-ready', // Store → Ship Prices tab
  wishSort: 'name', // Store → Wishlist order: name | price-desc | price-asc | stock | mine
  bbPicked: new Set(), // Buy-Backs Market: picked buy-back ids (for totals + exports)
  marketGiftableOnly: false, // Market view: show only sellable (giftable) items
  referral: null, // { code, url, current, legacy, prospects, recruitsList, prospectsList }
  refTab: 'recruits', // referral list tab: 'recruits' | 'prospects'
  refQuery: '', // referral list search
  refSort: 'newest', // referral list sort: newest | oldest | name
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
// Re-rendering a row of chips or toggles swaps out its buttons. If one of them had
// keyboard focus, put focus back on the same control (or the row's first button when
// it's gone, like Clear) so filtering by keyboard doesn't drop you at the page top.
const FOCUS_KEYS = [
  'key',
  'trait',
  'clear',
  'switch',
  'bbUnder',
  'viewApply',
  'viewDel',
  'viewSave',
];
function setHTMLKeepFocus(el, html) {
  const had = document.activeElement;
  const inside = !!(el && had && had !== el && el.contains(had));
  const k = inside ? FOCUS_KEYS.find((a) => a in had.dataset) : null;
  const val = k ? had.dataset[k] : null;
  setHTML(el, html);
  if (!inside) return;
  const same = k && [...el.querySelectorAll('button')].find((b) => b.dataset[k] === val);
  (same || el.querySelector('button'))?.focus({ preventScroll: true });
}
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
    // One click to a paste-ready report for #bug-reports / GitHub.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-btn';
    btn.textContent = 'Copy Error Report';
    btn.addEventListener('click', () => copyErrorReport(btn));
    statusEl.append(' ', btn);
    if (scan) {
      // A failed or partial scan: open a prefilled Scan Broken issue (#250).
      const rep = document.createElement('button');
      rep.type = 'button';
      rep.className = 'link-btn';
      rep.textContent = 'Report a Scan Problem';
      rep.title =
        'Opens a GitHub issue with the error report filled in. Nothing is sent until you submit it.';
      rep.addEventListener('click', () => openScanReport(text));
      statusEl.append(' · ', rep);
    }
  }
}

// Open the prefilled Scan Broken issue in a new tab (#250). Counts and the
// error report only; the person reviews it on GitHub before anything is sent.
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

// Copy OH.errorReport() to the clipboard; `el` shows the outcome briefly.
async function copyErrorReport(el) {
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
      ? 'Copied! Beam it to #bug-reports on Discord or a GitHub issue'
      : 'Copy failed. See Developers → Error report';
    setTimeout(() => {
      el.textContent = was;
    }, 3000);
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

// Scan progress shows in the top bar's Scan button itself (every page): it fills
// as the chosen sources finish ("Scanning… 2/4") and says what it's on in its hover
// text; at the end "✓ Done" (or "⚠ Finished") for a moment, then Scan All again.
const scanProgress = { i: 0, n: 1 };
let scanDoneTimer = null;
// What the scan is on right now ("Buy-backs · page 8 · 800 items"). Never in the
// Citizen Card, where a growing line pushed the card around (#170): the Scan
// button's hover text and its ▾ menu, and on the first scan (the welcome card is
// up) a big progress bar in place of Scan All Now. '' = the scan ended.
function scanDetail(text) {
  const btn = $('#scan-home');
  if (btn && text) btn.title = text;
  const line = $('#scan-menu-progress');
  if (line) {
    line.textContent = text ? `Scanning: ${text}` : '';
    line.hidden = !text;
  }
  const welcome = $('#oh-welcome');
  const prog = $('#welcome-progress');
  const go = $('#welcome-scan');
  if (!prog || !go) return;
  const first = !!welcome && !welcome.hidden;
  prog.hidden = !(first && text);
  go.hidden = first && !!text;
  if (first && text) {
    const { i, n } = scanProgress;
    $('#wp-fill').style.width = `${Math.max(4, Math.min(100, ((i + 0.5) / n) * 100))}%`;
    $('#wp-text').textContent = text;
  }
}
function setScanning(text, done = false) {
  const btn = $('#scan-home');
  if (!btn) return;
  const fill = btn.querySelector('.scan-fill');
  const label = btn.querySelector('.scan-label');
  clearTimeout(scanDoneTimer);
  if (!text) {
    btn.classList.remove('scanning');
    if (fill) fill.style.width = '0';
    updateScanLabel();
    return;
  }
  btn.classList.add('scanning');
  const clean = text.replace(/^[✓⚠]\s*/, '');
  if (done) {
    if (fill) fill.style.width = '100%';
    label.textContent = /^⚠/.test(text) ? '⚠ Rough Landing' : '✓ Landed';
    btn.title = /^⚠/.test(text) ? clean : `${OH.quip('scanDone')} ${clean}`;
    scanDoneTimer = setTimeout(() => setScanning(''), 2200);
    return;
  }
  const { i, n } = scanProgress;
  if (fill) fill.style.width = `${Math.max(6, (i / n) * 100)}%`;
  label.textContent = n > 1 ? `Scanning… ${Math.min(i + 1, n)}/${n}` : 'Scanning…';
  btn.title = `Scanning ${clean}`;
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
// Prices come from the cached star-citizen.wiki catalog (OH.getPriceIndex).
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
  document
    .querySelectorAll('#nav a')
    .forEach((a) => a.classList.toggle('active', a.dataset.view === v));
  renderTopBar();
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

// Top bar extras: counts beside Inventory / Buy-Backs and the Streamer pill.
function renderTopBar() {
  const n = (id, count) => {
    const el = $(id);
    if (el) el.textContent = count ? compactNum(count) : '';
  };
  n('#nav-n-inventory', state.items.length);
  n('#nav-n-buybacks', state.buybacks.length);
  const dot = $('#stream-dot');
  if (dot) dot.hidden = !streamer.on;
  const me = $('#settings-btn');
  if (me) {
    const tip = streamer.on ? 'Your menu · Streamer Mode is on: money is hidden' : 'Your menu';
    me.title = tip;
    me.setAttribute('aria-label', tip);
  }
}

// The bar slims down while you scroll down a long page, and comes back on the way up.
{
  let anchorY = 0; // where the current scroll direction started
  let lockUntil = 0; // ignore the jump the bar's own resize causes
  const header = document.querySelector('.wrap > header');
  // Stuck section headers sit right under the bar (--hdr-h, ui/theme.css), so it
  // has to follow the bar's real height as it slims (#177).
  const syncHeight = () =>
    header && document.documentElement.style.setProperty('--hdr-h', `${header.offsetHeight}px`);
  const setSlim = (on) => {
    if (document.body.classList.contains('bar-slim') === on) return;
    document.body.classList.toggle('bar-slim', on);
    lockUntil = performance.now() + 350;
    syncHeight();
  };
  header?.addEventListener('transitionend', syncHeight);
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      if (performance.now() < lockUntil) {
        anchorY = y;
        return;
      }
      if (y < 140) setSlim(false);
      else if (y - anchorY > 48)
        setSlim(true); // a real move down
      else if (anchorY - y > 48)
        setSlim(false); // a real move up
      else return;
      anchorY = y;
    },
    { passive: true },
  );
  // Border box: slimming only changes the bar's padding, which a content-box
  // observer never sees.
  if (header && 'ResizeObserver' in window) {
    new ResizeObserver(syncHeight).observe(header, { box: 'border-box' });
  }
}

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
const cardSizes = (layout) => `auto, ${CARD_SIZES[layout] || CARD_SIZES.gallery}`;
// Attributes for a card <img> in markup ('' when the URL has no sizes).
function thumbSizeAttrs(url, layout) {
  const set = srcsetFor(url);
  return set ? ` srcset="${OH.escapeHtml(set)}" sizes="${OH.escapeHtml(cardSizes(layout))}"` : '';
}
// The same for an <img> built in code, inside a card grid of some layout.
function setThumbSizes(im, url, grid) {
  const set = srcsetFor(url);
  if (!set) return;
  const layout = ['gallery', 'compact', 'list'].find((l) => grid?.classList.contains(l));
  im.sizes = cardSizes(layout);
  im.srcset = set;
}

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

// After a card grid renders, fill in missing ship art from the wiki API: only for
// cards on (or near) the screen, three at a time, so a 1,000-card page doesn't
// look up a thousand pictures nobody scrolled to. Updates the card thumbnail, its
// data-image (for the hover preview), and the backing item (so the detail modal
// shows it too).
const ART_CONCURRENCY = 3;
const artQueue = [];
let artActive = 0;
let artObserver = null;
// id → item, rebuilt only when the lists themselves are replaced (a scan).
let itemIndex = { items: null, buybacks: null, map: new Map() };
function itemById(id) {
  if (itemIndex.items !== state.items || itemIndex.buybacks !== state.buybacks) {
    const map = new Map();
    for (const b of state.buybacks) map.set(String(b.id), b);
    for (const p of state.items) map.set(String(p.id), p); // pledges win, as before
    itemIndex = { items: state.items, buybacks: state.buybacks, map };
  }
  return itemIndex.map.get(String(id));
}
async function resolveCardArt(card) {
  const art = await OH.getShipImage(card.dataset.resolve);
  const url = art || card.dataset.rsiImage;
  if (!url) return;
  card.dataset.image = url;
  const item = itemById(card.dataset.id);
  if (item) {
    item.image = url;
    if (art) item.shipArt = true; // a CCU's target art is in hand now
  }
  const ph = card.querySelector('.thumb.placeholder');
  if (ph) {
    const im = document.createElement('img');
    im.className = 'thumb';
    im.loading = 'lazy';
    setThumbSizes(im, url, card.closest('.grid'));
    im.src = url;
    ph.replaceWith(im);
  }
}
function pumpArt() {
  while (artActive < ART_CONCURRENCY && artQueue.length) {
    const card = artQueue.shift();
    if (!card.isConnected) continue; // re-rendered away while waiting
    artActive++;
    resolveCardArt(card)
      .catch(() => {})
      .finally(() => {
        artActive--;
        pumpArt();
      });
  }
}
function enhanceCardImages(container) {
  const cards = [...container.querySelectorAll('.card[data-resolve]:not([data-art-watch])')].filter(
    (c) => c.dataset.resolve && !c.querySelector('img.thumb'),
  );
  if (typeof IntersectionObserver === 'undefined') {
    artQueue.push(...cards);
    pumpArt();
    return;
  }
  artObserver ||= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        artObserver.unobserve(e.target);
        artQueue.push(e.target);
      }
      pumpArt();
    },
    { rootMargin: '800px 0px' }, // start a little before a card scrolls into view
  );
  for (const c of cards) {
    c.dataset.artWatch = '1';
    artObserver.observe(c);
  }
}

// Draw a card grid: the first screenful now, the rest a chunk at a time in the
// background, so a page of 1,000 buy-backs responds at once. A newer render of the
// same container cancels the chunks an older one still had queued.
const FIRST_CARDS = 120;
const CARD_CHUNK = 200;
const gridJobs = new WeakMap(); // container → token of its latest render
function renderCardGrid(container, head, layout, list, cardHtml) {
  const token = {};
  gridJobs.set(container, token);
  setHTML(
    container,
    `${head}<div class="grid ${layout}">${list.slice(0, FIRST_CARDS).map(cardHtml).join('')}</div>`,
  );
  enhanceCardImages(container);
  const grid = container.lastElementChild;
  let at = FIRST_CARDS;
  const next = () => {
    if (gridJobs.get(container) !== token || !grid?.isConnected || at >= list.length) return;
    const holder = document.createElement('div');
    setHTML(
      holder,
      list
        .slice(at, at + CARD_CHUNK)
        .map(cardHtml)
        .join(''),
    );
    grid.append(...holder.childNodes);
    at += CARD_CHUNK;
    enhanceCardImages(grid);
    setTimeout(next, 0);
  };
  if (at < list.length) setTimeout(next, 0);
}

// Home's welcome screen: shown until the first scan. Signed out, the card above
// already has the Log In button, so this just says to use it (lastLoggedOut is set
// when the account is read).
function renderWelcome() {
  const el = $('#oh-welcome');
  if (!el) return;
  el.hidden = state.items.length > 0 || state.buybacks.length > 0;
  $('#welcome-scan').hidden = lastLoggedOut;
  $('#welcome-note').textContent = lastLoggedOut
    ? 'First, log in to RSI with the button on the card above, then come back and hit Scan. Your hangar’s waiting.'
    : 'A big hangar takes about a minute, still faster than a Lorville elevator. To scan just part of it, use the ▾ next to Scan.';
}
$('#welcome-scan')?.addEventListener('click', () => {
  if (!scanBtn.disabled) runScan(); // everything, whatever the ▾ menu has ticked
});

// RSI account → the home Citizen Card: avatar, name, est/country/UEE record,
// quick links, balances (Store/UEC/REC), and subscriber/concierge flair.
function renderAccount() {
  const nameEl = $('#cc-name'),
    metaEl = $('#cc-meta'),
    avEl = $('#cc-avatar');
  const orgEl = $('#cc-org');
  const balEl = $('#home-balances'),
    flairEl = $('#home-flair');

  OH.getAccount().then((a) => {
    // Signed out → replace the whole card with the centred "Log In to RSI" wall.
    // Show the wall whenever we DON'T have a confirmed login (false = logged out,
    // null = couldn't determine): in both cases there's no live account data, so a
    // dashed card with no prompt is confusing — better to guide the user to log in.
    // (A confirmed `true` is the only state that shows the normal card.)
    const loggedOut = a.loggedIn !== true;
    const acctEl = $('#cc-account'),
      loEl = $('#cc-loggedout');
    if (acctEl) acctEl.hidden = loggedOut;
    if (loEl) loEl.hidden = !loggedOut;
    if (logoutBtn) logoutBtn.hidden = a.loggedIn !== true;

    updateSignedOutBanner(loggedOut);
    renderWelcome();

    const handle = a.nickname || '';
    const citizenUrl = handle
      ? `https://robertsspaceindustries.com/citizens/${encodeURIComponent(handle)}`
      : null;

    // Portrait: RSI keeps a 1024px original next to the 165px thumbnail the account
    // page links; use it (the thumbnail stays underneath as a fallback layer).
    if (avEl) {
      const thumb = safeBgUrl(a.avatar);
      const big = /\/heap_infobox\//.test(a.avatar || '')
        ? safeBgUrl(a.avatar.replace('/heap_infobox/', '/source/'))
        : '';
      avEl.style.backgroundImage = [big, thumb].filter(Boolean).join(', ');
      // No portrait on RSI: the name's initials instead of an empty panel.
      const nm = a.displayname || a.nickname || '';
      avEl.textContent = thumb
        ? ''
        : nm
            .split(/[\s_-]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join('');
    }
    const menuAv = $('#menu-avatar');
    if (menuAv) {
      const thumb = a.loggedIn ? safeBgUrl(a.avatar) : '';
      menuAv.classList.toggle('has-pic', !!thumb);
      menuAv.style.backgroundImage = thumb;
    }
    const who = $('#menu-who');
    if (who) {
      who.hidden = !a.loggedIn;
      if (a.loggedIn) {
        const org =
          a.org && a.org.name ? `${a.org.name}${a.org.rank ? ` · ${a.org.rank}` : ''}` : '';
        setHTML(
          who,
          `<span class="mw-pic"></span><span><b>${OH.escapeHtml(a.displayname || a.nickname || '')}</b>${org ? `<small>${OH.escapeHtml(org)}</small>` : ''}</span>`,
        );
        who.querySelector('.mw-pic').style.backgroundImage = safeBgUrl(a.avatar);
      }
    }
    const photo = $('#cc-photo');
    if (photo) {
      if (citizenUrl) photo.href = citizenUrl;
      else photo.removeAttribute('href');
      photo.title = citizenUrl ? 'Open your RSI citizen page' : '';
    }

    // Name → the citizen page (plain white, underline on hover).
    if (nameEl) {
      const name = a.displayname || a.nickname || (a.loggedIn === false ? 'Not signed in' : DASH);
      setHTML(
        nameEl,
        citizenUrl
          ? `<a class="cc-plain" href="${OH.escapeHtml(citizenUrl)}" target="_blank" rel="noopener" title="Open your RSI citizen page">${OH.escapeHtml(name)}</a>`
          : OH.escapeHtml(name),
      );
    }

    // UEE record · Est. <month year> · <n> years (full date on hover).
    if (metaEl) {
      if (a.loggedIn) {
        const d = a.enlistedSince ? new Date(a.enlistedSince) : null;
        const ok = d && !isNaN(d.getTime());
        const parts = [];
        if (a.citizenRecord) parts.push(`UEE ${OH.escapeHtml(a.citizenRecord)}`);
        if (ok) {
          const my = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          parts.push(
            `<span title="Enlisted ${OH.escapeHtml(fmtEnlisted(a.enlistedSince))}">Est. ${OH.escapeHtml(my)}</span>`,
          );
          const now = new Date();
          let yrs = now.getFullYear() - d.getFullYear();
          if (
            now.getMonth() < d.getMonth() ||
            (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
          )
            yrs--;
          if (yrs >= 1) parts.push(`${yrs} year${yrs === 1 ? '' : 's'}`);
        }
        setHTML(metaEl, parts.join(' · '));
      } else {
        setHTML(metaEl, '');
      }
    }

    // Main org only: logo + name (rank under it), one plain link to the org page,
    // and the logo again as a faint watermark. No org, or a hidden/redacted one:
    // nothing at all (owner, 2026-09-30).
    const waterEl = $('#cc-water');
    if (orgEl) {
      const org = a.loggedIn ? a.org : null;
      if (org && org.name) {
        const logo = org.logo
          ? `<img class="cc-org-logo" src="${OH.escapeHtml(org.logo)}" alt="" loading="lazy">`
          : '';
        const inner =
          `${logo}<span class="cc-org-text">` +
          `<span class="cc-org-name">${OH.escapeHtml(org.name)}</span>` +
          (org.rank ? `<span class="cc-org-rank">${OH.escapeHtml(org.rank)}</span>` : '') +
          `</span>`;
        setHTML(
          orgEl,
          org.sid
            ? `<a class="cc-org-link" href="https://robertsspaceindustries.com/orgs/${encodeURIComponent(org.sid)}" target="_blank" rel="noopener" title="Open ${OH.escapeHtml(org.name)} on RSI">${inner}</a>`
            : `<span class="cc-org-link">${inner}</span>`,
        );
        orgEl.hidden = false;
      } else {
        setHTML(orgEl, '');
        orgEl.hidden = true;
      }
      if (waterEl) {
        if (org && org.logo) waterEl.src = org.logo;
        waterEl.hidden = !(org && org.logo);
      }
    }

    // Subscriber + Chairman's Club on one line; each only when it applies.
    if (flairEl) {
      const parts = [];
      if (a.subscriber?.type) {
        parts.push(
          `<a class="flair sub" href="https://robertsspaceindustries.com/en/pledge/subscriptions" target="_blank" rel="noopener"><span class="flair-lbl">Subscriber</span> <b>${OH.escapeHtml(a.subscriber.type)}</b></a>`,
        );
      }
      if (a.concierge?.level) {
        const col = CONCIERGE_COLORS[a.concierge.level.toLowerCase()] || '#d2a8ff';
        const next = a.concierge.next
          ? ` title="${Number(a.concierge.percent) || 0}% of the way to ${OH.escapeHtml(a.concierge.next)}"`
          : '';
        parts.push(
          `<a class="flair concierge" href="https://robertsspaceindustries.com/en/account/concierge" target="_blank" rel="noopener"${next}><span class="flair-lbl">Chairman's Club</span> <b style="color:${col}">${OH.escapeHtml(a.concierge.level)}</b></a>`,
        );
      }
      setHTML(flairEl, parts.join(''));
      flairEl.hidden = !parts.length;
    }

    // Wallet: Store Credit, UEC, REC, Buy-Back Tokens (the next token's date is on Game Status).
    // Big amounts are shortened (¤ 1.2M); the exact figure is in the hover text.
    // Streamer Mode turns the money and aUEC amounts into dots.
    if (balEl) {
      const c = a.credits || {};
      const fmt = (n) => Number(n).toLocaleString('en-US');
      const tile = (cls, label, val, full) =>
        `<span class="bal ${cls}"${full && full !== val ? ` title="${OH.escapeHtml(full)}"` : ''}><span class="bal-lbl">${label}</span><b>${val}</b></span>`;
      // A no-break space after ¤ so the symbol doesn't crowd the digits.
      const aUEC = (x) =>
        !x ? [DASH] : streamer.on ? [MASK] : ['¤ ' + compactNum(x.value), '¤ ' + fmt(x.value)];
      const store = c.store ? c.store.value / 100 : null;
      if (store !== state.storeCredit) {
        state.storeCredit = store;
        homeUpdated();
      }
      setHTML(
        balEl,
        tile(
          'store',
          'Store Credit',
          store != null ? shortMoney(store, money) : DASH,
          store != null ? money(store) : '',
        ) +
          tile('uec', 'UEC', ...aUEC(c.uec)) +
          tile('rec', 'REC', ...aUEC(c.rec)) +
          `<a class="bal bbt" href="#buybacks" data-view="buybacks" title="${OH.escapeHtml(
            tokenTitle(),
          )}"><span class="bal-lbl">Buy-Back Tokens</span><b>${
            state.bbTokens != null ? state.bbTokens : DASH
          }</b></a>`,
      );
    }
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

// --- Home: quick-info panels -------------------------------------------------
// "Wishlist: On Sale Now" (wishlist ships in RSI's store right now, from each
// ship's store page) and "At a Glance" (tokens, next referral reward, loaners).
async function wishlistStock({ force = false } = {}) {
  await ensureStore();
  const out = [];
  for (const name of state.wishlist) {
    const s = storeOf(name);
    const st = s && s.link ? await OH.getShipStock(s.link, fetch, { force }) : null;
    if (st && st.state) stockMem.set(s.link, st.state);
    out.push({ name: (shipEntry(name) || {}).name || name, st });
  }
  return out;
}
function renderHome() {
  ensurePrices();
  renderEventBanner();
  renderAccount();
  const has = state.items.length > 0;
  document.getElementById('view-home').classList.toggle('no-data', !has);
  if (clearBtn) clearBtn.hidden = !(state.items.length || state.scannedAt);
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
  const dev = $('#dev-links');
  if (dev)
    setHTML(
      dev,
      link(REPO_URL, 'GitHub') +
        link(DISCORD_URL, 'Discord') +
        link(IDEAS_URL, 'Suggest a Feature') +
        link(KOFI_URL, 'Tip on Ko-fi') +
        link(PATREON_URL, 'Support on Patreon'),
    );
}

// Developers page "Thanks & supporters": render contributor / booster chips,
// or a friendly placeholder while the lists (and Discord) aren't set up yet.
function renderSupporters() {
  const chip = (s, cls = '') => {
    const label = OH.escapeHtml(s.name);
    return s.url
      ? `<a class="sup-chip ${cls}" href="${s.url}" target="_blank" rel="noopener">${label}</a>`
      : `<span class="sup-chip ${cls}">${label}</span>`;
  };
  const c = $('#sup-contributors');
  if (c) {
    setHTML(
      c,
      CONTRIBUTORS.length
        ? CONTRIBUTORS.map((s) => chip(s)).join('')
        : `<span class="muted">Empty crew roster. Be the first: ${link(REPO_URL, 'contributions welcome')}.</span>`,
    );
  }
  const b = $('#sup-boosters');
  if (b) {
    setHTML(
      b,
      BOOSTERS.length
        ? BOOSTERS.map((s) => chip(s, 'booster')).join('')
        : `<span class="muted">Boosters get their names up in lights here. ${link(DISCORD_URL, 'Join the Discord')}.</span>`,
    );
  }
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
  // Traits narrow further: a pledge must have every selected trait.
  list = applyTraits(list, state.traits, pledgeFacets);
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
      "Paid less than today's store price (star-citizen.wiki): warbonds, sales, older cheaper pricing. Ship pledges and CCUs.",
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

// A trait chip cycles off → include → exclude → off. Exclude means "known not
// to have it": unknown values (older scans, buy-backs) match neither.
const traitNeg = (t) => t.neg || ((f) => !t.test(f));
function traitMatch(t, mode, f) {
  return mode === 'no' ? traitNeg(t)(f) : t.test(f);
}
function cycleTrait(selected, key) {
  const mode = selected.get(key);
  if (!mode) selected.set(key, 'yes');
  else if (mode === 'yes') selected.set(key, 'no');
  else selected.delete(key);
}

// Keep only items matching every selected trait (in its include/exclude mode).
function applyTraits(list, selected, facets) {
  if (!selected.size) return list;
  const picked = TRAITS.filter((t) => selected.has(t.key));
  return list.filter((x) => {
    const f = facets(x);
    return picked.every((t) => traitMatch(t, selected.get(t.key), f));
  });
}

// Second chip row: traits present in `list`, plus Clear when anything is picked.
// `skip`: trait keys that make no sense on this page.
function traitRowHtml(list, selected, facets, anyFilter, skip = []) {
  const all = list.map(facets);
  const chips = TRAITS.filter((t) => !skip.includes(t.key))
    .map((t) => {
      const mode = selected.get(t.key);
      const yes = all.filter(t.test).length;
      const no = all.filter(traitNeg(t)).length;
      // Offer a trait only when it splits the list (some have it, some are known
      // not to) — or when it's already picked, so it can still be cleared.
      if (!mode && (!yes || yes === all.length)) return '';
      const label = mode === 'no' ? t.notLabel || `Not ${t.label}` : t.label;
      const n = mode === 'no' ? no : yes;
      const hint =
        mode === 'yes' ? 'Click again to exclude' : mode === 'no' ? 'Click to clear' : '';
      const title = hint ? `${t.title} · ${hint}` : t.title;
      const k = t.key === 'pack' || t.key === 'package' ? ` k-${t.key}` : '';
      return `<button class="chip trait${k}" data-trait="${t.key}" data-mode="${mode || ''}" aria-pressed="${!!mode}" title="${OH.escapeHtml(title)}">${OH.escapeHtml(
        label,
      )}<span class="n">${n}</span></button>`;
    })
    .join('');
  const clear = anyFilter ? '<button class="chip chip-clear" data-clear="1">Clear</button>' : '';
  return chips || clear ? `<div class="chip-row chip-row-traits">${chips}${clear}</div>` : '';
}

function chipHtml(kind) {
  const n = state.items.filter((p) => p.kind === kind.key).length;
  // With no selection everything shows, so every chip reads as active; once any
  // chip is picked only the picked ones stay active (the rest dim via CSS).
  const active = state.shown.size === 0 || state.shown.has(kind.key);
  return `<button class="chip k-${kind.key}" data-key="${kind.key}" aria-pressed="${active}">${OH.escapeHtml(
    kind.label,
  )}<span class="n">${n}</span></button>`;
}

// M / G tags on a card: green = RSI says yes, red = no, grey = unknown (scans
// made before meltability was read). Colour isn't the only signal — the
// tooltip and aria-label spell it out.
function flagHtml(letter, value, yes, no) {
  const state = value === true ? 'yes' : value === false ? 'no' : 'unk';
  const label = value === true ? yes : value === false ? no : `${yes}: unknown — rescan`;
  const word = value == null ? `${yes}?` : yes; // red / green carries the yes or no
  return `<span class="flag ${state}" title="${label}" aria-label="${label}"><span class="fl-s">${letter}</span><span class="fl-l">${word}</span></span>`;
}
function flagsHtml(p) {
  return `<span class="flags">${flagHtml('M', p.meltable, 'Meltable', 'Not Meltable')}${flagHtml(
    'G',
    p.giftable,
    'Giftable',
    'Not Giftable',
  )}</span>`;
}

// Hover text on a card's price: what the ships in it sell for today.
function valTitle(p) {
  const si = storeInfo(p);
  if (!si || !si.store) return '';
  const tail = si.unpriced ? ` (+${si.unpriced} unpriced)` : '';
  return ` title="Ships at today's store price: ${dollars(si.store)}${tail}"`;
}

function cardHtml(p) {
  const contents = extraContents(p);
  // A CCU shows the ship it upgrades to (looked up by enhanceCardImages); RSI's
  // own art for it is a generic upgrade picture, kept only as the fallback.
  const ccuArt = p.isCCU && p.ccu && p.ccu.to && !p.shipArt;
  const img = ccuArt ? null : realImage(p.image);
  // Ship name for art lookup: used when RSI gives no image, and as a fallback if
  // RSI's image link turns out to be broken (see onThumbError).
  const resolve = resolveImageName(p);
  const thumb = img
    ? `<img class="thumb" loading="lazy" data-kind="${OH.escapeHtml(p.kind)}" src="${OH.escapeHtml(img)}"${thumbSizeAttrs(img, state.layout)} alt="">`
    : `<div class="thumb placeholder">${OH.escapeHtml(p.kind)}</div>`;
  const nameHtml =
    p.isCCU && p.ccu
      ? `${OH.escapeHtml(p.ccu.from)} <span class="ccu-flow">→</span> ${OH.escapeHtml(p.ccu.to)}`
      : OH.escapeHtml(cardName(p));
  // Always emit the contents cell (empty when there's nothing) so the List view's
  // fixed column grid stays aligned across rows — items with vs. without contents
  // must occupy the same number of grid cells. Gallery/compact hide empties via CSS.
  let contentsLine = '<div class="card-contents"></div>';
  if (!p.isCCU && contents.length) {
    const head = contents.slice(0, 4).join(' · ');
    const more = contents.length > 4 ? ` +${contents.length - 4}` : '';
    contentsLine = `<div class="card-contents">${OH.escapeHtml(head)}${more}</div>`;
  }
  const type = pledgeType(p);
  const badgeClass = TYPE_KEYS.includes(type) ? type : '';
  const sel = state.selecting && state.selected.has(String(p.id)) ? ' selected' : '';
  const rsiImg = ccuArt ? realImage(p.image) || '' : '';
  return `<div class="card${sel}" tabindex="0" role="button" data-id="${OH.escapeHtml(String(p.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}" data-rsi-image="${OH.escapeHtml(rsiImg)}">
    ${thumb}
    <div class="card-body">
      <div class="card-name" title="${OH.escapeHtml(plainName(p))}">${nameHtml}</div>
      ${contentsLine}
      <div class="card-ins" title="Insurance">${OH.escapeHtml(insLabel(p.insurance))}</div>
      <div class="card-foot">
        <span class="foot-left"><span class="badge ${badgeClass}">${OH.escapeHtml(type)}</span>${flagsHtml(p)}</span>
        <span class="val"${valTitle(p)}>${OH.escapeHtml(formatValue(p))}${underStoreHtml(p)}</span>
      </div>
    </div>
  </div>`;
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

// One stacked row. `g` is { key, rep, stock } — a representative pledge plus how
// many identical copies were merged into it (the Stock).
function marketRowHtml(g) {
  const p = g.rep;
  const key = OH.escapeHtml(g.key);
  const melt = meltLabel(p);
  const saved = state.market[g.key];
  const price = saved && saved.price != null ? OH.escapeHtml(String(saved.price)) : '';
  const gift = giftableLabel(g);
  const picked = g.ids.every((id) => state.selected.has(id));
  const pct = OH.escapeHtml(pctOfMelt(saved && saved.price, p.value * fx.rate));
  return `<tr class="mk-row${picked ? ' picked' : ''}" data-key="${key}" data-melt="${Number.isFinite(p.value) ? p.value * fx.rate : ''}">
    <td class="mk-sel"><input type="checkbox" class="mk-pick" ${picked ? 'checked' : ''} aria-label="Pick for export"></td>
    <td class="mk-name">${OH.escapeHtml(plainName(p))}</td>
    <td class="mk-ins">${OH.escapeHtml(marketInsurance(p))}</td>
    <td class="mk-gift gift-${g.giftable === 0 ? 'no' : 'yes'}">${gift}</td>
    <td class="mk-melt">${OH.escapeHtml(melt)}</td>
    <td class="mk-store">${OH.escapeHtml(marketStore(p)) || '<span class="muted">—</span>'}</td>
    <td class="mk-pct"><input class="mk-pct-in" type="text" inputmode="decimal" value="${pct}" placeholder="%" aria-label="Percent of melt"></td>
    <td class="mk-mine"><input class="mk-price" type="text" inputmode="decimal" value="${price}" placeholder="$" aria-label="My price"></td>
    <td class="mk-stock">${g.stock}</td>
    <td class="mk-view">${viewOnRsiLink(p)}</td>
  </tr>`;
}

function marketTableHtml(section, groups) {
  return `<section class="market-section">
    <h3 class="market-title">${OH.escapeHtml(section.label)}<span class="market-n">${groups.length}</span></h3>
    <table class="market-table">
      <thead><tr>
        <th class="mk-sel"><input type="checkbox" class="mk-pick-all" aria-label="Pick all in ${OH.escapeHtml(section.label)}" ${
          groups.every((g) => g.ids.every((id) => state.selected.has(id))) ? 'checked' : ''
        }></th><th>Items Name</th><th>Insurance</th><th>Giftable</th><th>Melt Price</th><th title="Today's standard store price (ships, or a CCU's price gap)">Store Price</th>
        <th title="Your price as a percent of melt value">% of Melt</th><th>My Price</th><th>Stock</th><th title="Open the pledge in your RSI hangar, e.g. to screenshot its details">RSI</th>
      </tr></thead>
      <tbody>${groups.map(marketRowHtml).join('')}</tbody>
    </table>
  </section>`;
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

function marketToolbarHtml(shown) {
  return `<div class="market-toolbar">
    <div class="result-count">Showing ${shown.length} of ${state.items.length} · Melt ${money(OH.totalValue(shown))}<span class="mk-selcount">${marketSelText()}</span></div>
    <div class="market-actions">
      <label class="mk-toggle"><input type="checkbox" class="mk-giftable-only" ${
        state.marketGiftableOnly ? 'checked' : ''
      }> Giftable Only</label>
      <button class="mk-btn mk-export-csv" type="button">Export CSV</button>
      <button class="mk-btn mk-export-img" type="button">Download Image</button>
      <span class="mk-export-status" aria-live="polite"></span>
    </div>
  </div>`;
}

function renderMarket() {
  const shown = marketShown();
  const sections = computeMarketSections(shown);
  const body = sections.length
    ? `<div class="market">${sections.map(({ section, groups }) => marketTableHtml(section, groups)).join('')}</div>`
    : '<div class="empty">No meltable pledges match the current filters.</div>';
  setHTML(resultsEl, marketToolbarHtml(shown) + body);
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
function switchHtml(key, label, on, title) {
  return `<button type="button" class="oh-sw${on ? ' on' : ''}" data-switch="${key}" aria-pressed="${on}" title="${OH.escapeHtml(title)}"><span class="sw-t"></span>${OH.escapeHtml(label)}</button>`;
}
// Summary strip on top of Inventory: follows the filters.
function renderInvSummary(shown) {
  const el = $('#inv-sum');
  if (!el) return;
  const filtered = shown.length !== state.items.length;
  let store = 0;
  for (const p of shown) store += (storeInfo(p) || {}).store || 0;
  const stat = (l, v) =>
    `<div class="ps-st"><div class="ps-l">${l}</div><div class="ps-v">${v}</div></div>`;
  setHTML(
    el,
    `<div><h2>Inventory</h2>${filtered ? `<div class="ps-note">Totals follow your filters (${shown.length} of ${state.items.length})</div>` : ''}</div><div class="ps-stats">` +
      stat('Pledges', compactNum(shown.length)) +
      stat('Melt Value', OHApp.bigMoney(OH.totalValue(shown))) +
      (store ? stat('Store Value', OHApp.bigMoney(store)) : '') +
      '</div>',
  );
}
// Summary strip on top of Buy-Backs.
function renderBbSummary() {
  const el = $('#bb-sum');
  if (!el) return;
  const under = state.buybacks.filter(bbUnderStore).length;
  const next = nextTokenDate();
  const nextShort = next ? next.replace(/^\w+, /, '').replace(/, \d{4}$/, '') : '';
  const stat = (l, v, t) =>
    `<div class="ps-st"${t ? ` title="${OH.escapeHtml(t)}"` : ''}><div class="ps-l">${l}</div><div class="ps-v">${v}</div></div>`;
  setHTML(
    el,
    `<div><h2>Buy-Backs</h2></div><div class="ps-stats">` +
      stat('Buy-Backs', compactNum(state.buybacks.length)) +
      stat(
        'Tokens',
        `${state.bbTokens != null ? state.bbTokens : '—'}${nextShort ? `<small>next ${OH.escapeHtml(nextShort)}</small>` : ''}`,
        tokenTitle(),
      ) +
      (under
        ? stat('Below Store Price', `<span class="ps-good">${compactNum(under)}</span>`)
        : '') +
      '</div>',
  );
}
// "$20 under store" in green when today's store price is above what the pledge holds.
function underStoreHtml(p) {
  const si = storeInfo(p);
  // Only for pledges that hold money (a $0 reward isn't a bargain on the store).
  const gap = si && si.store && Number.isFinite(p.value) && p.value > 0 ? si.store - p.value : 0;
  return gap >= 1 ? `<small class="under">${OH.escapeHtml(dollars(gap))} under store</small>` : '';
}
// A buy-back cheaper than the same ship in today's store (exact price loaded).
function bbUnderStore(b) {
  const d = bbDetail(b);
  const sp = buybackStorePrice(b);
  return !!(d && d.price != null && sp && sp - d.price >= 1);
}
function bbUnderHtml(b) {
  if (!bbUnderStore(b)) return '';
  return `<small class="under">${OH.escapeHtml(dollars(buybackStorePrice(b) - bbDetail(b).price))} under store</small>`;
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
// Saved views: one click back to a set of filters (Inventory).
function renderSavedViews() {
  const el = $('#inv-views');
  if (!el) return;
  const cur = JSON.stringify(currentView_inv());
  setHTMLKeepFocus(
    el,
    (state.savedViews.length ? '<span class="views-lbl">Saved Views</span>' : '') +
      state.savedViews
        .map(
          (v, i) =>
            `<span class="view-chip${JSON.stringify(v.f) === cur ? ' on' : ''}"><button type="button" data-view-apply="${i}">★ ${OH.escapeHtml(v.name)}</button><button type="button" class="view-x" data-view-del="${i}" title="Remove this view" aria-label="Remove ${OH.escapeHtml(v.name)}">×</button></span>`,
        )
        .join('') +
      '<button type="button" class="view-add" data-view-save>+ Save This View</button>',
  );
}
function currentView_inv() {
  return {
    shown: [...state.shown].sort(),
    traits: [...state.traits.entries()].sort(),
    query: state.query.trim(),
    hideSmall: state.hideSmall,
  };
}
function saveViews() {
  chrome.storage.local.set({ savedViews: state.savedViews });
}
// Melt planner (Select mode): what the picked pledges give back, and which ships
// on your wishlist that buys, in the store or from your buy-backs.
function renderMeltPlanner() {
  const el = $('#sb-melt');
  if (!el) return;
  const picked = state.items.filter((p) => state.selected.has(p.id));
  const total = picked.reduce((a, p) => a + (isMeltable(p) ? p.value : 0), 0);
  el.hidden = !picked.length || !total;
  if (el.hidden) return;
  const esc = OH.escapeHtml;
  const wish = state.wishlist || [];
  const priced = wish
    .map((name) => ({ name, price: state.priceOf ? (state.priceOf(name) || {}).msrp : null }))
    .filter((x) => x.price);
  const fits = priced.filter((x) => x.price <= total).sort((a, b) => b.price - a.price);
  // Wishlist ships waiting in your buy-backs at or under the total.
  const wl = new Set(wish.map((w) => String(w).toLowerCase()));
  const inBb = state.buybacks
    .map((b) => ({
      b,
      ship: state.shipOf ? state.shipOf(resolveImageName(b)) : null,
      price: bbPrice(b),
    }))
    .filter(
      (x) => x.ship && wl.has(String(x.ship.name).toLowerCase()) && x.price && x.price <= total,
    );
  let buys;
  if (!wish.length) buys = 'Add ships to your wishlist to see what this buys.';
  else if (fits.length)
    buys = `That buys a <b>${esc(fits[0].name)}</b> (${esc(dollars(fits[0].price))}) from your wishlist${
      total - fits[0].price >= 1 ? `, with ${esc(dollars(total - fits[0].price))} left` : ''
    }.`;
  else {
    const cheapest = priced.sort((a, b) => a.price - b.price)[0];
    buys = cheapest
      ? `Not enough for your wishlist yet: the cheapest is ${esc(cheapest.name)} (${esc(dollars(cheapest.price))}).`
      : '';
  }
  if (inBb.length) {
    const x = inBb.sort((a, b) => b.price - a.price)[0];
    buys += ` Or get the <b>${esc(x.ship.name)}</b> back from your buy-backs for ${esc(dollars(x.price))} (with store credit that takes a buy-back token; cash buy-backs don't).`;
  }
  const lti = picked.filter((p) => p.insurance === 'LTI').length;
  if (lti) buys += ` <span class="sb-warn">You'd lose LTI on ${lti}.</span>`;
  setHTML(el, `<b class="sb-total">${esc(dollars(total))}</b> ${buys}`);
}

function renderInventory() {
  ensurePrices();
  updateSelectBar();
  layoutEl
    .querySelectorAll('button')
    .forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  if (!state.items.length) {
    setHTML(chipsEl, '');
    setHTML(
      resultsEl,
      `<div class="empty">${OH.quip('emptyHangar')} Hit Scan at the top to fill it.</div>`,
    );
    return;
  }
  setHTMLKeepFocus(
    chipsEl,
    `<div class="chip-row">${presentKinds().map(chipHtml).join('')}<span class="sw-group">${switchHtml('inv-hide', 'Hide Small Stuff', state.hideSmall, 'Paints, add-ons and coupons')}</span></div>` +
      traitRowHtml(state.items, state.traits, pledgeFacets, state.shown.size || state.traits.size),
  );
  renderSavedViews();
  const shown = computeShown();
  renderInvSummary(shown);
  if (!shown.length) {
    setHTML(
      resultsEl,
      '<div class="empty">Nothing in your hangar matches those filters. Loosen them up, pilot.</div>',
    );
    return;
  }
  if (state.layout === 'market') {
    renderMarket();
    return;
  }
  const groupToggle = `<label class="mk-toggle inv-group-toggle"><input type="checkbox" class="inv-group" ${
    state.groupByType ? 'checked' : ''
  }> Group by type</label>`;
  const head = `<div class="market-toolbar"><div class="result-count">Showing ${shown.length} of ${
    state.items.length
  }</div><div class="market-actions">${groupToggle}</div></div>`;
  if (!state.groupByType) {
    renderCardGrid(resultsEl, head, state.layout, shown, cardHtml);
    return;
  } else {
    // One section per type (sort order kept inside each), sticky titles like Market.
    const buckets = new Map(INV_SECTIONS.map((x) => [x.key, []]));
    for (const p of shown) buckets.get(INV_SECTIONS.find((x) => x.test(p)).key).push(p);
    setHTML(
      resultsEl,
      head +
        INV_SECTIONS.filter((x) => buckets.get(x.key).length)
          .map(
            (x) =>
              `<section class="inv-section"><h3 class="market-title">${OH.escapeHtml(x.label)}<span class="market-n">${
                buckets.get(x.key).length
              }</span></h3><div class="grid ${state.layout}">${buckets.get(x.key).map(cardHtml).join('')}</div></section>`,
          )
          .join(''),
    );
  }
  enhanceCardImages(resultsEl);
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
const selectToggle = $('#select-toggle');

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
  const live = resultsEl.querySelector('.mk-selcount');
  if (live) live.textContent = marketSelText();
  if (selectToggle) {
    selectToggle.setAttribute('aria-pressed', String(state.selecting));
    selectToggle.textContent = state.selecting ? 'Done Selecting' : 'Select';
  }
  const n = state.selected.size;
  $('#sb-count').textContent = n ? `${n} selected` : 'Click items to select them';
  renderMeltPlanner();
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

if (selectToggle) selectToggle.addEventListener('click', () => setSelecting(!state.selecting));
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

// --- Store: your CCUs + price list -----------------------------------------

const capFirst = (t) => String(t || '').replace(/^\w/, (c) => c.toUpperCase());
// Labels (roles, sizes, chart rows): every word capitalized, "light fighter" → "Light Fighter".
const titleCase = (t) =>
  String(t || '').replace(/(^|[\s/(-])(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase());

// Production state labels. "In production" reads as "In concept": to a player
// both mean "can't fly it yet", and the difference was hard to tell apart.
const SHIP_STATES = [
  ['flight-ready', 'Flight Ready'],
  ['in-production', 'In Concept'],
  ['in-concept', 'In Concept'],
];
// --- Store page -------------------------------------------------------------
// Three panels: Wishlist, Your CCUs and Ship Prices. Long lists scroll inside
// their panel. RSI's upgrade-tool feed (OH.getStoreShips) is used only to find
// each ship's store page; whether a ship is in the store comes from that page
// (OH.getShipStock), checked just for the wishlist and the ship window.
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
// The "In store now" cell: a placeholder that fillStock() fills in from the
// ship's own store page ("In stock" / "Not in store").
function inStoreHtml(name) {
  const s = storeOf(name);
  if (!s || !s.link) return storeData ? '<span class="muted">—</span>' : '';
  return `<a class="sale" href="${OH.escapeHtml(s.link)}" target="_blank" rel="noopener" data-stock-url="${OH.escapeHtml(s.link)}">Checking…</a>`;
}
const stockMem = new Map(); // store page URL → 'in' | 'pack' | 'out' (this session)
function fillStock(container) {
  if (!container) return;
  const pending = [];
  let fresh = false; // any answer we didn't have yet (so a stock sort can change)
  for (const el of container.querySelectorAll('[data-stock-url]')) {
    if (el.dataset.stockDone) continue;
    el.dataset.stockDone = '1';
    const req = OH.getShipStock(el.dataset.stockUrl).then((st) => {
      const state = st && st.state;
      if (state && stockMem.get(el.dataset.stockUrl) !== state) {
        stockMem.set(el.dataset.stockUrl, state);
        fresh = true;
      }
      el.classList.add(state === 'in' ? 'on' : state === 'pack' ? 'wb' : 'off');
      const packList = st && st.packs.length ? st.packs.map((p) => p.name).join(', ') : '';
      if (state === 'in') {
        el.textContent = st.price ? `In stock (${dollars(st.price)})` : 'In stock';
        el.title = `Sold on its own in RSI's store right now${packList ? `. Also in: ${packList}` : ''}`;
      } else if (state === 'pack') {
        el.textContent = 'Only in a pack';
        el.title = `Not sold on its own right now; comes in: ${packList}`;
      } else if (state === 'out') {
        el.textContent = 'Not in store';
        el.title = "Not for sale on RSI's store right now";
      } else {
        el.textContent = 'Unknown';
        el.title = "Couldn't read RSI's store page";
      }
    });
    pending.push(req);
  }
  if (pending.length && container.id === 'wishlist' && state.wishSort === 'stock') {
    Promise.all(pending).then(() => {
      if (!fresh || currentView() !== 'store') return;
      setHTML($('#wishlist'), wishlistHtml());
      fillStock($('#wishlist'));
    });
  }
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
  const price = (n) => (shipEntry(n) || {}).msrp || 0;
  const label = (n) => ((shipEntry(n) || {}).name || n).toLowerCase();
  const stockRank = (n) => {
    const st = storeOf(n);
    const s = st && stockMem.get(st.link);
    return s === 'in' ? 0 : s === 'pack' ? 1 : s === 'out' ? 2 : 3;
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
// Wishlist: one row per ship; its buy-backs (standalone copies, and CCUs that
// upgrade to it) open underneath with dates, pledge IDs and Reclaim links.
function wishlistHtml() {
  if (!state.wishlist.length) {
    return '<p class="muted sp-empty">Your wishlist is emptier than a Hull C on launch day. Open any ship (search at the top, or a name in Ship Prices) and press <strong>Add to Wishlist</strong>.</p>';
  }
  const owned = new Map(ownedShips().map((s) => [shipKey(s.label), s.pledges.length]));
  const esc = OH.escapeHtml;
  const mine = state.wishSort === 'mine';
  const rows = wishlistOrder()
    .map((name, i) => {
      const v = shipEntry(name);
      const title = (v && v.name) || name;
      // Ships and packs first, then CCUs; newest melt first within each.
      const bbRank = (b) => (b.ccu ? 2 : b.kind === 'ship' ? 0 : 1);
      const bbType = (b) =>
        b.ccu ? 'CCU' : b.kind === 'package' ? 'Package' : b.kind === 'pack' ? 'Pack' : 'Ship';
      const bbs = state.buybacks
        .filter((b) => buybackHasShip(b, title))
        .sort(
          (a, b) =>
            bbRank(a) - bbRank(b) || String(b.date || '').localeCompare(String(a.date || '')),
        );
      const ships = bbs.filter((b) => !b.ccu && b.kind === 'ship').length;
      const packs = bbs.filter((b) => !b.ccu && b.kind !== 'ship').length;
      const ccus = bbs.filter((b) => b.ccu).length;
      const have = owned.get(shipKey(title));
      const status = v && (SHIP_STATES.find(([k]) => k === v.status) || [])[1];
      const summary = [
        ships ? `${ships} ship${ships === 1 ? '' : 's'}` : '',
        packs ? `${packs} pack${packs === 1 ? '' : 's'}` : '',
        ccus ? `${ccus} CCU${ccus === 1 ? '' : 's'}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const detail = bbs.length
        ? `<tr class="wish-bbs" id="wish-bbs-${i}" hidden><td colspan="7"><table class="org-table inner"><thead><tr><th>Type</th><th>Buy-back</th><th>Melted</th><th>Pledge ID</th><th class="num">Price</th><th></th></tr></thead><tbody>${bbs
            .map(
              (b) => `<tr>
                <td><span class="badge ${bbType(b).toLowerCase()}">${bbType(b)}</span></td>
                <td title="${esc(bbFullName(b))}">${esc(buybackName(b))}</td>
                <td>${esc(b.date || '')}</td>
                <td>${/^\d+$/.test(String(b.id)) ? esc(String(b.id)) : '<span class="muted">—</span>'}</td>
                <td class="num">${esc(bbPriceText(b)) || '<span class="muted">—</span>'}</td>
                <td class="num">${buybackReclaimLink(b)}</td>
              </tr>`,
            )
            .join('')}</tbody></table></td></tr>`
        : '';
      return `<tr${mine ? ` class="wish-drag" data-wish-name="${esc(name)}"` : ''}>
        <td>${mine ? '<span class="wish-grip" title="Drag to reorder" aria-hidden="true">⠿</span>' : ''}${shipLink(title)}</td>
        <td class="num">${v && v.msrp ? dollars(v.msrp) : '<span class="muted">—</span>'}</td>
        <td>${inStoreHtml(title)}</td>
        <td>${esc(status || '')}</td>
        <td>${
          bbs.length
            ? `<button type="button" class="ship-link wish-open" data-wish-bbs="${i}" aria-expanded="false">${esc(summary)} ▾</button>`
            : '<span class="muted">none</span>'
        }</td>
        <td>${have ? `you own ${have}` : ''}</td>
        <td class="num"><button type="button" class="wish-x" data-wish-remove="${esc(name)}" title="Remove from wishlist" aria-label="Remove ${esc(title)} from wishlist">✕</button></td>
      </tr>${detail}`;
    })
    .join('');
  const unchecked = uncheckedPacks();
  const note = unchecked
    ? `<p class="muted value-note">${unchecked} pack buy-back${unchecked === 1 ? '' : 's'} not checked yet: RSI's list only names the first item in a pack. <a href="#buybacks" data-view="buybacks">Load Details</a> on the Buy-Backs page to find your wishlist ships inside every pack.</p>`
    : '';
  return `${note}<table class="org-table wishlist"><thead><tr><th>Ship</th><th class="num">Store Price</th><th>In Store Now</th><th>Status</th><th>Buy-backs</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Your CCUs: identical ones stacked, searchable, all of them (not just priced).
function ccuPanelHtml(q) {
  const v = hangarValue();
  const needle = q.trim().toLowerCase();
  const stacks = new Map();
  for (const p of state.items) {
    if (!p.isCCU || !p.ccu) continue;
    const from = OH.htfShipName(p.ccu.from) || p.ccu.from;
    const to = OH.htfShipName(p.ccu.to) || p.ccu.to;
    const key = `${from}→${to}`.toLowerCase();
    const si = v && v.pledges[p.id];
    const st = stacks.get(key) || { from, to, n: 0, paid: 0, worth: null };
    st.n++;
    st.paid += Number.isFinite(p.value) ? p.value : 0;
    if (si && si.from && si.to) st.worth = si.to - si.from;
    stacks.set(key, st);
  }
  const all = [...stacks.values()];
  const shown = all
    .filter((c) => !needle || `${c.from} ${c.to}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.worth || 0) - (a.worth || 0));
  searchCounts.ccu = { shown: shown.length, total: all.length };
  if (!all.length)
    return '<p class="muted sp-empty">No CCUs in your hangar. Chain-free living.</p>';
  if (!shown.length) return '<p class="muted sp-empty">No CCUs match that search.</p>';
  return `<table class="org-table"><thead><tr><th>Upgrade</th><th class="num">Worth</th><th class="num">You Paid</th><th class="num">Stock</th></tr></thead><tbody>${shown
    .map(
      (c) => `<tr>
        <td>${shipLink(c.from)} <span class="ccu-flow">→</span> ${shipLink(c.to)}</td>
        <td class="num">${c.worth != null ? dollars(c.worth) : '<span class="muted">—</span>'}</td>
        <td class="num">${money(c.paid)}</td>
        <td class="num">${c.n}</td>
      </tr>`,
    )
    .join('')}</tbody></table>`;
}

// Ship Prices: tabs (Flight Ready, In Concept incl. in production, All).
const PRICE_TABS = [
  ['flight-ready', 'Flight Ready'],
  ['in-concept', 'In Concept'],
  ['all', 'All'],
];
function priceRowsHtml(q) {
  const needle = q.trim().toLowerCase();
  const tab = state.priceTab;
  const inTab = (state.catalog || [])
    .filter((v) => v.msrp)
    .filter((v) => {
      if (tab === 'all') return true;
      if (tab === 'in-concept') return v.status === 'in-concept' || v.status === 'in-production';
      return v.status === tab;
    });
  const rows = inTab
    .filter((v) => !needle || v.lname.includes(needle))
    .sort((a, b) => (a.name || a.lname).localeCompare(b.name || b.lname));
  searchCounts.price = { shown: rows.length, total: inTab.length };
  if (!rows.length) {
    return '<p class="muted sp-empty">No ships match. Maybe it’s still a JPEG?</p>';
  }
  const statusLabel = (s) => (SHIP_STATES.find(([k]) => k === s) || [])[1] || capFirst(s || '');
  return `<table class="org-table"><thead><tr><th>Ship</th><th class="num">Store Price</th><th>Status</th><th>Role</th><th>Size</th></tr></thead><tbody>${rows
    .map(
      (v) =>
        `<tr><td>${shipLink(v.name || v.lname)}</td><td class="num">${dollars(v.msrp)}</td><td>${OH.escapeHtml(statusLabel(v.status))}</td><td>${OH.escapeHtml(v.role || '')}</td><td>${OH.escapeHtml(
          titleCase(v.size),
        )}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

// Panel searches: "Search 221 ships…" placeholders, a live "12 of 221" while
// typing, and no CCU search when there are only a few to look through.
const searchCounts = { price: null, ccu: null };
function updateSearchMeta() {
  const meta = (input, count, noun) => {
    const box = $(input);
    const out = $(`${input}-count`);
    if (!box || !count) return;
    box.placeholder = `Search ${count.total.toLocaleString('en-US')} ${noun}${count.total === 1 ? '' : 's'}…`;
    if (out) {
      out.textContent = box.value.trim()
        ? `${count.shown.toLocaleString('en-US')} of ${count.total.toLocaleString('en-US')}`
        : '';
    }
  };
  meta('#price-search', searchCounts.price, 'ship');
  meta('#ccu-search', searchCounts.ccu, 'CCU');
  const ccuBox = $('#ccu-search');
  if (ccuBox && searchCounts.ccu) {
    const few = searchCounts.ccu.total <= 8 && !ccuBox.value.trim();
    ccuBox.hidden = few;
    if ($('#ccu-search-count')) $('#ccu-search-count').hidden = few;
  }
}

function renderStore() {
  ensurePrices();
  ensureStore();
  const tabs = $('#price-tabs');
  if (tabs) {
    setHTML(
      tabs,
      PRICE_TABS.map(
        ([k, label]) =>
          `<button type="button" role="tab" aria-selected="${state.priceTab === k}" data-price-tab="${k}" class="${state.priceTab === k ? 'active' : ''}">${label}</button>`,
      ).join(''),
    );
  }
  setHTML($('#wish-n'), state.wishlist.length ? String(state.wishlist.length) : '');
  if ($('#wish-sort')) $('#wish-sort').value = state.wishSort;
  setHTML($('#wishlist'), wishlistHtml());
  fillStock($('#wishlist'));
  if (!state.catalog) {
    setHTML($('#price-table'), '<p class="muted sp-empty">Loading ship prices…</p>');
    setHTML($('#ccu-owned'), `<p class="muted sp-empty">${OH.quip('loading')}</p>`);
    return;
  }
  setHTML($('#price-table'), priceRowsHtml($('#price-search').value));
  setHTML($('#ccu-owned'), ccuPanelHtml($('#ccu-search').value));
  updateSearchMeta();
  const ccuN = state.items.filter((p) => p.isCCU).length;
  setHTML($('#ccu-n'), ccuN ? String(ccuN) : '');
}

{
  const sel = $('#wish-sort');
  if (sel) {
    setHTML(sel, WISH_SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join(''));
    sel.addEventListener('change', () => {
      state.wishSort = sel.value;
      chrome.storage.local.set({ uiWishSort: sel.value });
      renderStore();
    });
  }
  // "My order": press a row and drag it; the row lifts and follows the pointer,
  // and the rows it passes slide out of the way (animated). Let go to save.
  // Pointer events rather than native drag-and-drop, so there's no ghost image.
  const list = $('#wishlist');
  let drag = null; // { row, detail, startY, pointerId, moved }
  const shipRows = () => [...list.querySelectorAll('.wishlist > tbody > tr[data-wish-name]')];
  // A row's buy-back sub-row (if any) travels with it.
  const detailOf = (row) =>
    row.nextElementSibling && row.nextElementSibling.classList.contains('wish-bbs')
      ? row.nextElementSibling
      : null;
  // Move rows in the DOM and animate everyone from where they were (FLIP).
  function flipMove(mutate) {
    const all = [...list.querySelectorAll('.wishlist > tbody > tr')];
    const before = new Map(all.map((r) => [r, r.getBoundingClientRect().top]));
    mutate();
    for (const r of all) {
      if (drag && (r === drag.row || r === drag.detail)) continue;
      const dy = before.get(r) - r.getBoundingClientRect().top;
      if (!dy) continue;
      r.style.transition = 'none';
      r.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        r.style.transition = 'transform 160ms ease';
        r.style.transform = '';
      });
    }
  }
  list?.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('tr[data-wish-name]');
    if (!row || state.wishSort !== 'mine' || e.button !== 0) return;
    if (e.target.closest('a, button, input, select') && !e.target.closest('.wish-grip')) return;
    e.preventDefault();
    drag = {
      row,
      detail: detailOf(row),
      startY: e.clientY,
      grab: e.clientY - row.getBoundingClientRect().top, // where on the row it was held
      pointerId: e.pointerId,
      moved: false,
    };
    row.setPointerCapture(e.pointerId);
    row.classList.add('lifted');
  });
  list?.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.moved = drag.moved || Math.abs(e.clientY - drag.startY) > 3;
    // The first other row whose middle is below the pointer: drop in front of it.
    const others = shipRows().filter((r) => r !== drag.row);
    const target = others.find((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY < b.top + b.height / 2;
    });
    const tbody = drag.row.parentElement;
    const want = target || null; // null = the end
    const nextShip = (() => {
      let n = (drag.detail || drag.row).nextElementSibling;
      while (n && !n.dataset.wishName) n = n.nextElementSibling;
      return n || null;
    })();
    if (want !== nextShip) {
      flipMove(() => {
        tbody.insertBefore(drag.row, want);
        if (drag.detail) tbody.insertBefore(drag.detail, drag.row.nextElementSibling);
      });
    }
    // Keep the held row under the pointer (offset from its slot in the list).
    drag.row.style.transform = '';
    const slot = drag.row.getBoundingClientRect().top;
    const dy = e.clientY - drag.grab - slot;
    for (const r of [drag.row, drag.detail]) if (r) r.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const { row, detail, moved } = drag;
    row.classList.remove('lifted');
    for (const r of [row, detail]) if (r) r.style.transform = '';
    drag = null;
    if (!moved) return;
    const order = shipRows().map((r) => r.dataset.wishName);
    if (JSON.stringify(order) !== JSON.stringify(state.wishlist)) {
      state.wishlist = order;
      chrome.storage.local.set({ wishlist: state.wishlist });
    }
    renderStore();
  };
  list?.addEventListener('pointerup', endDrag);
  list?.addEventListener('pointercancel', endDrag);
}
function moveWishlist(name, beforeName) {
  if (name === beforeName) return;
  const from = state.wishlist.indexOf(name);
  const to = state.wishlist.indexOf(beforeName);
  if (from < 0 || to < 0) return;
  state.wishlist.splice(from, 1);
  state.wishlist.splice(to, 0, name);
  chrome.storage.local.set({ wishlist: state.wishlist });
  renderStore();
}

$('#price-search')?.addEventListener('input', (e) => {
  setHTML($('#price-table'), priceRowsHtml(e.target.value));
  updateSearchMeta();
});
$('#ccu-search')?.addEventListener('input', (e) => {
  setHTML($('#ccu-owned'), ccuPanelHtml(e.target.value));
  updateSearchMeta();
});
$('#view-store')?.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-price-tab]');
  if (tab) {
    state.priceTab = tab.dataset.priceTab;
    return void renderStore();
  }
  const open = e.target.closest('[data-wish-bbs]');
  if (open) {
    const sub = $(`#wish-bbs-${open.dataset.wishBbs}`);
    if (!sub) return;
    sub.hidden = !sub.hidden;
    open.setAttribute('aria-expanded', String(!sub.hidden));
  }
});

// --- Org fleet ------------------------------------------------------------
// Members' ship lists (from HTF exports or backups) combined into one fleet.
// Stored under `orgFleet` in this browser only: { members: [{ name, importedAt, ships }] }.
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

const orgMsg = (t) => {
  const el = $('#org-msg');
  if (el) el.textContent = t;
};

function orgBarsHtml(map) {
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows
    .map(
      ([k, n]) => `<div class="bar-row">
        <div class="bar-label">${OH.escapeHtml(titleCase(k))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
        <div class="bar-val">${n}</div>
      </div>`,
    )
    .join('');
}

// Org Fleet is click-to-explore: a role chip opens what fills it (or, for a
// missing role, ships that would); a member opens their fleet next to the rest
// of the org; two members can be compared side by side.
const orgUi = { role: null, member: null, a: null, b: null };

function orgRolesHtml(f) {
  const missing = f.roles.filter((r) => !r.count);
  // Covered, but only by ships that aren't flyable yet (in concept / production).
  const concept = f.roles.filter((r) => r.count && !r.ready);
  const names = (list) => list.map((r) => OH.escapeHtml(r.label)).join(', ');
  const chips = f.roles
    .map((r) => {
      const cls = !r.count ? 'missing' : r.ready ? 'have' : 'concept';
      const tip = cls === 'concept' ? ' title="Covered by ships that are still in concept"' : '';
      return `<button type="button" class="role-chip ${cls}${
        orgUi.role === r.key ? ' open' : ''
      }" data-role="${r.key}" aria-expanded="${orgUi.role === r.key}"${tip}>${OH.escapeHtml(r.label)}${
        r.count ? ` <b>${r.count}</b>` : ''
      }</button>`;
    })
    .join('');
  const notes = [
    missing.length ? `No ships for: <strong>${names(missing)}</strong>.` : '',
    concept.length ? `Only in-concept ships for: <strong>${names(concept)}</strong>.` : '',
  ].filter(Boolean);
  return `<h3 class="section-title" style="margin-top:22px">Roles</h3>
    <p class="muted org-intro">${notes.join(' ') || 'Every role is covered.'} Click a role to see what fills it.</p>
    <div class="role-chips">${chips}</div>${orgRolePanelHtml(f)}`;
}

function orgRolePanelHtml(f) {
  const r = f.roles.find((x) => x.key === orgUi.role);
  if (!r) return '';
  const def = OH.ORG_ROLES.find((x) => x.key === r.key);
  if (r.count) {
    const rows = f.ships
      .filter((sh) => sh.role && def.re.test(sh.role))
      .map(
        (sh) =>
          `<tr><td>${OH.escapeHtml(sh.name)}</td><td class="muted">${OH.escapeHtml(titleCase(sh.role))}</td><td>${
            sh.status === 'flight-ready'
              ? '<span class="badge good">Flight Ready</span>'
              : '<span class="badge warn">In Concept</span>'
          }</td><td class="num">${sh.count}</td><td class="org-owners">${sh.owners
            .map((o) => OH.escapeHtml(o.n > 1 ? `${o.name} ×${o.n}` : o.name))
            .join(', ')}</td></tr>`,
      )
      .join('');
    return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(r.label)}</strong> · ${
      r.count
    } ship${r.count === 1 ? '' : 's'}<button type="button" class="org-close" data-close="role" aria-label="Close">×</button></div>
      <table class="org-table"><thead><tr><th>Ship</th><th>Role</th><th>Status</th><th class="num">Count</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const options = (state.catalog || [])
    // Every ship that fills the role (big ones like the Orion used to fall off
    // a top-10 list), cheapest first; unpriced concepts last.
    .filter((v) => v.role && def.re.test(v.role))
    .sort((x, y) => (x.msrp || Infinity) - (y.msrp || Infinity))
    .map(
      (v) =>
        `<tr><td>${OH.escapeHtml(v.name || v.lname)}</td><td class="muted">${OH.escapeHtml(titleCase(v.role))}</td><td class="muted">${OH.escapeHtml(
          v.status === 'flight-ready' ? 'Flight Ready' : 'In Concept',
        )}</td><td class="num">${v.msrp ? dollars(v.msrp) : '—'}</td></tr>`,
    )
    .join('');
  return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(r.label)}</strong> · nobody has one yet<button type="button" class="org-close" data-close="role" aria-label="Close">×</button></div>
    ${
      options
        ? `<p class="muted org-intro">Every ship that fills this role, cheapest first:</p><div class="org-scroll"><table class="org-table"><thead><tr><th>Ship</th><th>Role</th><th>Status</th><th class="num">Store Price</th></tr></thead><tbody>${options}</tbody></table></div>`
        : '<p class="muted">No ships in the ship list fill this role.</p>'
    }</div>`;
}

// Member table: click a name to open their fleet vs the rest of the org.
function orgMembersHtml(f, members) {
  const rows = f.byMember
    .map(
      (m) =>
        `<tr class="org-mrow${orgUi.member === m.name ? ' open' : ''}" data-member="${OH.escapeHtml(m.name)}"><td><button type="button" class="bb-open">${OH.escapeHtml(
          m.name,
        )}</button></td><td class="num">${m.ships}</td><td class="num">${m.lti}</td><td class="num">${
          m.priced ? dollars(m.store) : '—'
        }</td><td class="num">${f.store ? Math.round((m.store / f.store) * 100) + '%' : '—'}</td></tr>`,
    )
    .join('');
  const opts = (sel) =>
    members
      .map(
        (m) =>
          `<option value="${OH.escapeHtml(m.name)}"${m.name === sel ? ' selected' : ''}>${OH.escapeHtml(m.name)}</option>`,
      )
      .join('');
  const compare =
    members.length >= 2
      ? `<div class="org-compare-bar">Compare <select class="org-cmp" data-side="a" aria-label="First Member to Compare"><option value="">pick a member</option>${opts(
          orgUi.a,
        )}</select> with <select class="org-cmp" data-side="b" aria-label="Second Member to Compare"><option value="">pick a member</option>${opts(orgUi.b)}</select></div>`
      : '';
  return `<h3 class="section-title" style="margin-top:22px">Members</h3>
    <p class="muted org-intro">Click a member to see their fleet next to the rest of the org.</p>
    <table class="org-table"><thead><tr><th>Member</th><th class="num">Ships</th><th class="num">LTI</th><th class="num">Fleet Value</th><th class="num">Share</th></tr></thead><tbody>${rows}</tbody></table>
    ${orgMemberPanelHtml(f, members)}${compare}${orgComparePanelHtml(members)}`;
}

// Two-series bars: one row per key, `a` and `b` side by side.
function pairBarsHtml(mapA, mapB, labelA, labelB) {
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort(
    (x, y) => (mapB[y] || 0) + (mapA[y] || 0) - ((mapB[x] || 0) + (mapA[x] || 0)),
  );
  const max = Math.max(1, ...keys.map((k) => Math.max(mapA[k] || 0, mapB[k] || 0)));
  return `<div class="pair-legend"><span class="sw a"></span>${OH.escapeHtml(labelA)} <span class="sw b"></span>${OH.escapeHtml(
    labelB,
  )}</div>${keys
    .map(
      (
        k,
      ) => `<div class="pair-row"><div class="bar-label">${OH.escapeHtml(titleCase(k))}</div><div class="pair-bars">
        <div class="pair-bar a" style="width:${Math.round(((mapA[k] || 0) / max) * 100)}%"><span>${mapA[k] || 0}</span></div>
        <div class="pair-bar b" style="width:${Math.round(((mapB[k] || 0) / max) * 100)}%"><span>${mapB[k] || 0}</span></div>
      </div></div>`,
    )
    .join('')}`;
}

function orgMemberPanelHtml(f, members) {
  const m = members.find((x) => x.name === orgUi.member);
  if (!m) return '';
  const me = OH.orgFleet([m], state.shipOf, state.priceOf);
  const rest = OH.orgFleet(
    members.filter((x) => x !== m),
    state.shipOf,
    state.priceOf,
  );
  const onlyMe = me.roles.filter((r) => r.count && !rest.roles.find((x) => x.key === r.key).count);
  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(m.name)}</strong> vs the rest of the org<button type="button" class="org-close" data-close="member" aria-label="Close">×</button></div>
    <div class="stat-grid">${
      box(me.shipCount, 'ships') +
      box(dollars(me.store), 'fleet value') +
      box(f.store ? Math.round((me.store / f.store) * 100) + '%' : '—', 'of org value') +
      box(me.roles.filter((r) => r.count).length, 'roles covered')
    }</div>
    ${
      onlyMe.length
        ? `<p class="org-intro">Only ${OH.escapeHtml(m.name)} covers: <strong>${onlyMe.map((r) => OH.escapeHtml(r.label)).join(', ')}</strong></p>`
        : ''
    }
    <div class="fleet-cols"><div><h4 class="modal-h">By Role</h4>${pairBarsHtml(me.byCareer, rest.byCareer, m.name, 'Rest of org')}</div>
    <div><h4 class="modal-h">By Size</h4>${pairBarsHtml(me.bySize, rest.bySize, m.name, 'Rest of org')}</div></div>
    <h4 class="modal-h">Ships</h4><p class="org-owners">${me.ships
      .map((sh) => OH.escapeHtml(sh.count > 1 ? `${sh.name} ×${sh.count}` : sh.name))
      .join(', ')}</p></div>`;
}

function orgComparePanelHtml(members) {
  const A = members.find((x) => x.name === orgUi.a);
  const B = members.find((x) => x.name === orgUi.b);
  if (!A || !B || A === B) return '';
  const fa = OH.orgFleet([A], state.shipOf, state.priceOf);
  const fb = OH.orgFleet([B], state.shipOf, state.priceOf);
  const namesA = new Set(fa.ships.map((x) => x.name));
  const namesB = new Set(fb.ships.map((x) => x.name));
  const both = [...namesA].filter((n) => namesB.has(n));
  const onlyA = [...namesA].filter((n) => !namesB.has(n));
  const onlyB = [...namesB].filter((n) => !namesA.has(n));
  const col = (f, name) =>
    `<div class="cmp-col"><h4 class="modal-h">${OH.escapeHtml(name)}</h4>
      <div class="cmp-kv"><span>Ships</span><b>${f.shipCount}</b></div>
      <div class="cmp-kv"><span>Fleet value</span><b>${dollars(f.store)}</b></div>
      <div class="cmp-kv"><span>LTI</span><b>${f.byMember[0] ? f.byMember[0].lti : 0}</b></div>
      <div class="cmp-kv"><span>Cargo</span><b>${Math.round(f.cargo).toLocaleString('en-US')} SCU</b></div>
      <div class="cmp-kv"><span>Crew seats</span><b>${f.crew}</b></div>
      <div class="cmp-kv"><span>Roles covered</span><b>${f.roles.filter((r) => r.count).length}</b></div></div>`;
  const list = (arr) =>
    arr.length ? arr.map((n) => OH.escapeHtml(n)).join(', ') : '<span class="muted">none</span>';
  return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(A.name)}</strong> vs <strong>${OH.escapeHtml(
    B.name,
  )}</strong><button type="button" class="org-close" data-close="compare" aria-label="Close">×</button></div>
    <div class="cmp-cols">${col(fa, A.name)}${col(fb, B.name)}</div>
    <div class="fleet-cols"><div><h4 class="modal-h">By Role</h4>${pairBarsHtml(fa.byCareer, fb.byCareer, A.name, B.name)}</div>
    <div><h4 class="modal-h">By Size</h4>${pairBarsHtml(fa.bySize, fb.bySize, A.name, B.name)}</div></div>
    <h4 class="modal-h">Both Own</h4><p class="org-owners">${list(both)}</p>
    <h4 class="modal-h">Only ${OH.escapeHtml(A.name)}</h4><p class="org-owners">${list(onlyA)}</p>
    <h4 class="modal-h">Only ${OH.escapeHtml(B.name)}</h4><p class="org-owners">${list(onlyB)}</p></div>`;
}

function orgBiggestHtml(f) {
  if (!f.biggest.length) return '';
  const rows = f.biggest
    .map(
      (r) =>
        `<tr><td>${OH.escapeHtml(r.name)}</td><td>${OH.escapeHtml(titleCase(r.size))}</td><td class="num">${
          r.count
        }</td><td class="num">${r.msrp ? dollars(r.msrp) : '—'}</td><td class="org-owners">${r.owners
          .map((o) => OH.escapeHtml(o.n > 1 ? `${o.name} ×${o.n}` : o.name))
          .join(', ')}</td></tr>`,
    )
    .join('');
  return `<h3 class="section-title" style="margin-top:22px">Biggest Ships</h3>
    <table class="org-table"><thead><tr><th>Ship</th><th>Size</th><th class="num">Count</th><th class="num">Store Price</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function renderOrg() {
  ensurePrices();
  const body = $('#org-body');
  const members = await loadOrg();
  if (syncMyOrgFleet()) await saveOrg();
  if (!members.length) {
    setHTML(
      body,
      '<div class="empty">No org fleet assembled yet. Import member files, or start with <strong>Add My Fleet</strong>.</div>',
    );
    return;
  }
  const chips = members
    .map(
      (m) =>
        `<span class="org-member">${OH.escapeHtml(m.name)} · ${m.ships.length} ships<button type="button" class="org-remove" data-name="${OH.escapeHtml(m.name)}" title="Remove" aria-label="Remove ${OH.escapeHtml(m.name)}">×</button></span>`,
    )
    .join('');
  if (!state.shipOf) {
    setHTML(body, `<div class="org-members">${chips}</div><p class="muted">Loading ship data…</p>`);
    return;
  }
  const f = OH.orgFleet(members, state.shipOf, state.priceOf);
  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const rows = f.ships
    .map(
      (r) => `<tr>
        <td>${OH.escapeHtml(r.name)}</td>
        <td class="num">${r.count}</td>
        <td class="num">${r.lti}</td>
        <td class="num">${r.msrp ? dollars(r.msrp) : '—'}</td>
        <td class="org-owners">${r.owners
          .map((o) => OH.escapeHtml(o.n > 1 ? `${o.name} ×${o.n}` : o.name))
          .join(', ')}</td>
      </tr>`,
    )
    .join('');
  setHTML(
    body,
    `<div class="org-members">${chips}</div>` +
      `<div class="stat-grid">${
        box(f.members, 'members') +
        box(f.shipCount, 'ships') +
        box(dollars(f.store), `at store price (${f.priced} priced)`) +
        box(Math.round(f.cargo).toLocaleString('en-US'), 'cargo (SCU)') +
        box(f.crew.toLocaleString('en-US'), 'crew seats')
      }</div>` +
      orgRolesHtml(f) +
      orgBiggestHtml(f) +
      orgMembersHtml(f, members) +
      `<div class="fleet-cols"><div><h4 class="modal-h">By Role</h4>${orgBarsHtml(f.byCareer)}</div>` +
      `<div><h4 class="modal-h">By Size</h4>${orgBarsHtml(f.bySize)}</div></div>` +
      `<h3 class="section-title" style="margin-top:22px">Ships</h3>` +
      `<table class="org-table"><thead><tr><th>Ship</th><th class="num">Count</th><th class="num">LTI</th><th class="num">Store Price</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table>`,
  );
}

$('#org-import')?.addEventListener('click', () => $('#org-file').click());
$('#org-file')?.addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = '';
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
  orgMsg(
    `Added ${added} fleet${added === 1 ? '' : 's'}.` +
      (problems.length ? ` Skipped: ${problems.join('; ')}` : ''),
  );
  renderOrg();
});
$('#org-mine')?.addEventListener('click', async () => {
  if (!state.items.length)
    return orgMsg('Scan your hangar first, then bring your ships to the party.');
  await loadOrg();
  const who = (state.owner && (state.owner.displayname || state.owner.nickname)) || 'Me';
  const r = OH.shipsFromFile({ sources: { hangar: { items: state.items } } });
  if (r.error) return orgMsg(r.error);
  upsertMember(who, r.ships, { mine: true });
  await saveOrg();
  orgMsg(`Added your fleet (${r.ships.length} ships).`);
  renderOrg();
});
$('#org-csv')?.addEventListener('click', async () => {
  const members = await loadOrg();
  if (!members.length || !state.shipOf) return orgMsg('Nothing to export yet. Empty hangar bay.');
  const f = OH.orgFleet(members, state.shipOf, state.priceOf);
  const lines = [['Ship', 'Count', 'LTI', 'Store price (USD)', 'Owners']].concat(
    f.ships.map((r) => [
      r.name,
      r.count,
      r.lti,
      r.msrp ?? '',
      r.owners.map((o) => `${o.name} x${o.n}`).join('; '),
    ]),
  );
  downloadBlob(
    new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }),
    `open-hangar-org-fleet-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  orgMsg('CSV saved. Time for the org meeting.');
});
$('#org-body')?.addEventListener('click', (e) => {
  const role = e.target.closest('[data-role]');
  const row = e.target.closest('.org-mrow');
  const close = e.target.closest('.org-close');
  if (role) orgUi.role = orgUi.role === role.dataset.role ? null : role.dataset.role;
  else if (row) orgUi.member = orgUi.member === row.dataset.member ? null : row.dataset.member;
  else if (close) {
    const k = close.dataset.close;
    if (k === 'role') orgUi.role = null;
    if (k === 'member') orgUi.member = null;
    if (k === 'compare') orgUi.a = orgUi.b = null;
  } else return;
  renderOrg();
});
$('#org-body')?.addEventListener('change', (e) => {
  const sel = e.target.closest('.org-cmp');
  if (!sel) return;
  orgUi[sel.dataset.side] = sel.value || null;
  renderOrg();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.org-remove');
  if (!b) return;
  await loadOrg();
  orgMembers = orgMembers.filter((m) => m.name !== b.dataset.name);
  await saveOrg();
  renderOrg();
});

// --- Stats ----------------------------------------------------------------

// Stats → Hangar value: ships at today's store price vs their melt value, best
// deals, and which ships couldn't be priced.
function valueSectionHtml() {
  const v = hangarValue();
  if (!v) {
    const msg = pricesLoading ? 'Loading store prices…' : 'Store prices unavailable (offline?).';
    return `<h3 class="section-title">Hangar Value</h3><p class="muted">${msg}</p>`;
  }
  if (!v.ships) return '';
  const box = (big, lbl, cls = '') =>
    `<div class="stat-box ${cls}"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const gap = v.storePriced - v.paidPriced;
  const sign = gap >= 0 ? '+' : '−';
  const pct = v.paidPriced ? Math.round((Math.abs(gap) / v.paidPriced) * 100) : 0;
  const boxes =
    box(dollars(v.store), 'ships at store price') +
    box(`${v.priced} / ${v.ships}`, 'ships priced') +
    (v.paidPriced
      ? box(
          `${sign}${dollars(Math.abs(gap))}`,
          `vs melt value${pct ? ` (${sign}${pct}%)` : ''}`,
          gap >= 0 ? 'good' : '',
        )
      : '') +
    (v.ccu.priced
      ? box(
          dollars(v.ccu.store),
          `${v.ccu.priced} CCU${v.ccu.priced === 1 ? '' : 's'} at standard price (paid ${dollars(
            v.ccu.paid,
          )})`,
          v.ccu.store > v.ccu.paid ? 'good' : '',
        )
      : '');
  const deals = state.items
    .map((p) => ({ p, si: v.pledges[p.id] }))
    .filter((x) => x.si && x.si.below)
    .sort((a, b) => b.si.store - b.si.paid - (a.si.store - a.si.paid))
    .slice(0, 10);
  const dealRows = deals
    .map(
      ({ p, si }) =>
        `<div class="row"><div class="nm">${OH.escapeHtml(plainName(p))}</div><div class="vl">${dollars(
          si.paid,
        )} → ${dollars(si.store)} <span class="gain">+${dollars(si.store - si.paid)}</span></div></div>`,
    )
    .join('');
  const missing = v.ships - v.priced;
  const unpriced = v.unpriced.length
    ? `<details class="unpriced"><summary>${missing} ship${
        missing === 1 ? '' : 's'
      } without a public price</summary><p class="muted">${v.unpriced
        .map((u) => OH.escapeHtml(u.n > 1 ? `${u.name} ×${u.n}` : u.name))
        .join(' · ')}</p></details>`
    : '';
  return (
    `<h3 class="section-title">Hangar Value</h3>` +
    `<div class="stat-grid">${boxes}</div>` +
    (dealRows
      ? `<h4 class="modal-h">Best Deals: Paid Below Today's Store Price</h4><div class="top-list">${dealRows}</div>`
      : '') +
    unpriced +
    `<p class="muted value-note">Ships at current standalone store prices (USD, before tax) from star-citizen.wiki; a CCU's standard price is the gap between its two ships. Paints, gear and game access aren't counted; concept and limited ships often have no public price. "vs melt value" covers ship pledges whose ships are all priced. Account Value on Home adds CCUs at standard price, everything else at melt value, and your Store Credit; buy-backs, UEC and REC aren't counted. Melt value is the pledge's value on RSI (what it was originally bought for); for gifted or grey-market pledges that isn't what you paid.</p>`
  );
}

// Stats → Fleet: what your ships are for, how big, how many fly today.
function fleetSectionHtml() {
  if (!state.shipOf) return '';
  const f = OH.fleetStats(state.items, state.shipOf);
  if (!f.ships) return '';
  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const flying = f.byStatus['flight-ready'] || 0;
  const boxes =
    box(f.ships, 'ships & vehicles') +
    box(`${flying} / ${f.known}`, 'flight ready') +
    box(Math.round(f.cargo).toLocaleString('en-US'), 'cargo (SCU)') +
    box(f.crew.toLocaleString('en-US'), 'crew seats');
  const bars = (map) => {
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows
      .map(
        ([k, n]) => `<div class="bar-row">
        <div class="bar-label">${OH.escapeHtml(titleCase(k))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
        <div class="bar-val">${n}</div>
      </div>`,
      )
      .join('');
  };
  const unknown = f.ships - f.known;
  return (
    `<div class="stat-grid">${boxes}</div>` +
    `<div class="fleet-cols"><div><h4 class="modal-h">By Role</h4>${bars(f.byCareer)}</div>` +
    `<div><h4 class="modal-h">By Size</h4>${bars(f.bySize)}</div></div>` +
    `<p class="muted value-note">Ship data from star-citizen.wiki${
      unknown ? ` · ${unknown} ship${unknown === 1 ? '' : 's'} not matched` : ''
    }. Crew seats = each ship's maximum crew.</p>`
  );
}

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
function changeDetails(d) {
  const li = (cls, text) => `<li class="${cls}">${OH.escapeHtml(text)}</li>`;
  return `<ul class="changes">${[
    ...d.added.map((x) => li('add', `+ ${x.name} (${money(x.value)})`)),
    ...d.removed.map((x) => li('del', `− ${x.name} (${money(x.value)})`)),
    ...d.changed.map((x) =>
      li('chg', `~ ${x.from} → ${x.to} (${money(x.fromValue)} → ${money(x.toValue)})`),
    ),
  ].join('')}</ul>`;
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

function historySvg(hist) {
  const pts = hist.map((h) => ({ t: h.at, v: snapshotStore(h), note: creditNote(h) }));
  const W = 560,
    H = 150,
    L = 56,
    R = 10,
    T = 10,
    B = 22;
  const t0 = pts[0].t,
    t1 = pts[pts.length - 1].t || t0 + 1;
  const vmin = Math.min(...pts.map((p) => p.v)),
    vmax = Math.max(...pts.map((p) => p.v));
  const span = vmax - vmin || 1;
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - vmin) / span) * (H - T - B);
  const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = pts
    .map(
      (p) =>
        `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${fmtDay(p.t)}: ${dollars(p.v)}${p.note}</title></circle>`,
    )
    .join('');
  return `<svg class="hist-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Account value over time">
    <text x="${L - 6}" y="${T + 8}" text-anchor="end">${dollars(vmax)}</text>
    <text x="${L - 6}" y="${H - B}" text-anchor="end">${dollars(vmin)}</text>
    <text x="${L}" y="${H - 4}">${fmtDay(t0)}</text>
    <text x="${W - R}" y="${H - 4}" text-anchor="end">${fmtDay(t1)}</text>
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2"/>${dots}
  </svg>`;
}

// Stats → History: account value over time + a log of what changed per scan.
function historySectionHtml() {
  const hist = state.history;
  if (!hist.length) return '';
  if (hist.length < 2) {
    return `<p class="muted">Tracking since ${fmtDay(
      hist[0].at,
    )}. Rescan after your hangar changes and each change shows up here.</p>`;
  }
  const steps = [];
  for (let i = hist.length - 1; i > 0 && steps.length < 12; i--) {
    const d = OH.diffSnapshots(hist[i - 1], hist[i]);
    steps.push(
      `<details class="hist-step"><summary><span class="hist-date">${fmtDay(hist[i].at)}</span> ${OH.escapeHtml(
        changeSummary(d),
      )}</summary>${changeDetails(d)}</details>`,
    );
  }
  return (
    `<h3 class="section-title" id="history">Account Value Over Time</h3>` +
    (state.priceOf
      ? historySvg(hist) +
        `<p class="muted value-note tight">Everything you held at each scan, valued like Account Value today: ships at today's store prices, CCUs at standard price, everything else at melt value, plus Store Credit from scans that recorded it. Pledges you've since melted are estimated from their names.</p>`
      : '<p class="muted">Loading ship prices…</p>') +
    `<div class="hist-list">${steps.join('')}</div>` +
    `<p class="muted value-note">A snapshot is kept each time a full scan finds changes: ${hist.length} so far, up to the last 100.</p>`
  );
}

function renderStats() {
  ensurePrices();
  const body = $('#stats-body');
  if (!state.items.length) {
    setHTML(
      body,
      `<div class="empty">${OH.quip('emptyHangar')} Hit Scan at the top to fill it.</div>`,
    );
    return;
  }
  const items = state.items;
  const count = (k) => items.filter((p) => p.kind === k).length;
  const ships = items.filter((p) => p.containsShip).length;

  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const stats =
    box(items.length, 'pledges') +
    box(money(OH.totalValue(items)), 'melt value') +
    box(ships, 'with ships') +
    box(count('ccu'), 'CCUs') +
    box(count('addon'), 'add-ons') +
    box(count('coupon'), 'coupons');

  // Breakdown by kind (count + subtotal), as bars scaled to the largest count.
  const present = presentKinds();
  const maxN = Math.max(1, ...present.map((k) => count(k.key)));
  const bars = present
    .map((k) => {
      const n = count(k.key);
      const sub = OH.totalValue(items.filter((p) => p.kind === k.key));
      const pct = Math.round((n / maxN) * 100);
      return `<div class="bar-row">
        <div class="bar-label">${OH.escapeHtml(k.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-val">${n} · ${money(sub)}</div>
      </div>`;
    })
    .join('');

  // Top items by value.
  const top = items
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const topRows = top
    .map(
      (p) =>
        `<div class="row"><div class="nm">${OH.escapeHtml(plainName(p))}</div><div class="vl">${OH.escapeHtml(formatValue(p))}</div></div>`,
    )
    .join('');

  const tabs = {
    overview: () =>
      `<div class="stat-grid">${stats}</div>` +
      `<h3 class="section-title">By Category</h3>${bars}` +
      `<h3 class="section-title" style="margin-top:26px">Top Pledges by Value</h3>` +
      `<div class="top-list">${topRows || '<div class="row muted">No priced pledges.</div>'}</div>`,
    value: () => valueSectionHtml(),
    fleet: () =>
      (fleetSectionHtml() ||
        `<p class="muted">${pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).'}</p>`) +
      `<h3 class="section-title" style="margin-top:26px">Loaners</h3>${loanersSectionHtml()}` +
      `<h3 class="section-title" style="margin-top:26px">Included Vessels</h3>${includedSectionHtml()}`,
    collection: () => collectionSectionHtml(),
    buybacks: () => buybackStatsHtml(),
    top: () => topListsHtml(),
    spending: () => spendingSectionHtml(),
    history: () =>
      (historySectionHtml() ||
        '<p class="muted">Your flight log starts with your next scan: every scan that finds changes gets logged here.</p>') +
      backupRowHtml(),
  };
  const tab = tabs[state.statsTab] ? state.statsTab : 'overview';
  setHTML(
    body,
    `<div class="layout-toggle stats-tabs" role="tablist">${STATS_TABS.map(
      ([key, label]) =>
        `<button role="tab" data-stats-tab="${key}" aria-selected="${key === tab}" class="${
          key === tab ? 'active' : ''
        }">${label}</button>`,
    ).join('')}</div>` + tabs[tab](),
  );
}

// --- Stats: Collection / Buy-backs / Top lists --------------------------------
// Rows with data-open-item / data-open-bb open that pledge or buy-back.
const sBox = (big, lbl, cls = '') =>
  `<div class="stat-box ${cls}"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
function sBars(rows, fmt = (n) => n) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows
    .map(
      ([
        label,
        n,
        title,
        type,
      ]) => `<div class="bar-row"${title ? ` title="${OH.escapeHtml(title)}"` : ''}>
        <div class="bar-label">${OH.escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill${type ? ` t-${type}` : ''}" style="width:${Math.round((n / max) * 100)}%"></div></div>
        <div class="bar-val">${fmt(n)}</div>
      </div>`,
    )
    .join('');
}
const itemRow = (p, right) =>
  `<div class="row clickable" tabindex="0" role="button" data-open-item="${OH.escapeHtml(String(p.id))}"><div class="nm">${OH.escapeHtml(
    plainName(p),
  )}</div><div class="vl">${right}</div></div>`;
const bbRow = (b, right) =>
  `<div class="row clickable" tabindex="0" role="button" data-open-bb="${OH.escapeHtml(String(b.id))}"><div class="nm">${OH.escapeHtml(
    buybackName(b),
  )}</div><div class="vl">${right}</div></div>`;

function collectionSectionHtml() {
  if (!state.shipOf)
    return `<p class="muted">${pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).'}</p>`;
  const c = OH.collectionStats(state.items, state.shipOf, state.catalog || []);
  const insOrder = (t) => (t === 'LTI' ? 1e6 : parseInt(t, 10) * (/y/i.test(t) ? 12 : 1) || 0);
  const ins = Object.entries(c.insurance)
    .sort((a, b) => insOrder(b[0]) - insOrder(a[0]))
    .map(([t, n]) => [insLabel(t), n]);
  const withIns = ins.reduce((a, r) => a + r[1], 0);
  const lti = c.insurance.LTI || 0;
  const makers = c.makers
    .map(
      (m) => `<div class="bar-row" title="${OH.escapeHtml(m.models.join(', '))}">
        <div class="bar-label">${OH.escapeHtml(m.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((m.own / m.total) * 100)}%"></div></div>
        <div class="bar-val">${m.own} of ${m.total}</div>
      </div>`,
    )
    .join('');
  return (
    `<div class="stat-grid">${
      sBox(withIns ? `${Math.round((lti / withIns) * 100)}%` : '—', 'of insured pledges are LTI') +
      sBox(c.giftable, 'giftable') +
      sBox(c.notGiftable, 'not giftable') +
      sBox(c.meltable, 'meltable') +
      sBox(c.makers.length, 'manufacturers')
    }</div>` +
    `<h3 class="section-title">Insurance</h3>${ins.length ? sBars(ins) : '<p class="muted">No insurance found in your pledges. Fly carefully out there.</p>'}` +
    `<h3 class="section-title" style="margin-top:26px">Collection by Manufacturer</h3>` +
    `<p class="muted value-note tight">How many of each maker's ship models you own (out of the ones with a store price). Hover a row to see which.</p>` +
    (makers ||
      '<p class="muted">No ships matched the ship list yet. Scan and they’ll roll out of the hangar.</p>')
  );
}

function buybackStatsHtml() {
  const bbs = state.buybacks;
  if (!bbs.length)
    return '<p class="muted">No buy-backs yet. Hit Scan at the top to pull them in.</p>';
  if (!state.priceOf) ensurePrices();
  const byKind = BB_KINDS.map((k) => [
    k.label,
    bbs.filter((b) => b.kind === k.key).length,
    '',
    TYPE_KEYS.includes(k.key) ? k.key : '',
  ]).filter((r) => r[1]);
  const priced = bbs.map((b) => ({ b, v: bbPrice(b) })).filter((x) => x.v);
  const total = priced.reduce((a, x) => a + x.v, 0);
  const real = bbs.filter((b) => bbDetail(b)).length;
  // Most-melted: same ship melted again and again.
  const counts = new Map();
  for (const b of bbs) {
    if (b.isCCU) continue;
    const k = String(b.name || '')
      .replace(/^\s*.+?\s+[-–]\s/, '')
      .trim();
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const most = [...counts]
    .filter((r) => r[1] > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const top = priced.sort((a, b) => b.v - a.v).slice(0, 10);
  const next = nextTokenDate();
  return (
    `<div class="stat-grid">${
      sBox(bbs.length, 'buy-backs') +
      sBox(
        dollars(total),
        `to buy all back${real < bbs.length ? ' (≈, load details for real prices)' : ''}`,
      ) +
      sBox(state.bbTokens != null ? state.bbTokens : '—', 'buy-back tokens') +
      sBox(next || '—', 'next token') +
      sBox(`${real} / ${bbs.length}`, 'with details loaded')
    }</div>` +
    `<h3 class="section-title">By Type</h3>${sBars(byKind)}` +
    `<h3 class="section-title" style="margin-top:26px">Most Valuable to Buy Back</h3>` +
    `<div class="top-list">${top.map(({ b, v }) => bbRow(b, dollars(v))).join('') || '<div class="row muted">No prices yet.</div>'}</div>` +
    (most.length
      ? `<h3 class="section-title" style="margin-top:26px">Melted Most Often</h3><div class="top-list">${most
          .map(
            ([n, k]) =>
              `<div class="row"><div class="nm">${OH.escapeHtml(n)}</div><div class="vl">×${k}</div></div>`,
          )
          .join('')}</div>`
      : '')
  );
}

function topListsHtml() {
  const items = state.items;
  const byValue = items
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const dt = (p) => {
    const t = Date.parse(p.date);
    return Number.isNaN(t) ? null : t;
  };
  const oldest = items
    .filter((p) => dt(p) != null)
    .sort((a, b) => dt(a) - dt(b))
    .slice(0, 10);
  const v = hangarValue();
  const savings = v
    ? items
        .map((p) => ({ p, si: v.pledges[p.id] }))
        .filter(
          // paid > 0: free rewards aren't savings
          (x) => x.si && x.si.store && x.si.paid > 0 && x.si.store - x.si.paid >= 1,
        )
        .sort((a, b) => b.si.store - b.si.paid - (a.si.store - a.si.paid))
        .slice(0, 10)
    : [];
  const ltiShips = items
    .filter((p) => p.insurance === 'LTI' && p.containsShip && Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const list = (rows) =>
    `<div class="top-list">${rows || '<div class="row muted">Nothing here yet.</div>'}</div>`;
  return (
    `<div class="top-cols"><div><h3 class="section-title">Most Valuable Pledges</h3>${list(
      byValue.map((p) => itemRow(p, OH.escapeHtml(formatValue(p)))).join(''),
    )}</div>` +
    `<div><h3 class="section-title">Biggest Savings vs Store Price</h3>${list(
      savings
        .map(({ p, si }) =>
          itemRow(
            p,
            `${dollars(si.paid)} → ${dollars(si.store)} <span class="gain">+${dollars(si.store - si.paid)}</span>`,
          ),
        )
        .join(''),
    )}</div>` +
    `<div><h3 class="section-title">Oldest Pledges</h3>${list(
      oldest.map((p) => itemRow(p, OH.escapeHtml(p.date))).join(''),
    )}</div>` +
    `<div><h3 class="section-title">Most Valuable LTI Ships</h3>${list(
      ltiShips.map((p) => itemRow(p, OH.escapeHtml(formatValue(p)))).join(''),
    )}</div></div>` +
    `<p class="muted value-note">Click any row to open it. Savings compare melt value with today's standard store price (warbonds, sales, CCU'd pledges).</p>`
  );
}

// History lives only in this browser, so the History tab offers a backup file
// (scans + history) and says how old the last one is.
function backupRowHtml() {
  const t = state.lastBackupAt;
  const days = t ? Math.floor((Date.now() - t) / 86400000) : null;
  const when = !t
    ? '<span class="stale">never backed up</span>'
    : days > 60
      ? `<span class="stale">last backup ${fmtDay(t)}</span>`
      : `last backup ${fmtDay(t)}`;
  return `<div class="backup-row">
    <button class="mk-btn" type="button" data-backup>Download Backup</button>
    <span class="muted">${when} · Your scans and this history live only in this browser — uninstalling the extension or moving to another browser loses them. Keep the file somewhere safe (a Drive or OneDrive folder works) and restore it with Developers → Import JSON.</span>
  </div>`;
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

// Build a cumulative-over-time area+line chart + a per-month bar chart, as one SVG.
function recruitsOverTimeSvg(rows) {
  const dated = rows
    .map(recruitDate)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (dated.length < 2)
    return '<p class="muted">Not enough dated recruits to chart yet. Recruit a few more and this lights up.</p>';
  // Bucket by month.
  const counts = new Map();
  for (const d of dated) counts.set(monthKey(d), (counts.get(monthKey(d)) || 0) + 1);
  // Fill gaps between first and last month so the x-axis is continuous.
  const months = [];
  const start = new Date(dated[0].getFullYear(), dated[0].getMonth(), 1);
  const end = new Date(
    dated[dated.length - 1].getFullYear(),
    dated[dated.length - 1].getMonth(),
    1,
  );
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push({ key: monthKey(d), n: counts.get(monthKey(d)) || 0 });
  }
  let cum = 0;
  const series = months.map((m) => ({ ...m, cum: (cum += m.n) }));
  const W = 560,
    H = 180,
    padL = 34,
    padR = 8,
    padB = 22,
    padT = 8;
  const iw = W - padL - padR,
    ih = H - padT - padB;
  const maxCum = series[series.length - 1].cum || 1;
  const maxBar = Math.max(1, ...series.map((s) => s.n));
  const x = (i) => padL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const yCum = (v) => padT + ih - (v / maxCum) * ih;
  const linePts = series.map((s, i) => `${x(i).toFixed(1)},${yCum(s.cum).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${padT + ih} ${linePts} ${(padL + iw).toFixed(1)},${(padT + ih).toFixed(1)}`;
  const barW = Math.max(2, (iw / series.length) * 0.5);
  const bars = series
    .map((s, i) => {
      const h = (s.n / maxBar) * ih;
      return `<rect class="bar" x="${(x(i) - barW / 2).toFixed(1)}" y="${(padT + ih - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" opacity="0.35"></rect>`;
    })
    .join('');
  // X labels: first, middle, last month.
  const lblIdx = [...new Set([0, Math.floor(series.length / 2), series.length - 1])];
  const labels = lblIdx
    .map(
      (i) =>
        `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${series[i].key}</text>`,
    )
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Recruits over time">
    <line class="axis" x1="${padL}" y1="${padT + ih}" x2="${padL + iw}" y2="${padT + ih}"></line>
    ${bars}
    <polygon class="area" points="${areaPts}"></polygon>
    <polyline class="line" points="${linePts}"></polyline>
    <text class="tick" x="${padL - 6}" y="${yCum(maxCum) + 3}" text-anchor="end">${maxCum}</text>
    <text class="tick" x="${padL - 6}" y="${padT + ih}" text-anchor="end">0</text>
    ${labels}
  </svg>`;
}

function conversionHtml(ref) {
  const prospects = ref.prospects ?? 0;
  const recruits = ref.legacy?.recruits ?? 0;
  const pct = prospects > 0 ? (recruits / prospects) * 100 : 0;
  const restPct = Math.max(0, 100 - pct);
  return `<div class="ref-conv-rate" style="font-size:26px;font-weight:700;margin-bottom:8px">${pct.toFixed(1)}%</div>
    <div class="ref-conv-bar">
      <div class="seg-conv" style="width:${pct.toFixed(2)}%"></div>
      <div class="seg-rest" style="width:${restPct.toFixed(2)}%"></div>
    </div>
    <div class="ref-conv-legend">
      <span><span class="dot" style="background:var(--good)"></span>${recruits.toLocaleString('en-US')} recruits</span>
      <span><span class="dot" style="background:rgba(255,255,255,0.1)"></span>${(prospects - recruits).toLocaleString('en-US')} prospects</span>
    </div>`;
}

// New recruits per calendar year (by conversion date), as a small bar chart.
function recruitsByYearHtml(rows) {
  const byYear = new Map();
  for (const r of rows) {
    const d = recruitDate(r);
    if (d) byYear.set(d.getFullYear(), (byYear.get(d.getFullYear()) || 0) + 1);
  }
  if (!byYear.size) return '<p class="muted">No dated recruits yet.</p>';
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const max = Math.max(...byYear.values());
  return years
    .map((y) => {
      const n = byYear.get(y);
      const pct = Math.round((n / max) * 100);
      return `<div class="bar-row">
        <div class="bar-label">${y}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-val">${n}</div>
      </div>`;
    })
    .join('');
}

// Render one reward item as a link. Ships link to the RSI ship-matrix and carry a
// data-resolve so the shared hover-preview lazily fetches their art (reusing
// OH.getShipImage / #item-preview). Non-ship items link to a starcitizen.tools
// search. `img` overrides the ship name used for art lookup when it differs.
function rewardItemHtml(item) {
  const label = OH.escapeHtml(item.n);
  if (item.ship) {
    const shipName = item.img || item.n.replace(/\s*\(LTI\)/i, '').trim();
    const href = `https://robertsspaceindustries.com/ship-matrix/search?q=${encodeURIComponent(shipName)}`;
    return `<a class="reward-item ship" href="${href}" target="_blank" rel="noopener" data-resolve="${OH.escapeHtml(shipName)}">${label}</a>`;
  }
  const href = `https://starcitizen.tools/index.php?search=${encodeURIComponent(item.n)}`;
  return `<a class="reward-item" href="${href}" target="_blank" rel="noopener">${label}</a>`;
}

// All items of a tier, joined — each independently linked/hoverable.
function rewardItemsHtml(items) {
  return (items || []).map(rewardItemHtml).join('<span class="reward-sep"> · </span>');
}

// Render one reward ladder (standard | legacy) as rows, marking each tier unlocked
// (recruits ≥ tier) or locked, and highlighting the NEXT tier with the gap to go.
// `recruits` is the user's all-time recruit total (legacy total = same number).
function rewardLadderHtml(ladder, recruits, title, note) {
  const next = ladder.find((t) => recruits < t.at) || null;
  const unlocked = ladder.filter((t) => recruits >= t.at).length;
  const rows = ladder
    .map((t) => {
      const isUnlocked = recruits >= t.at;
      const isNext = next && t.at === next.at;
      const cls = isUnlocked ? 'reward-unlocked' : isNext ? 'reward-next' : 'reward-locked';
      const mark = isUnlocked ? '✓' : isNext ? '◷' : '○';
      const need = isNext
        ? ` <span class="reward-togo">${(t.at - recruits).toLocaleString('en-US')} to go</span>`
        : '';
      const rank = t.rank ? `<span class="reward-rank">${OH.escapeHtml(t.rank)}</span> ` : '';
      return `<tr class="${cls}">
        <td class="reward-mark">${mark}</td>
        <td class="reward-at">${t.at.toLocaleString('en-US')}</td>
        <td class="reward-name">${rank}${rewardItemsHtml(t.items)}${need}</td>
      </tr>`;
    })
    .join('');
  const nextItems = next ? rewardItemsHtml(next.items) : '';
  const nextLine = next
    ? `Next: ${nextItems} at ${next.at.toLocaleString('en-US')} (${(next.at - recruits).toLocaleString('en-US')} more)`
    : 'All tiers unlocked';
  return `<div class="reward-ladder">
    <h4>${OH.escapeHtml(title)} <span class="reward-progress">${unlocked}/${ladder.length} unlocked</span></h4>
    ${note ? `<p class="muted reward-note">${note}</p>` : ''}
    <p class="muted reward-next-line">${nextLine}</p>
    <table class="reward-table"><tbody>${rows}</tbody></table>
  </div>`;
}

// Both ladders side by side. Legacy is only shown if the user has legacy access —
// which we infer from the data: a legacy recruit count means they qualified
// (referred ≥1 package buyer before the 2025-07-02 cutoff).
function rewardsHtml(ref) {
  const recruits = ref.legacy?.recruits ?? 0;
  const hasLegacy = (ref.legacy?.recruits ?? 0) > 0;
  const standard = rewardLadderHtml(
    REFERRAL_LADDER_STANDARD,
    recruits,
    'Standard ladder',
    'Always-on rewards; tiers by total recruits.',
  );
  if (!hasLegacy) return `<div class="reward-ladders">${standard}</div>`;
  const legacy = rewardLadderHtml(
    REFERRAL_LADDER_LEGACY,
    recruits,
    'Legacy ladder',
    'Pre-July 2025 ladder — you keep access, and new recruits still count toward it.',
  );
  return `<div class="reward-ladders two">${standard}${legacy}</div>`;
}

// Event bonuses you earned. The reward is granted ONCE per event (not per recruit).
// "Date received" = the earliest recruit conversion that fell in the event window
// (i.e. when you first qualified). Best-effort — the event list is hand-maintained
// and may lag CIG's, and per-day nuances within an event aren't modelled.
function eventRewardsHtml(recruitsRows) {
  const hits = new Map(); // event name -> { ev, firstDate }
  for (const r of recruitsRows) {
    const d = recruitDate(r);
    const ev = eventForDate(d);
    if (!ev) continue;
    const cur = hits.get(ev.name);
    if (!cur) hits.set(ev.name, { ev, firstDate: d });
    else if (d < cur.firstDate) cur.firstDate = d;
  }
  const earned = [...hits.values()].sort((a, b) => parseTs(b.ev.start) - parseTs(a.ev.start));
  const intro = `<p class="muted" style="font-size:12px;margin:0 0 12px">
    A recruit who <strong>converted</strong> during a special-incentive event earns you that
    event's bonus reward, once per event. The event list refreshes weekly from the Star Citizen wiki.</p>`;
  if (!earned.length) {
    return (
      intro +
      '<p class="muted">No recruits converted during a tracked bonus event. Next IAE, maybe.</p>'
    );
  }
  const items = earned
    .map(
      ({ ev, firstDate }) => `<li class="event-item">
        <span class="event-check">✓</span>
        <span class="event-text">${OH.escapeHtml(ev.name)} — ${OH.escapeHtml(ev.reward)}</span>
        <span class="event-date">${firstDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      </li>`,
    )
    .join('');
  return (
    intro +
    `<p class="reward-next-line" style="margin-bottom:10px"><strong>${earned.length}</strong> event bonus reward(s) earned.</p>
    <ul class="event-list">${items}</ul>`
  );
}

// The active referral list (recruits | prospects), with search + sort applied.
function refFilteredList() {
  const ref = state.referral;
  let list = (state.refTab === 'prospects' ? ref.prospectsList : ref.recruitsList) || [];
  const q = state.refQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((r) => `${r.handle || ''} ${r.moniker || ''}`.toLowerCase().includes(q));
  }
  // Sort by the date shown in this tab: recruits by conversion, prospects by enlist.
  const ts = (r) => {
    const d = state.refTab === 'recruits' ? recruitDate(r) : parseTs(r.enlistedOn);
    return d ? d.getTime() : 0;
  };
  const byName = (a, b) => (a.handle || a.moniker || '').localeCompare(b.handle || b.moniker || '');
  list = list.slice().sort((a, b) => {
    switch (state.refSort) {
      case 'oldest':
        return ts(a) - ts(b);
      case 'name':
        return byName(a, b);
      case 'newest':
      default:
        return ts(b) - ts(a);
    }
  });
  return list;
}

function refListRows() {
  const full =
    (state.refTab === 'prospects' ? state.referral.prospectsList : state.referral.recruitsList) ||
    [];
  const list = refFilteredList();
  if (!list.length) {
    const msg = full.length ? `No ${state.refTab} match your search.` : `No ${state.refTab} found.`;
    return `<tr><td colspan="3" class="muted">${msg}</td></tr>`;
  }
  return list
    .map((r) => {
      const handle = r.handle || r.moniker || '—';
      // Link the handle to the citizen's RSI dossier, but styled as plain text
      // (not a blue hyperlink) — see .ref-citizen-link.
      const citizenUrl = r.handle
        ? `https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(r.handle)}`
        : null;
      const link = citizenUrl
        ? `<a class="ref-citizen-link" href="${citizenUrl}" target="_blank" rel="noopener">${OH.escapeHtml(handle)}</a>`
        : OH.escapeHtml(handle);
      // Only flag legacy-ladder recruits; "current" is the default, so no badge.
      const badge =
        state.refTab === 'recruits' && r.campaign === 'legacy'
          ? ` <span class="ref-badge legacy">legacy</span>`
          : '';
      // Recruits show their CONVERSION date (when they counted); prospects show
      // when they enlisted (they haven't converted). Flag recruits who converted
      // during a bonus event with a small ★.
      let when = '—';
      let eventTag = '';
      if (state.refTab === 'recruits') {
        const d = recruitDate(r);
        when = d ? d.toLocaleDateString() : '—';
        const ev = d ? eventForDate(d) : null;
        if (ev)
          eventTag = ` <span class="ref-event" title="${OH.escapeHtml(ev.name)}: ${OH.escapeHtml(ev.reward)}">★</span>`;
      } else {
        const d = parseTs(r.enlistedOn);
        when = d ? d.toLocaleDateString() : '—';
      }
      return `<tr>
      <td class="r-handle">${link}${badge}</td>
      <td>${OH.escapeHtml(r.moniker || '')}</td>
      <td>${OH.escapeHtml(when)}${eventTag}</td>
    </tr>`;
    })
    .join('');
}

// Re-render only the list table + result count (used by search/sort/tab events so
// we don't rebuild the whole page and lose input focus / chart state).
function renderRefList() {
  const tbody = $('#ref-tbody');
  const count = $('#ref-count');
  if (tbody) setHTML(tbody, refListRows());
  if (count) {
    const shown = refFilteredList().length;
    const total =
      (state.refTab === 'prospects' ? state.referral.prospectsList : state.referral.recruitsList) ||
      [];
    count.textContent = `Showing ${shown.toLocaleString('en-US')} of ${total.length.toLocaleString('en-US')}`;
  }
  // The date column means different things per tab (see refListRows).
  const dateCol = $('#ref-date-col');
  if (dateCol) dateCol.textContent = state.refTab === 'recruits' ? 'Converted' : 'Enlisted';
  document.querySelectorAll('#referrals-body .ref-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.reftab === state.refTab);
  });
}

// --- Referrals: progress, gallery, milestones, insights, share card ---------
// The bonus-event list starts as the built-in REFERRAL_EVENTS and is refreshed
// from the wiki (OH.getReferralEvents, cached a week) the first time the page
// opens; wiki rows replace built-in ones with the same start date.
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

// A row of dots, one per tier: lit when earned, ringed for the next one.
function ladderTrackHtml(ladder, recruits, label) {
  const { next } = tierProgress(ladder, recruits);
  const dots = ladder
    .map((t) => {
      const cls = recruits >= t.at ? 'on' : next && t.at === next.at ? 'next' : '';
      const tip = `${t.at.toLocaleString('en-US')} recruit${t.at === 1 ? '' : 's'}${t.rank ? ` · ${t.rank}` : ''}: ${rewardNames(t.items)}`;
      return `<div class="rt-step ${cls}" data-tip="${OH.escapeHtml(tip)}" aria-label="${OH.escapeHtml(tip)}"${
        t.file ? ` data-file="${OH.escapeHtml(t.file)}"` : ''
      }><span class="rt-dot"></span><span class="rt-at">${t.at.toLocaleString('en-US')}</span></div>`;
    })
    .join('');
  return `<div class="rt"><div class="rt-label">${OH.escapeHtml(label)}</div><div class="rt-track">${dots}</div></div>`;
}

// The legacy rank you hold (e.g. "Sergeant"), or ''.
function legacyRank(recruits) {
  const done = REFERRAL_LADDER_LEGACY.filter((t) => recruits >= t.at);
  return done.length ? done[done.length - 1].rank : '';
}

// Top of the page: recruits, rank, the bar to the next reward, both tracks.
function refHeroHtml(ref, recruits, projection, hasLegacy) {
  const p = tierProgress(REFERRAL_LADDER_STANDARD, recruits);
  const rank = hasLegacy ? legacyRank(recruits) : '';
  const nextLine = p.next
    ? `<strong>${(p.next.at - recruits).toLocaleString('en-US')} more</strong> to ${OH.escapeHtml(rewardNames(p.next.items))}${
        projection && projection !== '—'
          ? ` <span class="muted">· at your pace ${OH.escapeHtml(projection)}</span>`
          : ''
      }`
    : 'Every standard reward unlocked';
  const running = runningEvent();
  const eventPill = running
    ? `<div class="ref-hero-event">Bonus event on now: <strong>${OH.escapeHtml(running.name)}</strong>, until ${OH.escapeHtml(
        fmtDate(parseTs(running.end + ' 00:00:00')),
      )}</div>`
    : '';
  return `<div class="ref-hero">
    <div class="ref-hero-top">
      <div>
        <div class="ref-hero-n">${recruits.toLocaleString('en-US')}<span> recruit${recruits === 1 ? '' : 's'}</span></div>
        ${rank ? `<div class="ref-hero-rank">${OH.escapeHtml(rank)}</div>` : ''}
      </div>
      <div class="ref-share">
        <label class="mk-toggle" title="Adds your referral code and a QR code people can scan"><input type="checkbox" id="ref-share-code"> Include My Code</label>
        <button type="button" class="mk-btn" id="ref-share">Download Image</button>
        <span class="mk-export-status" id="ref-share-status" aria-live="polite"></span>
      </div>
    </div>
    <div class="ref-hero-next">${nextLine}</div>
    <div class="ref-hero-bar"><div style="width:${(p.pct * 100).toFixed(1)}%"></div></div>
    <div class="ref-hero-bar-ends"><span>${p.from.toLocaleString('en-US')}</span><span>${p.next ? p.next.at.toLocaleString('en-US') : ''}</span></div>
    ${eventPill}
    ${ladderTrackHtml(REFERRAL_LADDER_STANDARD, recruits, 'Standard ladder')}
    ${hasLegacy ? ladderTrackHtml(REFERRAL_LADDER_LEGACY, recruits, 'Legacy ladder') : ''}
  </div>`;
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
function rewardsGalleryHtml(list) {
  if (!list.length)
    return '<p class="muted">No rewards yet. Your first recruit unlocks the GCD-Army armor. Go recruit a wingman.</p>';
  const attr = (k, v) => (v ? ` data-${k}="${OH.escapeHtml(v)}"` : '');
  return `<div class="ref-gallery">${list
    .map(
      (r) => `<div class="ref-gcard"${attr('file', r.file)}${attr('resolve', r.resolve)}>
        <div class="ref-gimg"></div>
        <div class="ref-gname" title="${OH.escapeHtml(r.name)}">${OH.escapeHtml(r.name)}</div>
        <div class="ref-gsub">${OH.escapeHtml(r.sub)}</div>
      </div>`,
    )
    .join('')}</div>`;
}
// Fill each card's picture: the wiki's picture for that tier/event (one batched
// lookup), else the ship's art for ship rewards.
async function enhanceGalleryImages(container) {
  const cards = [...container.querySelectorAll('.ref-gcard')];
  const put = (card, url) => {
    const slot = card.querySelector('.ref-gimg');
    if (!url || !slot || !slot.isConnected) return;
    const im = document.createElement('img');
    im.alt = '';
    im.loading = 'lazy';
    im.src = url;
    im.addEventListener('error', () => im.remove());
    slot.replaceChildren(im);
    card.dataset.image = url;
  };
  const files = await OH.wikiImageUrls(cards.map((c) => c.dataset.file).filter(Boolean));
  const rest = [];
  for (const card of cards) {
    const url = card.dataset.file && files[card.dataset.file];
    if (url) put(card, url);
    else if (card.dataset.resolve) rest.push(card);
  }
  let i = 0;
  const worker = async () => {
    while (i < rest.length) {
      const card = rest[i++];
      put(card, await OH.getShipImage(card.dataset.resolve));
    }
  };
  for (let w = 0; w < 3; w++) worker();
}

// When each tier was reached: the Nth recruit's conversion date. If RSI's list
// is shorter than the total (very old recruits), early tiers have no date.
function milestonesHtml(recruits, recruitsRows, hasLegacy) {
  const dates = recruitsRows
    .map(recruitDate)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const offset = recruits - dates.length; // recruits we have no date for
  const byAt = new Map();
  const tiers = [...REFERRAL_LADDER_STANDARD, ...(hasLegacy ? REFERRAL_LADDER_LEGACY : [])].filter(
    (t) => recruits >= t.at,
  );
  for (const t of tiers) {
    const cur = byAt.get(t.at) || { at: t.at, items: [], rank: '' };
    cur.items.push(...t.items);
    if (t.rank) cur.rank = t.rank;
    byAt.set(t.at, cur);
  }
  const rows = [...byAt.values()].sort((a, b) => b.at - a.at);
  if (!rows.length)
    return '<p class="muted">Your first milestone is 1 recruit. Every fleet starts with a wingman.</p>';
  return `<ol class="ref-timeline">${rows
    .map((m) => {
      const d = dates[m.at - 1 - offset];
      return `<li><span class="rtl-dot"></span>
        <div class="rtl-head"><strong>${m.at.toLocaleString('en-US')} recruit${m.at === 1 ? '' : 's'}</strong>${
          m.rank ? ` <span class="reward-rank">${OH.escapeHtml(m.rank)}</span>` : ''
        }<span class="rtl-date">${d ? OH.escapeHtml(fmtDate(d)) : 'before your recruit list starts'}</span></div>
        <div class="rtl-items muted">${OH.escapeHtml(rewardNames(m.items))}</div></li>`;
    })
    .join('')}</ol>`;
}

// How long prospects have been waiting, and how fast recruits converted.
function prospectInsightsHtml(ref) {
  const DAY = 86400000;
  const now = Date.now();
  const buckets = [
    ['Under 30 days', 30],
    ['1 to 3 months', 91],
    ['3 to 12 months', 365],
    ['1 to 2 years', 730],
    ['Over 2 years', Infinity],
  ].map(([label, max]) => ({ label, max, n: 0 }));
  for (const p of ref.prospectsList || []) {
    const d = parseTs(p.enlistedOn);
    if (!d) continue;
    const age = (now - d) / DAY;
    buckets.find((b) => age < b.max).n++;
  }
  const maxN = Math.max(1, ...buckets.map((b) => b.n));
  const bars = buckets
    .map(
      (b) => `<div class="bar-row">
        <div class="bar-label">${b.label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((b.n / maxN) * 100)}%"></div></div>
        <div class="bar-val">${b.n.toLocaleString('en-US')}</div>
      </div>`,
    )
    .join('');
  const waits = (ref.recruitsList || [])
    .map((r) => {
      const a = parseTs(r.enlistedOn);
      const b = parseTs(r.convertedOn);
      return a && b && b >= a ? (b - a) / DAY : null;
    })
    .filter((x) => x != null)
    .sort((a, b) => a - b);
  let speed = '<p class="muted">No recruits with both dates yet. Still waiting on comms.</p>';
  if (waits.length) {
    const median = waits[Math.floor(waits.length / 2)];
    const within = (days) =>
      Math.round((waits.filter((w) => w <= days).length / waits.length) * 100);
    const days = (n) =>
      n < 1 ? 'same day' : `${Math.round(n)} day${Math.round(n) === 1 ? '' : 's'}`;
    speed = `<div class="stat-grid">
      <div class="stat-box"><div class="big">${days(median)}</div><div class="lbl">typical time to convert</div></div>
      <div class="stat-box"><div class="big">${within(1)}%</div><div class="lbl">bought the same day</div></div>
      <div class="stat-box"><div class="big">${within(30)}%</div><div class="lbl">within 30 days</div></div>
      <div class="stat-box"><div class="big">${100 - within(365)}%</div><div class="lbl">took over a year</div></div>
    </div>`;
  }
  return `<div class="ref-charts">
    <div class="ref-chart"><h4>Waiting Prospects by Age</h4>${bars}
      <p class="muted ref-small">People who signed up with your code but haven't bought a game package yet. Still in the lobby. RSI doesn't share a way to contact them.</p></div>
    <div class="ref-chart"><h4>How Fast Recruits Bought</h4>${speed}</div>
  </div>`;
}

// The event running today, or null.
function runningEvent() {
  const today = new Date();
  return eventForDate(today);
}
function eventBannerHtml() {
  const running = runningEvent();
  if (running) {
    return `<div class="ref-event-banner live"><strong>${OH.escapeHtml(running.name)}</strong> is on until ${OH.escapeHtml(
      fmtDate(parseTs(running.end + ' 00:00:00')),
    )}. Anyone who enlists with your code and buys a game package gets you: <strong>${OH.escapeHtml(running.reward)}</strong>.</div>`;
  }
  const past = referralEvents.filter((e) => parseTs(e.end + ' 23:59:59') < new Date());
  const last = past[past.length - 1];
  return last
    ? `<div class="ref-event-banner">No bonus event right now. The last one was <strong>${OH.escapeHtml(last.name)}</strong> (${OH.escapeHtml(
        fmtDate(parseTs(last.start + ' 00:00:00')),
      )}, ${OH.escapeHtml(last.reward)}). CIG runs one every few months.</div>`
    : '';
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

function renderReferrals() {
  const body = $('#referrals-body');
  if (!body) return;
  const ref = state.referral;

  // Not signed in / never scanned → a friendly prompt instead of a blank page.
  if (!ref) {
    setHTML(
      body,
      `<div class="placeholder-view">
      <p class="muted">No recruits on the roster yet. Your wingmen are out there somewhere. Hit
        <strong>Scan</strong> at the top to pull your recruits and prospects from your
        <a href="https://robertsspaceindustries.com/en/referral" target="_blank" rel="noopener">RSI Referral Rewards</a> page.</p>
    </div>`,
    );
    return;
  }

  const box = (big, lbl, cls = '') =>
    `<div class="stat-box ${cls}"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const recruitsRows = ref.recruitsList || [];
  const recruits = ref.legacy?.recruits ?? 0; // all-time recruit total
  const prospects = ref.prospects ?? 0;
  const total = prospects + recruits; // everyone who used your code (signed up or converted)
  const hasLegacy = recruits > 0; // a legacy recruit count means legacy ladder access (see rewardsHtml)

  // Date-derived stats from recruit CONVERSION dates (when they actually counted).
  const dates = recruitsRows.map(recruitDate).filter(Boolean);
  const best = bestMonth(dates);
  const convRate = prospects > 0 ? `${((recruits / prospects) * 100).toFixed(1)}%` : '—';

  // --- Richer, referral-specific stats ------------------------------------
  const DAY = 86400000;
  const now = new Date();
  const prospectsList = ref.prospectsList || [];

  // Momentum: conversions in the last 30 / 90 days, and trend vs the prior 30.
  const convInWindow = (fromDaysAgo, toDaysAgo = 0) =>
    dates.filter((d) => {
      const age = (now - d) / DAY;
      return age >= toDaysAgo && age < fromDaysAgo;
    }).length;
  const last30 = convInWindow(30);
  const prev30 = convInWindow(60, 30);
  const last90 = convInWindow(90);
  let trend = '';
  if (prev30 > 0) {
    const pct = Math.round(((last30 - prev30) / prev30) * 100);
    trend = pct === 0 ? '→ flat' : pct > 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
  } else if (last30 > 0) {
    trend = '↑ new';
  }

  // Recent pace (recruits/month over the last 90 days) → projection to next tier.
  const pace90 = last90 / 3; // per month
  const nextTier = REFERRAL_LADDER_STANDARD.find((t) => recruits < t.at) || null;
  let projection = '—';
  if (nextTier) {
    const toGo = nextTier.at - recruits;
    if (pace90 > 0) {
      const months = toGo / pace90;
      projection =
        months < 1
          ? '< 1 mo'
          : months < 18
            ? `${Math.round(months)} mo`
            : `${(months / 12).toFixed(1)} yr`;
    }
  }

  // Prospect funnel: pending = prospects who haven't converted.
  const pending = prospectsList.length;

  const fmtDay = (ms) =>
    new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const latest = dates.length ? fmtDay(Math.max(...dates)) : '—';
  const first = dates.length ? fmtDay(Math.min(...dates)) : '—';

  // Three labelled clusters that read top→bottom as a story:
  //   Overview (what you have) → Recent activity (how you're trending) →
  //   Pipeline & progress (what's coming).
  const overview =
    box(total.toLocaleString('en-US'), 'total (prospects + recruits)', 'span2') +
    box(recruits.toLocaleString('en-US'), 'recruits') +
    box(prospects.toLocaleString('en-US'), 'prospects') +
    box(convRate, 'conversion');

  const activity =
    box(last30.toLocaleString('en-US'), 'recruits · last 30d') +
    box(trend || '—', 'vs prior 30d') +
    box(last90.toLocaleString('en-US'), 'recruits · last 90d') +
    box(latest, 'latest conversion');

  const pipeline =
    box(pending.toLocaleString('en-US'), 'pending prospects') +
    box(best ? `${best.n}` : '—', best ? `best month (${best.label})` : 'best month') +
    box(first, 'first conversion') +
    box(
      nextTier ? projection : '—',
      nextTier ? `est. to ${nextTier.at.toLocaleString('en-US')} tier` : 'all tiers done',
    );

  const tab = (key, label, n) =>
    `<button class="ref-tab ${state.refTab === key ? 'active' : ''}" data-reftab="${key}">${label} <b>${n.toLocaleString('en-US')}</b></button>`;

  const code = ref.code
    ? `<div class="ref-code-banner">Your referral code:
        <span class="ref-code">${OH.escapeHtml(ref.code)}</span>
        <button class="ref-copy" data-copy="${OH.escapeHtml(ref.url || ref.code)}" title="Copy referral link">Copy Link</button>
      </div>`
    : '';

  setHTML(
    body,
    `
    ${code}
    ${refHeroHtml(ref, recruits, nextTier ? projection : '', hasLegacy)}

    <h3 class="section-title" style="margin-top:26px">Rewards Earned</h3>
    ${rewardsGalleryHtml(earnedRewards(recruits, recruitsRows, hasLegacy))}

    <div class="stat-group-label" style="margin-top:22px">Overview</div>
    <div class="stat-grid ref-totals">${overview}</div>

    <div class="stat-group-label">Recent activity</div>
    <div class="stat-grid">${activity}</div>

    <div class="stat-group-label">Pipeline &amp; progress</div>
    <div class="stat-grid">${pipeline}</div>

    <h3 class="section-title" style="margin-top:26px">Trends</h3>
    <div class="ref-charts">
      <div class="ref-chart"><h4>Recruits Over Time (Cumulative · Monthly)</h4>${recruitsOverTimeSvg(recruitsRows)}</div>
      <div class="ref-chart"><h4>Prospect → Recruit Conversion</h4>${conversionHtml(ref)}</div>
    </div>
    <div class="stat-group-label">Recruits by year</div>
    ${recruitsByYearHtml(recruitsRows)}

    <h3 class="section-title" style="margin-top:26px">Prospects</h3>
    ${prospectInsightsHtml(ref)}

    <h3 class="section-title" style="margin-top:26px">Milestones</h3>
    ${milestonesHtml(recruits, recruitsRows, hasLegacy)}

    <h3 class="section-title" style="margin-top:26px">Tier Rewards</h3>
    ${rewardsHtml(ref)}

    <h3 class="section-title" style="margin-top:26px">Event Bonuses</h3>
    ${eventBannerHtml()}
    ${eventRewardsHtml(recruitsRows)}

    <h3 class="section-title" style="margin-top:26px">People</h3>
    <div class="ref-list-controls">
      <div class="ref-tabs">
        ${tab('recruits', 'Recruits', recruits)}
        ${tab('prospects', 'Prospects', prospects)}
      </div>
      <input id="ref-search" class="ref-search" type="search" placeholder="Search handle / moniker…" aria-label="Search Referrals" value="${OH.escapeHtml(state.refQuery)}" />
      <select id="ref-sort" class="ref-sort" aria-label="Sort Referrals">
        <option value="newest"${state.refSort === 'newest' ? ' selected' : ''}>Newest first</option>
        <option value="oldest"${state.refSort === 'oldest' ? ' selected' : ''}>Oldest first</option>
        <option value="name"${state.refSort === 'name' ? ' selected' : ''}>Name (A–Z)</option>
      </select>
    </div>
    <div id="ref-count" class="result-count"></div>
    <div class="ref-table-scroll">
      <table class="ref-table">
        <thead><tr><th>Handle</th><th>Moniker</th><th id="ref-date-col">Converted</th></tr></thead>
        <tbody id="ref-tbody">${refListRows()}</tbody>
      </table>
    </div>`,
  );

  renderRefList(); // fills #ref-count
  enhanceRewardImages(body); // lazily resolve ship art for reward-item hovers
  enhanceGalleryImages(body);
  enhanceLadderDots(body);
  refreshReferralEvents(); // once: newer bonus events from the wiki
}

// Resolve ship art for reward items (links with data-resolve) so the shared hover
// preview has an image to show. Lazy + concurrency-capped, mirroring
// enhanceCardImages; sets data-image on each resolved item.
function enhanceRewardImages(container) {
  const items = [...container.querySelectorAll('.reward-item.ship[data-resolve]')].filter(
    (el) => !el.dataset.image,
  );
  let i = 0;
  const CONCURRENCY = 3;
  const worker = async () => {
    while (i < items.length) {
      const el = items[i++];
      const url = await OH.getShipImage(el.dataset.resolve);
      if (url) el.dataset.image = url;
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) worker();
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

function buybackCardHtml(b) {
  const ccuArt = b.ccu && b.ccu.to && !b.shipArt; // show the target ship (see cardHtml)
  const img = ccuArt ? null : realImage(b.image);
  // A CCU resolves art from its target ship; a package from the first ship in it; a
  // plain buy-back from its own name. Also the broken-image fallback.
  const resolve = b.ccu && b.ccu.to ? b.ccu.to : resolveImageName({ ...b, kind: 'ship' }) || b.name;
  const thumb = img
    ? `<img class="thumb" loading="lazy" src="${OH.escapeHtml(img)}"${thumbSizeAttrs(img, state.bbLayout)} alt="">`
    : `<div class="thumb placeholder">Buy-Back</div>`;
  const nameHtml =
    (b.ccu
      ? `${OH.escapeHtml(OH.shortBuybackName(b.ccu.from))} <span class="ccu-flow">→</span> ${OH.escapeHtml(OH.shortBuybackName(b.ccu.to))}`
      : OH.escapeHtml(buybackName(b))) + (b._n > 1 ? ` <span class="stack-n">×${b._n}</span>` : '');
  const reclaim = buybackReclaimLink(b);
  const badgeClass = TYPE_KEYS.includes(b.isCCU ? 'ccu' : b.kind) ? (b.isCCU ? 'ccu' : b.kind) : '';
  // Every cell is always emitted (empty when there's nothing) so the List view's
  // fixed column grid lines up across rows, as in the Inventory cards.
  return `<div class="card" tabindex="0" role="group" aria-label="${OH.escapeHtml(bbFullName(b))}" data-id="${OH.escapeHtml(String(b.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}" data-rsi-image="${OH.escapeHtml(ccuArt ? realImage(b.image) || '' : '')}">
    ${thumb}
    <div class="card-body">
      <div class="card-name" title="${OH.escapeHtml(bbFullName(b))}">${nameHtml}</div>
      <div class="card-contents">${OH.escapeHtml(b.contains || '')}</div>
      <div class="card-foot">
        <span class="foot-left"><span class="badge ${badgeClass}">${OH.escapeHtml(b.kind || 'buy-back')}</span></span>
        <span class="bb-date">${OH.escapeHtml(b.date || '')}</span>
        <span class="bb-end">${bbPriceHtml(b)}${bbUnderHtml(b)}${reclaim}</span>
      </div>
    </div>
  </div>`;
}

// Buy-back kinds actually present in the scanned data, in BB_KINDS order.
function presentBbKinds() {
  return BB_KINDS.filter((k) => state.buybacks.some((b) => b.kind === k.key));
}

function bbChipHtml(kind) {
  const n = state.buybacks.filter((b) => b.kind === kind.key).length;
  const active = state.bbShown.size === 0 || state.bbShown.has(kind.key);
  return `<button class="chip k-${kind.key}" data-key="${kind.key}" aria-pressed="${active}">${OH.escapeHtml(
    kind.label,
  )}<span class="n">${n}</span></button>`;
}

// --- Buy-back tokens + prices ---------------------------------------------
// RSI adds one buy-back token per quarter (they don't roll over). Dates from
// RSI's "2026 Buy Back Token Schedule" Spectrum post; add next year's when
// it's announced.
const BUYBACK_TOKEN_DATES = ['2026-01-05', '2026-04-06', '2026-07-06', '2026-10-05'];
function nextTokenDate(now = Date.now()) {
  const d = BUYBACK_TOKEN_DATES.map((x) => new Date(x + 'T12:00:00Z')).find((t) => t > now);
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
  const next = nextTokenDate();
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
let bbLoading = null; // { stop: bool }
function bbDetailsBarHtml(list) {
  const need = list.filter((b) => !b.isCCU && /^\d+$/.test(String(b.id)) && !state.bbDetails[b.id]);
  const have = list.filter((b) => state.bbDetails[b.id]).length;
  if (bbLoading) {
    return `<div class="bb-details-bar"><span id="bbd-progress">Reading buy-back pages…</span> <button type="button" class="mk-btn" id="bbd-stop">Stop</button></div>`;
  }
  if (!need.length) return have ? '' : '';
  const mins = Math.max(1, Math.round((need.length * 1.6) / 60));
  // Big lists get a heads-up: hundreds of pages in a row is what makes RSI throttle.
  const big =
    need.length > 100
      ? ` Reading this many pages can make RSI slow you down for a while; if it does, we stop and keep what's read.`
      : '';
  return `<div class="bb-details-bar">${have ? `${have} of ${list.length} have details. ` : ''}Insurance, real prices and pack contents come from each buy-back's own RSI page. Opening a buy-back loads just that one. <button type="button" class="mk-btn primary" id="bbd-load">Load Details for ${need.length}</button> <span class="muted">(about ${mins} min, one page at a time; you can keep browsing.${big})</span></div>`;
}
// packsOnly: just the packs whose contents are unread (search's "Get Details").
async function loadBuybackDetails({ packsOnly = false } = {}) {
  const list = (packsOnly ? state.buybacks : computeBuybacks()).filter(
    (b) =>
      !b.isCCU &&
      !state.bbDetails[b.id] &&
      (!packsOnly || b.kind === 'pack' || b.kind === 'package'),
  );
  bbLoading = { stop: false };
  renderBuybacks();
  const res = await OH.fetchBuybackDetails(
    list.map((b) => String(b.id)),
    (done, total) => {
      const el = $('#bbd-progress');
      if (el) el.textContent = `Reading buy-back pages… ${done} of ${total}`;
      if (done % 10 === 0 && currentView() === 'buybacks') {
        state.bbDetails = { ...state.bbDetails };
      }
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
  if (state.bbUnder) list = list.filter(bbUnderStore);
  list = applyTraits(list, state.bbTraits, buybackFacets);
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

function renderBuybacks() {
  const body = $('#buybacks-body');
  const controls = $('#bb-controls');
  if (!body) return;
  if (!state.buybacks.length) {
    if (controls) controls.hidden = true;
    setHTML(
      body,
      `<div class="placeholder-view">
      <h2>Buy-Back Pledges</h2>
      <p class="muted">Melted something you miss? Your buy-backs show up here so you can claim them back. Hit
        <strong>Scan</strong> at the top to pull them in with your hangar.</p>
      <p class="muted">Buy-backs are read from
        <a href="https://robertsspaceindustries.com/account/buy-back-pledges" target="_blank" rel="noopener">RSI › Account › Buy-Back Pledges</a>
        , the same pages as your hangar.</p>
    </div>`,
    );
    return;
  }
  if (controls) controls.hidden = false;
  if (bbLayoutEl) {
    bbLayoutEl
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('active', b.dataset.layout === state.bbLayout));
  }
  if (bbChipsEl) {
    const under = state.buybacks.filter(bbUnderStore).length;
    const underChip =
      under || state.bbUnder
        ? `<button type="button" class="chip trait" data-bb-under aria-pressed="${state.bbUnder}" title="Buy-backs that cost less than the ship in today's store (load details for exact prices)">Below Store Price<span class="n">${under}</span></button>`
        : '';
    setHTMLKeepFocus(
      bbChipsEl,
      `<div class="chip-row">${presentBbKinds().map(bbChipHtml).join('')}${underChip}<span class="sw-group">${switchHtml('bb-hide', 'Hide Small Stuff', state.bbHideSmall, 'Paints, add-ons and coupons')}${switchHtml('bb-stack', 'Stack Identical', state.bbStack, 'Show identical buy-backs as one row with a count')}</span></div>` +
        traitRowHtml(
          state.buybacks,
          state.bbTraits,
          buybackFacets,
          state.bbShown.size || state.bbTraits.size || state.bbUnder,
          // Warbond only mattered for the price paid; reclaiming costs the same (#176).
          ['warbond'],
        ),
    );
  }
  if (!state.priceOf) ensurePrices();
  let list = computeBuybacks();
  renderBbSummary();
  if (state.bbStack) list = stackBuybacks(list);
  const when = state.buybacksScannedAt ? new Date(state.buybacksScannedAt).toLocaleString() : '';
  if (!list.length) {
    setHTML(
      body,
      '<div class="empty">No buy-backs match those filters. Loosen them up, pilot.</div>',
    );
    return;
  }
  // Opened from a Hangar Alert: say so, with a way back to everything.
  const only = state.bbOnly
    ? `<div class="bb-only">Showing the ${list.length} ${OH.escapeHtml(state.bbOnly.label)} <button type="button" class="btn-secondary" data-bb-all>Show All ${state.buybacks.length}</button></div>`
    : '';
  const count =
    only +
    bbDetailsBarHtml(list) +
    `<div class="result-count">Showing ${list.length} of ${state.buybacks.length}${when ? ` · scanned ${OH.escapeHtml(when)}` : ''}</div>`;
  // Market = a table like the Inventory Market (pick, total, price, export);
  // the other layouts reuse the shared card grid like the inventory.
  if (state.bbLayout === 'market') {
    setHTML(
      body,
      only + bbDetailsBarHtml(list) + bbToolbarHtml(list, when) + buybackMarketHtml(list),
    );
    return; // table has no thumbnails to enhance
  }
  renderCardGrid(body, count, state.bbLayout, list, buybackCardHtml);
}

// Buy-back "Market": one reclaim table per kind (Ships, CCUs, Paints, …), with
// the columns a buy-back has — name, reclaim cost, quantity, and a reclaim link.
// Identical copies are stacked into one row with a Qty count, mirroring the
// inventory Market's per-category stacked tables.
// A buy-back's title as shown in lists: without the type label and Warbond /
// Standard Edition (OH.shortBuybackName, #176). The details window's title and
// exports keep RSI's full name; the card's tooltip shows it too.
function buybackName(b) {
  const s = OH.shortBuybackName;
  return b.ccu ? `${s(b.ccu.from)} → ${s(b.ccu.to)}` : s(b.name) || '—';
}
const bbFullName = (b) => (b.ccu ? `${b.ccu.from} → ${b.ccu.to}` : b.name || '');

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
function buybackReclaimLink(b) {
  // Retired ships (#306) can't be reclaimed: say so instead of a dead link.
  const retired = OH.retiredBuyback(b);
  if (retired) return `<span class="bb-retired" title="${OH.escapeHtml(retired)}">Retired</span>`;
  const direct = buybackUrl(b);
  const url = direct || buybackViewUrl(b);
  if (!url) return '';
  const tip = direct
    ? 'Open the buy-back page on RSI'
    : "Opens just this CCU in RSI's buy-back list, where its reclaim button is";
  return `<a class="bb-reclaim" href="${OH.escapeHtml(url)}" target="_blank" rel="noopener" title="${tip}">Reclaim ↗</a>`;
}
function bbDetail(b) {
  return state.bbDetails[b.id] || null;
}
function bbInsurance(b) {
  const d = bbDetail(b);
  return (
    insLabel((d && d.insurance) || b.insurance || window.OpenHangar.insuranceFromName(b.name)) ||
    (d ? 'None' : '—')
  );
}

// The buy-back's real price once its page has been read; else today's store
// price for the ship as an estimate.
function bbPrice(b) {
  const d = bbDetail(b);
  if (d && d.price != null) return d.price;
  return buybackStorePrice(b);
}
function bbPriceHtml(b) {
  const d = bbDetail(b);
  if (d && d.price != null)
    return `<span class="val" title="Buy-back price on RSI">${money(d.price)}</span>`;
  if (b.price) return `<span class="val">${OH.escapeHtml(b.price)}</span>`;
  const sp = buybackStorePrice(b);
  return sp
    ? `<span class="val est" title="An estimate from today's store price. Load details for RSI's exact buy-back price.">${dollars(sp)}<small class="est-l">est.</small></span>`
    : '';
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

function buybackRowHtml(b) {
  const name = b.ccu
    ? `${OH.escapeHtml(OH.shortBuybackName(b.ccu.from))} <span class="ccu-flow">→</span> ${OH.escapeHtml(OH.shortBuybackName(b.ccu.to))}`
    : OH.escapeHtml(buybackName(b));
  const key = bbKey(b);
  const saved = state.market[key];
  const price = bbPrice(b);
  const base = price ? price * fx.rate : '';
  const mine = saved && saved.price != null ? OH.escapeHtml(String(saved.price)) : '';
  const pct = OH.escapeHtml(pctOfMelt(saved && saved.price, base));
  const picked = state.bbPicked.has(String(b.id));
  const vs = bbVsStore(b);
  return `<tr class="mk-row${picked ? ' picked' : ''}" data-id="${OH.escapeHtml(String(b.id || ''))}" data-key="${OH.escapeHtml(key)}" data-melt="${base}">
    <td class="mk-sel"><input type="checkbox" class="mk-pick" ${picked ? 'checked' : ''} aria-label="Pick for total and export"></td>
    <td class="mk-name"><button type="button" class="bb-open" title="See what's in it">${name}</button></td>
    <td class="mk-ins">${OH.escapeHtml(bbInsurance(b))}</td>
    <td class="mk-melt">${bbPriceHtml(b) || '—'}</td>
    <td class="mk-store">${OH.escapeHtml(bbStoreText(b)) || '<span class="muted">—</span>'}</td>
    <td class="mk-vs${vs != null && vs >= 1 ? ' gain' : ''}">${OH.escapeHtml(bbVsStoreText(b)) || '<span class="muted">—</span>'}</td>
    <td class="mk-pct"><input class="mk-pct-in" type="text" inputmode="decimal" value="${pct}" placeholder="%" aria-label="Percent of buy-back price"></td>
    <td class="mk-mine"><input class="mk-price" type="text" inputmode="decimal" value="${mine}" placeholder="$" aria-label="My price"></td>
    <td class="mk-view">${buybackReclaimLink(b) || '—'}</td>
  </tr>`;
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

function buybackMarketHtml(list) {
  const sections = bbMarketSections(list).map(({ section, groups }) => {
    const all = groups.every((b) => state.bbPicked.has(String(b.id)));
    return `<section class="market-section">
      <h3 class="market-title">${OH.escapeHtml(section.label)}<span class="market-n">${groups.length}</span></h3>
      <table class="market-table">
        <thead><tr>
          <th class="mk-sel"><input type="checkbox" class="mk-pick-all" aria-label="Pick all in ${OH.escapeHtml(section.label)}" ${all ? 'checked' : ''}></th>
          <th>Items Name</th><th>Insurance</th><th title="RSI's buy-back price once Load details has read it; before that, today's store price">Buy-Back Price</th>
          <th title="Today's store price of every ship inside (packs need Load details), or a CCU's price gap">Store Price</th><th title="Store price minus the buy-back price (needs Load details)">vs Store</th>
          <th title="Your price as a percent of the buy-back price">% of Price</th><th>My Price</th><th>Reclaim</th>
        </tr></thead>
        <tbody>${groups.map(buybackRowHtml).join('')}</tbody>
      </table>
    </section>`;
  });
  return `<div class="market">${sections.join('')}</div>`;
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
function updateBbSelText() {
  const el = buybacksBodyEl && buybacksBodyEl.querySelector('.mk-selcount');
  if (el) el.textContent = bbSelText();
}

function bbToolbarHtml(list, when) {
  return `<div class="market-toolbar">
    <div class="result-count">Showing ${list.length} of ${state.buybacks.length}${
      when ? ` · scanned ${OH.escapeHtml(when)}` : ''
    }<span class="mk-selcount">${OH.escapeHtml(bbSelText())}</span></div>
    <div class="market-actions">
      <button class="mk-btn bb-export-csv" type="button">Export CSV</button>
      <button class="mk-btn bb-export-img" type="button">Download Image</button>
      <span class="mk-export-status" aria-live="polite"></span>
    </div>
  </div>`;
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
function bbName(b) {
  return b.ccu ? `${b.ccu.from} → ${b.ccu.to}` : b.name || '';
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
        bbName(b),
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
    name: bbName(b),
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

chipsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  if (btn.dataset.clear) {
    state.shown.clear();
    state.traits.clear();
  } else if (btn.dataset.trait) {
    cycleTrait(state.traits, btn.dataset.trait);
  } else {
    const key = btn.dataset.key;
    if (state.shown.has(key)) state.shown.delete(key);
    else state.shown.add(key);
  }
  renderInventory();
});

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
searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  renderInventorySoon();
});

sortEl.addEventListener('change', () => {
  state.sort = sortEl.value;
  renderInventory();
});

if (bbSearchEl) {
  const renderBuybacksSoon = debounce(() => renderBuybacks());
  bbSearchEl.addEventListener('input', () => {
    state.bbQuery = bbSearchEl.value;
    renderBuybacksSoon();
  });
}
if (bbSortEl) {
  bbSortEl.addEventListener('change', () => {
    state.bbSort = bbSortEl.value;
    renderBuybacks();
  });
}
if (bbChipsEl) {
  bbChipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn || 'bbUnder' in btn.dataset) return; // Below store price: handled below
    if (btn.dataset.clear) {
      state.bbShown.clear();
      state.bbTraits.clear();
      state.bbUnder = false;
    } else if (btn.dataset.trait) {
      cycleTrait(state.bbTraits, btn.dataset.trait);
    } else {
      const key = btn.dataset.key;
      if (state.bbShown.has(key)) state.bbShown.delete(key);
      else state.bbShown.add(key);
    }
    renderBuybacks();
  });
}
if (bbLayoutEl) {
  bbLayoutEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-layout]');
    if (!b) return;
    state.bbLayout = b.dataset.layout;
    chrome.storage.local.set({ bbLayout: state.bbLayout });
    renderBuybacks();
  });
}

layoutEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-layout]');
  if (!b) return;
  state.layout = b.dataset.layout;
  chrome.storage.local.set({ uiLayout: state.layout });
  renderInventory();
});

// Broken thumbnails → placeholder (error events don't bubble; capture phase).
// A thumbnail failed to load (RSI sometimes serves broken image links): show
// the placeholder, then try the ship-art lookup once by the card's ship name.
function onThumbError(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.classList.contains('thumb')) return;
  // The browser picked the bigger size and it failed: drop to the plain src.
  if (img.hasAttribute('srcset')) {
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    return;
  }
  // RSI's image server sometimes drops a request: try the same picture once
  // more before giving up on it (a refresh used to be the only retry).
  if (!img.dataset.retried && /^https?:/.test(img.src)) {
    img.dataset.retried = '1';
    const src = img.src;
    setTimeout(() => {
      if (img.isConnected) img.src = src + (src.includes('?') ? '&' : '?') + 'retry=1';
    }, 1500);
    return;
  }
  const card = img.closest('.card');
  const ph = document.createElement('div');
  ph.className = 'thumb placeholder';
  ph.textContent = img.dataset.kind || '';
  img.replaceWith(ph);
  if (!card || !card.dataset.resolve || card.dataset.fallback) return;
  card.dataset.fallback = '1'; // one retry only, never a loop
  OH.getShipImage(card.dataset.resolve).then((url) => {
    if (!url || !ph.isConnected) return;
    const fresh = document.createElement('img');
    fresh.className = 'thumb';
    fresh.loading = 'lazy';
    fresh.alt = '';
    setThumbSizes(fresh, url, card.closest('.grid'));
    fresh.src = url;
    ph.replaceWith(fresh);
    card.dataset.image = url;
    const id = card.dataset.id;
    const item =
      state.items.find((x) => String(x.id) === id) ||
      state.buybacks.find((x) => String(x.id) === id);
    if (item) item.image = url; // hover preview + details use it too
  });
}
resultsEl.addEventListener('error', onThumbError, true);

// Market sale-sheet: persist My Price as it's typed. We update state + storage
// WITHOUT re-rendering so the field keeps focus; the price is keyed by item
// (data-key) so it sticks to that item across re-scans.
// My Price and % of Melt are two views of one number: typing either fills in
// the other (price is what's stored).
function onMarketPriceInput(e) {
  const el = e.target;
  if (!el.classList) return;
  const isPrice = el.classList.contains('mk-price');
  const isPct = el.classList.contains('mk-pct-in');
  if (!isPrice && !isPct) return;
  const row = el.closest('.mk-row');
  if (!row) return;
  const melt = Number(row.dataset.melt);
  if (isPrice) {
    setMarketPrice(row.dataset.key, el.value.trim());
    row.querySelector('.mk-pct-in').value = pctOfMelt(el.value.trim(), melt);
  } else {
    const price = priceAtPct(el.value.trim(), melt);
    setMarketPrice(row.dataset.key, price);
    row.querySelector('.mk-price').value = price;
  }
  // Pricing a row means you're selling it: tick it (never auto-untick).
  const box = row.querySelector('.mk-pick');
  if (el.value.trim() && box && !box.checked) {
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
resultsEl.addEventListener('input', onMarketPriceInput);
if (buybacksBodyEl) buybacksBodyEl.addEventListener('input', onMarketPriceInput);

// Market toolbar: "Giftable only" filter re-renders; CSV / image export the view.
resultsEl.addEventListener('change', (e) => {
  if (!e.target.classList || !e.target.classList.contains('inv-group')) return;
  state.groupByType = e.target.checked;
  chrome.storage.local.set({ uiGroupByType: state.groupByType });
  renderInventory();
});
resultsEl.addEventListener('change', (e) => {
  if (!e.target.classList || !e.target.classList.contains('mk-giftable-only')) return;
  state.marketGiftableOnly = e.target.checked;
  renderInventory();
});
resultsEl.addEventListener('click', (e) => {
  const status = resultsEl.querySelector('.mk-export-status');
  if (e.target.closest('.mk-export-csv')) exportMarketCsv(status);
  else if (e.target.closest('.mk-export-img')) copyMarketImage(status);
});
if (buybacksBodyEl) buybacksBodyEl.addEventListener('error', onThumbError, true);

// --- Inventory: hover preview + click detail modal ------------------------
const itemPreview = $('#item-preview');
const itemPreviewImg = itemPreview ? itemPreview.querySelector('img') : null;
const itemModal = $('#item-modal');
const modalBody = $('#modal-body');
const modalClose = $('#modal-close');
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

// Cards: no hover popup (the card already shows the art). Resting on a card
// quietly starts its full-res download so the detail modal opens sharp.
let hoverCardId = null;
let hoverTimer = null;
function onCardHover(e) {
  const card = e.target.closest('.card');
  const id = card && card.dataset.image ? card.dataset.id : null;
  if (id === hoverCardId) return;
  hoverCardId = id;
  clearTimeout(hoverTimer);
  if (id) hoverTimer = setTimeout(() => loadHiRes(card.dataset.image), 120);
}
resultsEl.addEventListener('mousemove', onCardHover);
if (buybacksBodyEl) buybacksBodyEl.addEventListener('mousemove', onCardHover);

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
// The ladder dots' pictures: each tier's wiki image, looked up in one batch.
async function enhanceLadderDots(container) {
  const dots = [...container.querySelectorAll('.rt-step[data-file]')];
  if (!dots.length) return;
  const urls = await OH.wikiImageUrls(dots.map((d) => d.dataset.file));
  for (const d of dots) if (urls[d.dataset.file]) d.dataset.image = urls[d.dataset.file];
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

// The detail window's picture: RSI's art, except a CCU shows the ship it
// upgrades to; with no RSI art, look the ship up by name. Starts as the
// placeholder and swaps in whichever picture turns up.
function fillModalArt(real, resolve, preferShip) {
  const show = (url) => {
    const slot = modalBody.querySelector('.modal-img');
    if (!url || !slot) return;
    const name = modalBody.querySelector('.modal-name')?.textContent.trim() || '';
    // The picture is a button: click (or Enter) opens it full size (#299).
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-img-btn';
    btn.title = 'View Full Size';
    btn.setAttribute('aria-label', name ? `View Full Size: ${name}` : 'View Full Size');
    const im = document.createElement('img');
    im.className = 'modal-img';
    im.alt = name;
    const hint = document.createElement('span');
    hint.className = 'modal-img-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Full Size';
    btn.append(im, hint);
    btn.addEventListener('click', () => openLightbox(im.currentSrc || im.src, url, name, btn));
    slot.replaceWith(btn);
    progressiveImage(im, url);
  };
  if (!resolve || (real && !preferShip)) return show(real);
  const opened = modalBody.firstElementChild;
  OH.getShipImage(resolve).then((art) => {
    if (modalBody.firstElementChild === opened) show(art || real);
  });
}

function openItemModal(p) {
  hidePreview();
  const real = realImage(p.image);
  // The picture is filled in by fillModalArt() below.
  const img = `<div class="modal-img placeholder">${OH.escapeHtml(p.kind)}</div>`;
  const type = pledgeType(p);
  const badgeClass = TYPE_KEYS.includes(type) ? type : '';
  const contents = p.contents || [];
  const contentsHtml = contents.length
    ? `<table class="modal-contents"><tbody>${contents
        .map(
          (c) =>
            `<tr><td>${OH.escapeHtml(contentKind(c))}</td><td>${
              /^ship$/i.test(c.kind || '') && c.label
                ? shipLink(c.label)
                : OH.escapeHtml(c.label || '')
            }</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="muted">No itemized contents.</p>';
  const row = (k, v) =>
    `<div class="mr"><span class="mr-k">${k}</span><span class="mr-v">${v}</span></div>`;
  setHTML(
    modalBody,
    img +
      `<div class="modal-info">
      <h3 class="modal-name">${OH.escapeHtml(plainName(p))}</h3>
      <div class="modal-meta"><span class="badge ${badgeClass}">${OH.escapeHtml(type)}</span><span class="modal-val">${OH.escapeHtml(formatValue(p))}</span></div>
      ${row('ID', OH.escapeHtml(p.id || '—'))}
      ${p.date ? row('Pledged', OH.escapeHtml(p.date)) : ''}
      ${row('Giftable', p.giftable ? 'Yes' : 'No')}
      ${p.meltable === undefined ? '' : row('Meltable', p.meltable ? 'Yes' : 'No')}
      ${storeRow(p, row)}
      ${p.currency ? row('Currency', OH.escapeHtml(p.currency)) : ''}
      ${p.isCCU && p.ccu ? row('Upgrade', OH.escapeHtml(`${p.ccu.from} → ${p.ccu.to}`)) : ''}
      ${hangarSpot(p) ? row('On RSI', viewOnRsiLink(p)) : ''}
      ${row('Scanned', OH.escapeHtml(fmtScan()))}
      <h4 class="modal-h">Contents (${contents.length})</h4>
      ${contentsHtml}
    </div>`,
  );
  showItemModal();
  fillModalArt(real, resolveImageName(p), p.isCCU && !p.shipArt);
}
// The detail pop-up is a dialog: focus moves to its Close button when it opens, Tab
// stays inside it, Escape closes it, and focus goes back to whatever opened it.
let modalOpener = null;
function showItemModal() {
  if (itemModal.hidden) modalOpener = document.activeElement;
  itemModal.hidden = false;
  const name = modalBody.querySelector('.modal-name');
  modalClose
    .closest('.modal-card')
    ?.setAttribute('aria-label', name?.textContent.trim() || 'Details');
  modalClose.focus({ preventScroll: true });
}
function closeItemModal() {
  closeLightbox();
  itemModal.hidden = true;
  setHTML(modalBody, '');
  let back = modalOpener;
  modalOpener = null;
  // A list redrawn while the pop-up was open replaced the card: find its twin.
  if (back && !back.isConnected && back.classList?.contains('card') && back.dataset.id) {
    const id = back.dataset.id;
    back = [...document.querySelectorAll('.card[data-id]')].find((c) => c.dataset.id === id);
  }
  if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
}

// Full-size picture viewer (#299), on top of the detail pop-up. Shows the sharp copy
// already on screen at once, then fetches RSI's original ("source", or the wiki's
// original) only now, one picture, because someone asked for it. Escape or the close
// button closes it and focus goes back to the picture that opened it.
const lightbox = $('#lightbox');
const lightboxImg = $('#lightbox-img');
const lightboxClose = $('#lightbox-close');
const lightboxStatus = $('#lightbox-status');
let lightboxOpener = null;
let lightboxFor = 0; // bumps on every open, so a slow load can't land on the next picture
function openLightbox(shown, thumb, name, opener) {
  if (!lightbox) return;
  const ticket = ++lightboxFor;
  lightboxOpener = opener || document.activeElement;
  lightboxImg.alt = name || 'Ship picture';
  lightboxImg.src = shown;
  lightbox.setAttribute('aria-label', name ? `${name}, Full Size` : 'Full Size Picture');
  const full = OH.fullSizeImage(thumb);
  lightboxStatus.hidden = !full;
  lightboxStatus.textContent = full ? 'Zooming in for the full-res shot…' : '';
  lightbox.hidden = false;
  lightboxClose.focus({ preventScroll: true });
  if (!full) return;
  loadImage(full).then((ok) => {
    if (ticket !== lightboxFor || lightbox.hidden) return;
    if (ok) lightboxImg.src = full;
    lightboxStatus.hidden = true;
  });
}
function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightboxFor++;
  lightbox.hidden = true;
  lightboxImg.removeAttribute('src');
  const back = lightboxOpener;
  lightboxOpener = null;
  if (back && back.isConnected) back.focus({ preventScroll: true });
}
if (lightbox) {
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target === lightboxImg) closeLightbox();
  });
  // Capture phase, so the detail pop-up under it doesn't also close on Escape.
  document.addEventListener(
    'keydown',
    (e) => {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeLightbox();
      } else if (e.key === 'Tab') {
        e.preventDefault(); // the close button is the only stop
        e.stopImmediatePropagation();
        lightboxClose.focus({ preventScroll: true });
      }
    },
    true,
  );
}

// Buy-back detail modal (reuses the inventory modal shell).
function openBuybackModal(b) {
  hidePreview();
  const real = realImage(b.image);
  const img = `<div class="modal-img placeholder">Buy-Back</div>`; // see fillModalArt
  const url = buybackReclaimLink(b);
  const row = (k, v) =>
    `<div class="mr"><span class="mr-k">${k}</span><span class="mr-v">${v}</span></div>`;
  const d = bbDetail(b);
  const contents = d
    ? `${
        d.ships.length
          ? `<h4 class="modal-h">Ships (${d.ships.length})</h4><table class="modal-contents"><tbody>${d.ships
              .map(
                (x) =>
                  `<tr><td>${OH.escapeHtml(x.name)}</td><td class="muted">${OH.escapeHtml(
                    [x.manufacturer, x.focus].filter(Boolean).join(' · '),
                  )}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''
      }${
        d.also.length
          ? `<h4 class="modal-h">Also Contains</h4><table class="modal-contents"><tbody>${d.also
              .map((x) => `<tr><td>${OH.escapeHtml(x)}</td></tr>`)
              .join('')}</tbody></table>`
          : ''
      }`
    : b.isCCU || !/^\d+$/.test(String(b.id))
      ? ''
      : '<p class="muted" id="bbd-modal-loading">Loading what’s in it from RSI…</p>';
  setHTML(
    modalBody,
    img +
      `<div class="modal-info">
      <h3 class="modal-name">${b.ccu ? `${OH.escapeHtml(b.ccu.from)} → ${OH.escapeHtml(b.ccu.to)}` : OH.escapeHtml(b.name || '—')}</h3>
      <div class="modal-meta"><span class="badge ${b.isCCU ? 'ccu' : TYPE_KEYS.includes(b.kind) ? b.kind : ''}">${OH.escapeHtml(b.isCCU ? 'CCU' : b.kind || 'buy-back')}</span><span class="badge muted">buy-back</span>${bbPriceHtml(b) ? `<span class="modal-val">${bbPriceHtml(b)}</span>` : ''}</div>
      ${b.ccu ? row('Upgrade', OH.escapeHtml(`${b.ccu.from} → ${b.ccu.to}`)) : ''}
      ${b.isCCU ? '' : row('Insurance', OH.escapeHtml(bbInsurance(b)))}
      ${b.date ? row('Melted', OH.escapeHtml(b.date)) : ''}
      ${b.id ? row('Pledge ID', OH.escapeHtml(b.id)) : ''}
      ${url ? row('Reclaim', url) : ''}
      ${contents}
    </div>`,
  );
  showItemModal();
  const shipish = b.ccu || ['ship', 'pack', 'package'].includes(b.kind);
  fillModalArt(real, b.ccu && b.ccu.to ? b.ccu.to : shipish ? b.name : '', !!b.ccu && !b.shipArt);
  if (!d && !b.isCCU && /^\d+$/.test(String(b.id))) {
    OH.fetchBuybackDetail(String(b.id)).then(async (r) => {
      if (itemModal.hidden) return;
      if (r.error) {
        const el = $('#bbd-modal-loading');
        if (el) el.textContent = `Couldn't load the contents: ${r.error}`;
        return;
      }
      state.bbDetails = { ...(await OH.getBuybackDetails()) };
      openBuybackModal(b); // re-draw with the contents
      if (currentView() === 'buybacks') renderBuybacks();
    });
  }
}
resultsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  if (state.selecting) {
    toggleSelected([card.dataset.id]);
    card.classList.toggle('selected', state.selected.has(card.dataset.id));
    return;
  }
  const p = state.items.find((it) => String(it.id) === card.dataset.id);
  if (p) openItemModal(p);
});
resultsEl.addEventListener('change', (e) => {
  const box = e.target.closest('.mk-pick, .mk-pick-all');
  if (!box) return;
  const groups = computeMarketSections(marketShown()).flatMap((x) => x.groups);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const rows = box.classList.contains('mk-pick-all')
    ? [...box.closest('table').querySelectorAll('tbody .mk-row')]
    : [box.closest('.mk-row')];
  for (const row of rows) {
    const g = byKey.get(row.dataset.key);
    if (!g) continue;
    for (const id of g.ids) box.checked ? state.selected.add(id) : state.selected.delete(id);
    row.classList.toggle('picked', box.checked);
    const cb = row.querySelector('.mk-pick');
    if (cb) cb.checked = box.checked;
  }
  const table = box.closest('table');
  const all = table && table.querySelector('.mk-pick-all');
  if (all) all.checked = [...table.querySelectorAll('tbody .mk-pick')].every((c) => c.checked);
  updateSelectBar();
});
if (buybacksBodyEl) {
  buybacksBodyEl.addEventListener('change', (e) => {
    const box = e.target.closest('.mk-pick, .mk-pick-all');
    if (!box) return;
    const rows = box.classList.contains('mk-pick-all')
      ? [...box.closest('table').querySelectorAll('tbody .mk-row')]
      : [box.closest('.mk-row')];
    for (const row of rows) {
      if (box.checked) state.bbPicked.add(row.dataset.id);
      else state.bbPicked.delete(row.dataset.id);
      row.classList.toggle('picked', box.checked);
      const cb = row.querySelector('.mk-pick');
      if (cb) cb.checked = box.checked;
    }
    const table = box.closest('table');
    const all = table && table.querySelector('.mk-pick-all');
    if (all) all.checked = [...table.querySelectorAll('tbody .mk-pick')].every((c) => c.checked);
    updateBbSelText();
  });
  buybacksBodyEl.addEventListener('click', (e) => {
    const status = buybacksBodyEl.querySelector('.mk-export-status');
    if (e.target.closest('.bb-export-csv')) return void exportBuybackCsv(status);
    if (e.target.closest('.bb-export-img')) return void copyBuybackImage(status);
    if (e.target.closest('#bbd-load')) return void loadBuybackDetails();
    if (e.target.closest('#bbd-stop')) {
      if (bbLoading) bbLoading.stop = true;
      return;
    }
    const open = e.target.closest('.bb-open');
    if (open) {
      const id = open.closest('.mk-row')?.dataset.id;
      const bb = state.buybacks.find((it) => String(it.id) === id);
      if (bb) openBuybackModal(bb);
      return;
    }
    if (e.target.closest('a')) return; // let links (Reclaim) work normally
    const card = e.target.closest('.card');
    if (!card) return;
    const b = state.buybacks.find((it) => String(it.id) === card.dataset.id);
    if (b) openBuybackModal(b);
  });
}
modalClose.addEventListener('click', closeItemModal);
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) closeItemModal();
});
document.addEventListener('keydown', (e) => {
  if (itemModal.hidden) return;
  if (e.key === 'Escape') return void closeItemModal();
  if (e.key !== 'Tab') return;
  const stops = [
    ...itemModal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]',
    ),
  ].filter((el) => el.getClientRects().length);
  if (!stops.length) return;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const at = document.activeElement;
  if (!itemModal.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === last)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
});

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
if (referralsBodyEl) {
  referralsBodyEl.addEventListener('mousemove', onRewardHover);
  referralsBodyEl.addEventListener('mouseleave', hidePreview);
  // Tab switch (Recruits / Prospects): reset the search, re-render the list only.
  referralsBodyEl.addEventListener('click', (e) => {
    if (e.target.closest('#ref-share')) return void shareReferralImage();
    const btn = e.target.closest('[data-reftab]');
    if (!btn) return;
    if (state.refTab === btn.dataset.reftab) return;
    state.refTab = btn.dataset.reftab;
    state.refQuery = '';
    const search = $('#ref-search');
    if (search) search.value = '';
    renderRefList();
  });
  // Search box: filter the list live (lightweight re-render keeps focus).
  referralsBodyEl.addEventListener('input', (e) => {
    if (e.target.id !== 'ref-search') return;
    state.refQuery = e.target.value;
    renderRefList();
  });
  // Sort dropdown.
  referralsBodyEl.addEventListener('change', (e) => {
    if (e.target.id !== 'ref-sort') return;
    state.refSort = e.target.value;
    renderRefList();
  });
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
  if (t.closest('[data-bb-under]')) {
    state.bbUnder = !state.bbUnder;
    return renderBuybacks();
  }
  const apply = t.closest('[data-view-apply]');
  if (apply) {
    const v = state.savedViews[+apply.dataset.viewApply];
    if (!v) return;
    state.shown = new Set(v.f.shown);
    state.traits = new Map(v.f.traits);
    state.query = v.f.query || '';
    state.hideSmall = !!v.f.hideSmall;
    const q = $('#search');
    if (q) q.value = state.query;
    return renderInventory();
  }
  const del = t.closest('[data-view-del]');
  if (del) {
    state.savedViews.splice(+del.dataset.viewDel, 1);
    saveViews();
    return renderSavedViews();
  }
  if (t.closest('[data-view-save]')) {
    const name = (prompt('Name this view (for example "Giftable ships")') || '').trim();
    if (!name) return;
    state.savedViews.push({ name: name.slice(0, 40), f: currentView_inv() });
    saveViews();
    return renderSavedViews();
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

// Copy referral link/code button (Referrals page). Uses the clipboard API with
// a brief "Copied" confirmation; falls back silently if clipboard is unavailable.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.ref-copy');
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy || '');
    const prev = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1500);
  } catch {
    /* clipboard blocked — no-op */
  }
});

// Scan a chosen set of sources. Each is independent and persisted on its own, so
// a partial scan (e.g. just referrals) refreshes only those and leaves the rest
// of your data untouched; a failure in one still keeps the others' results.
async function runScan({ hangar = true, buybacks = true, referrals = true, store = true } = {}) {
  if (!hangar && !buybacks && !referrals && !store) return;
  scanBtn.disabled = true;
  if ($('#welcome-scan')) $('#welcome-scan').disabled = true;
  if (scanSelectedBtn) scanSelectedBtn.disabled = true;
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
      }
      if (account?.loggedIn && account.nickname) {
        state.owner = { nickname: account.nickname, displayname: account.displayname || null };
      }
      parts.push(
        h.unchanged
          ? `${h.items.length} pledges (hangar's exactly how you left it)`
          : `${h.items.length} pledges${h.partial ? ` (partial: ${h.partial})` : ''}`,
      );
      if (h.partial) anyErr = true;
    } else {
      parts.push(`hangar: ${h.error}`);
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
      state.bbShown = new Set(); // default: no filter selected = show all
      state.bbTraits = new Map();
      parts.push(`${b.items.length} buy-backs${b.partial ? ` (partial: ${b.partial})` : ''}`);
      if (b.partial) anyErr = true;
    } else {
      parts.push(`buy-backs: ${b.error}`);
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
      parts.push(
        `${r.referral.legacy?.recruits ?? 0} recruits${r.partial ? ` (kept last scan's ${r.partial}: RSI didn't answer)` : ''}`,
      );
      if (r.partial) anyErr = true;
    } else if (r) {
      parts.push(`referrals: ${r.error}`);
      anyErr = true;
    }
  }

  // Store: re-check RSI's store for your wishlist ships (skips the 6-hour cache).
  if (store && state.wishlist.length) {
    if (referrals) scanProgress.i++;
    setScanning('store');
    scanDetail('Store · checking your wishlist');
    const list = await wishlistStock({ force: true });
    const n = list.filter((x) => x.st && x.st.state === 'in').length;
    parts.push(`${n} wishlist ship${n === 1 ? '' : 's'} on sale`);
  }

  const summary = parts.join(' · ') || 'Nothing scanned';
  // The counts are already on Home (the summary boxes), so only a problem is
  // spelled out here; the header badge carries the full recap on hover.
  scanDetail('');
  setStatus(anyErr ? summary : '', anyErr, { scan: true });
  setScanning(`${anyErr ? '⚠ ' : '✓ '}${summary}`, true);
  route();
  renderAccount(); // refresh the Citizen Card pill with the new referral counts
  renderSiteNotice();
  if (hangar) warmPictures(computeShown(), state.layout);
  if (buybacks) warmPictures(computeBuybacks(), state.bbLayout);
  scanBtn.disabled = false;
  if ($('#welcome-scan')) $('#welcome-scan').disabled = false;
  if (scanSelectedBtn) scanSelectedBtn.disabled = false;
}

// The top bar's Scan runs what's ticked in its ▾ menu: "Scan All" by default,
// "Scan Custom" once anything is unticked (owner, 2026-09-30). Remembered.
const SCAN_SOURCES = ['hangar', 'buybacks', 'referrals', 'store'];
const scanBoxes = () => [...document.querySelectorAll('.scan-src')];
function scanChoice() {
  const on = new Set(
    scanBoxes()
      .filter((el) => el.checked)
      .map((el) => el.value),
  );
  return Object.fromEntries(SCAN_SOURCES.map((k) => [k, on.has(k)]));
}
function updateScanLabel() {
  const boxes = scanBoxes();
  const on = boxes.filter((el) => el.checked);
  const all = on.length === boxes.length;
  if (scanBtn.classList.contains('scanning')) return; // the progress owns the label
  scanBtn.querySelector('.scan-label').textContent = all ? 'Scan All' : 'Scan Custom';
  const what = all
    ? 'Scan everything: inventory, buy-backs, referrals and your wishlist in the store'
    : on.length
      ? `Scan ${on.map((el) => el.dataset.name).join(', ')} (change with ▾)`
      : 'Nothing ticked: pick what to scan with ▾';
  scanBtn.title = state.scannedAt
    ? `${what}\nLast scan: ${new Date(state.scannedAt).toLocaleString()}`
    : what;
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
scanBtn.addEventListener('click', scanChosen);
for (const el of scanBoxes()) {
  el.addEventListener('change', () => {
    updateScanLabel();
    chrome.storage.local.set({
      scanSources: scanBoxes()
        .filter((b) => b.checked)
        .map((b) => b.value),
    });
  });
}
// "Select All" in the menu ticks everything again.
document.querySelector('[data-scan-all]')?.addEventListener('click', () => {
  for (const el of scanBoxes()) el.checked = true;
  scanBoxes()[0]?.dispatchEvent(new Event('change'));
});
chrome.storage.local.get('scanSources').then(({ scanSources }) => {
  if (Array.isArray(scanSources)) {
    for (const el of scanBoxes()) el.checked = scanSources.includes(el.value);
  }
  updateScanLabel();
});

// Open below the ▾ button, right edges lined up; above it if there's no room.
// Citizen Card pop-up menus (Scan options, Settings): pinned to the viewport
// under their button so the card's clipped edges can't cut them off.
const cardMenus = [
  [scanMenuBtn, scanMenu],
  [$('#bell-btn'), $('#bell-menu')],
  [$('#inv-exp-btn'), $('#inv-exp-menu')],
  [$('#bb-exp-btn'), $('#bb-exp-menu')],
  [$('#settings-btn'), $('#settings-menu')],
].filter(([b, m]) => b && m);
function placeMenu(btn, menu) {
  const b = btn.getBoundingClientRect();
  const h = menu.offsetHeight || 0;
  const below = b.bottom + 6 + h <= window.innerHeight - 8;
  menu.style.right = `${Math.max(8, window.innerWidth - b.right)}px`;
  menu.style.top = below ? `${b.bottom + 6}px` : `${Math.max(8, b.top - 6 - h)}px`;
}
function closeCardMenus() {
  for (const [btn, menu] of cardMenus) {
    if (menu.hidden) continue;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }
}

for (const [btn, menu] of cardMenus) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let the document handler immediately re-close it
    const open = menu.hidden;
    closeCardMenus();
    if (!open) return;
    placeMenu(btn, menu);
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    placeMenu(btn, menu); // again now that it has a size
    // Into the menu, on its first control you can see (no scrolling: that closes it).
    [...menu.querySelectorAll('a[href], button:not([disabled]), input, select')]
      .find((el) => el.getClientRects().length)
      ?.focus({ preventScroll: true });
  });
  // Clicks inside the menu (checkboxes, the currency picker) shouldn't close it.
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    // A link or action in the menu (Updates, Log Out of RSI…) closes it.
    if (e.target.closest('a, .menu-item')) closeCardMenus();
  });
}
if (cardMenus.length) {
  // Scrolling or resizing moves the buttons; just close the menus.
  window.addEventListener('resize', closeCardMenus);
  window.addEventListener('scroll', closeCardMenus, { passive: true });
  document.addEventListener('click', closeCardMenus);
  // Escape closes an open menu and puts focus back on its button.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = cardMenus.find(([, m]) => !m.hidden);
    if (!open) return;
    closeCardMenus();
    open[0].focus({ preventScroll: true });
  });
}

scanSelectedBtn?.addEventListener('click', scanChosen);

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
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
  logoutBtn.disabled = false;
});

clearBtn.addEventListener('click', async () => {
  if (
    !confirm(
      "Clear this account's scanned data from this browser? Other saved accounts are kept. You can re-scan at any time.",
    )
  )
    return;
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
  state.bbShown = new Set();
  state.bbTraits = new Map();
  state.referral = null;
  setStatus('Local data cleared. Clean hangar, fresh start.');
  renderAccount(); // clear the referral pill too
  refreshRecoveryUI(); // a full manual wipe also drops any recovery snapshot
  route();
});

// --- Developers: export / import -----------------------------------------
const exportBtn = $('#export-db');
const importBtn = $('#import-db');
const importFile = $('#import-file');
const restoreBtn = $('#restore-db');
const dataMsg = $('#data-msg');

function setDataMsg(text, isError = false) {
  if (!dataMsg) return;
  dataMsg.textContent = text;
  dataMsg.classList.toggle('error', isError);
  if (isError) OH.log('error', 'data', text);
}

// Developers → Error report: copy, clear, and a preview of exactly what's in it.
const reportPreview = $('#report-preview');
async function refreshReportPreview() {
  const pre = $('#report-text');
  if (pre && reportPreview && reportPreview.open) pre.textContent = await OH.errorReport();
}
if (reportPreview) {
  reportPreview.addEventListener('toggle', refreshReportPreview);
  $('#copy-report').addEventListener('click', async (e) => {
    await copyErrorReport(e.currentTarget);
    refreshReportPreview();
  });
  $('#clear-log').addEventListener('click', async () => {
    await OH.clearLog();
    $('#report-msg').textContent = 'Log cleared.';
    refreshReportPreview();
  });
}

// Show the "Restore previous hangar" button only when an auto-cleared snapshot
// exists (i.e. a different RSI account triggered a backup-and-clear).
async function refreshRecoveryUI() {
  if (!restoreBtn) return;
  const rec = await OH.getRecovery();
  restoreBtn.hidden = !rec;
}

if (restoreBtn) {
  restoreBtn.addEventListener('click', async () => {
    const db = await OH.recoverData();
    if (!db) {
      setDataMsg('Nothing to restore. That hangar’s already clean.', true);
      restoreBtn.hidden = true;
      return;
    }
    // Reload from the restored DB via the normal init path — guarantees state,
    // pills, and views all reflect the recovered data consistently.
    location.reload();
  });
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

if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    const data = await downloadBackup();
    setDataMsg(
      `Exported ${sourceItemCount(data.sources)} item(s) and ${data.history.length} history snapshot(s).`,
    );
  });
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-backup]')) return;
  await downloadBackup();
  if (currentView() === 'stats') renderStats();
});

// Hangar Transfer Format: ships only, one entry per ship — the file FleetYards
// (Hangar → Import) and other community tools read.
const exportHtfBtn = $('#export-htf');
if (exportHtfBtn) {
  exportHtfBtn.addEventListener('click', async () => {
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
        '. Import it at FleetYards → Hangar → Import.',
    );
  });
}

if (importBtn && importFile) {
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = ''; // allow re-importing the same file later
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
    state.owner = null; // imports aren't attributed to an account (see importDB)
    await OH.dismissDamaged(); // restored from a backup: the damage notice has done its job
    renderDbNotice();
    state.shown = new Set(); // default: no filter selected = show all
    state.traits = new Map();
    state.bbShown = new Set(); // default: no filter selected = show all
    state.bbTraits = new Map();
    renderAccount(); // reflect imported referral in the pill
    setDataMsg(
      `Imported ${sourceItemCount(res.db.sources)} item(s) — open Inventory / Buy-Backs / Stats to view.`,
    );
  });
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
  state.bbShown = new Set();
  state.bbTraits = new Map();
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

// Developers → Saved accounts: every account with data in this browser.
async function renderProfiles() {
  const box = $('#profiles');
  if (!box) return;
  const list = await OH.listProfiles();
  if (!list.length) {
    setHTML(
      box,
      '<p class="muted">No saved accounts yet. Scan and your hangar gets parked here.</p>',
    );
    return;
  }
  setHTML(
    box,
    list
      .map((p) => {
        const name = OH.escapeHtml(p.displayname || p.nickname);
        const when = p.scannedAt ? new Date(p.scannedAt).toLocaleDateString() : 'never scanned';
        const tail = p.active
          ? '<span class="badge good">signed in</span>'
          : `<button class="btn-secondary profile-remove" data-nick="${OH.escapeHtml(p.nickname)}">Remove</button>`;
        return `<div class="profile-row"><span class="profile-name">${name}</span><span class="muted">${p.pledges} pledges · ${when}</span>${tail}</div>`;
      })
      .join(''),
  );
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.profile-remove');
  if (!b) return;
  if (!confirm(`Remove the saved data for ${b.dataset.nick} from this browser?`)) return;
  await OH.deleteProfile(b.dataset.nick);
  renderProfiles();
});

// Returning to the tab (e.g. after logging in/out on RSI in another tab)
// re-checks the account so the UI reflects it without a manual reload. Debounced
// so rapid tab-switching doesn't refetch repeatedly.
let lastFocusCheck = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  if (scanBtn.disabled) return; // mid-scan: switching accounts now would race the scan's saves
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

// "2026-09-28" → "Sep 28, 2026"; anything else (e.g. "June 2026") as written.
const releaseDate = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : d;

// Split a release's bullets into New / Improved / Fixed by their CHANGELOG
// prefix ("New:", "Improved:", "Changed:", "Fixed:"). Untagged bullets count
// as Improved.
const RELEASE_TAG = /^(\*\*)?(new|improved|changed|fix(?:ed)?)\b\s*:?\s*/i;
const releaseKind = (t) => {
  const tag = (t.match(RELEASE_TAG)?.[2] || '').toLowerCase();
  return tag === 'new' ? 'new' : tag.startsWith('fix') ? 'fixed' : 'improved';
};
function releaseGroupsHtml(items) {
  const groups = [
    ['new', 'New'],
    ['improved', 'Improved'],
    ['fixed', 'Fixed'],
  ];
  return groups
    .map(([k, label]) => [k, label, items.filter((t) => releaseKind(t) === k)])
    .filter(([, , list]) => list.length)
    .map(
      ([k, label, list]) =>
        `<span class="release-group g-${k}">${label}</span><ul>${list
          .map((t) => `<li>${OH.inlineMarkdown(capFirst(t.replace(RELEASE_TAG, '$1')))}</li>`)
          .join('')}</ul>`,
    )
    .join('');
}

// Updates page: "Check for updates". Chrome and Edge can ask their store right
// now (a found update downloads, then the Reload bar appears); Firefox can't,
// so it asks the public AMO API (CORS-open, no permission needed) for the
// latest published version and compares.
const AMO_ADDON_API = 'https://addons.mozilla.org/api/v5/addons/addon/open-hangar/';
{
  const btn = $('#update-check-btn');
  const out = $('#update-check-status');
  const curEl = $('#update-cur');
  const cur = chrome.runtime.getManifest().version;
  if (curEl) curEl.textContent = cur;
  btn?.addEventListener('click', async () => {
    // Looked up by name so Firefox's linter doesn't flag it (see initUpdates).
    const check = chrome.runtime[['request', 'Update', 'Check'].join('')];
    if (typeof check !== 'function') {
      btn.disabled = true;
      out.textContent = 'Checking…';
      try {
        const res = await fetch(AMO_ADDON_API, {
          credentials: 'omit',
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        });
        const latest = res.ok ? (await res.json())?.current_version?.version : null;
        if (!latest) throw new Error('no version');
        chrome.storage.local.set({ lastUpdateCheck: Date.now() });
        out.textContent =
          OH.compareVersions(latest, cur) > 0
            ? `Open Hangar ${latest} is out. Firefox installs it on its own within a day, or get it now: about:addons, gear icon, Check for Updates.`
            : 'You’re on the latest version. Fly safe.';
      } catch {
        out.textContent =
          'Couldn’t reach Firefox Add-ons. Probably a 30k on their end, try again in a bit.';
      }
      btn.disabled = false;
      return;
    }
    btn.disabled = true;
    out.textContent = 'Checking…';
    try {
      const r = await check.call(chrome.runtime);
      const status = (r && r.status) || r;
      chrome.storage.local.set({ lastUpdateCheck: Date.now() });
      out.textContent =
        status === 'update_available'
          ? `Open Hangar ${(r && r.version) || ''} is downloading. A Reload bar appears at the top when it's ready.`
          : status === 'throttled'
            ? 'Checked a moment ago. Try again in a few minutes.'
            : 'You’re on the latest version. Fly safe.';
    } catch {
      out.textContent =
        "Couldn't check. Developer builds (loaded unpacked) don't update from the store.";
    }
    btn.disabled = false;
  });
}

// Known Issues (#175): open bugs from the public GitHub tracker, fetched only when
// this page opens and cached for an hour. No sign-in, nothing about the user sent.
const ISSUES_API =
  'https://api.github.com/repos/Draco-Foundry/open-hangar/issues?state=open&per_page=100';
const ISSUES_TTL = 60 * 60 * 1000;

async function loadKnownIssues() {
  const { knownIssues } = await chrome.storage.local.get('knownIssues');
  if (knownIssues && Date.now() - knownIssues.at < ISSUES_TTL) return knownIssues.list;
  const res = await fetch(ISSUES_API, {
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const list = OH.parseKnownIssues(await res.json());
  await chrome.storage.local.set({ knownIssues: { at: Date.now(), list } });
  return list;
}

async function renderKnownIssues() {
  const body = $('#issues-body');
  if (!body) return;
  setHTML(body, `<p class="muted">${OH.quip('loading')}</p>`);
  let list;
  try {
    list = await loadKnownIssues();
  } catch {
    setHTML(
      body,
      `<p class="muted">Couldn't reach GitHub's comm relay. See the list <a href="${REPO_URL}/issues?q=is%3Aopen+label%3Abug" target="_blank" rel="noopener">on GitHub</a>.</p>`,
    );
    return;
  }
  if (!list.length) {
    setHTML(body, '<p class="muted">No known bugs right now. Clear skies, Citizen.</p>');
    return;
  }
  const days = (t) => {
    const d = Math.floor((Date.now() - Date.parse(t)) / 86400000);
    return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  };
  setHTML(
    body,
    `<ul class="known-issues">${list
      .map(
        (i) => `<li>
          <a href="${OH.escapeHtml(i.url)}" target="_blank" rel="noopener">${OH.escapeHtml(i.title)}</a>
          <span class="muted">#${i.number} · opened ${days(i.createdAt)}${
            i.labels.includes('scan-broken') ? ' · <span class="ki-scan">Scan broken</span>' : ''
          }</span>
        </li>`,
      )
      .join('')}</ul>`,
  );
}

async function renderUpdates() {
  const body = $('#updates-body');
  const cur = chrome.runtime.getManifest().version;
  const { justUpdated } = await chrome.storage.local.get('justUpdated');
  const from = justUpdated && justUpdated.to === cur ? justUpdated.from : null;
  const list = await loadChangelog();
  if (!list.length) {
    setHTML(
      body,
      `<p class="muted">Release notes aren't bundled in this build. See them <a href="${REPO_URL}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">on GitHub</a>.</p>`,
    );
    return;
  }
  setHTML(
    body,
    list
      .map((r) => {
        const isCur = OH.compareVersions(r.version, cur) === 0;
        const isNew =
          from &&
          OH.compareVersions(r.version, from) > 0 &&
          OH.compareVersions(r.version, cur) <= 0;
        const tag = isCur
          ? `<span class="release-tag${isNew ? ' new' : ''}">${isNew ? 'New · ' : ''}Your version</span>`
          : isNew
            ? '<span class="release-tag new">New</span>'
            : '';
        return `<section class="release">
          <div class="release-head"><h3>${OH.escapeHtml(r.title)}</h3>${
            r.date ? `<span class="release-date">${OH.escapeHtml(releaseDate(r.date))}</span>` : ''
          }${tag}</div>
          ${r.intro.map((t) => `<p>${OH.inlineMarkdown(t)}</p>`).join('')}
          ${releaseGroupsHtml(r.items)}
        </section>`;
      })
      .join(''),
  );
}

function showUpdateBanner(version) {
  const cur = chrome.runtime.getManifest().version;
  const bar = $('#update-banner');
  if (!bar || !version || OH.compareVersions(version, cur) <= 0) return;
  $('#update-text').textContent = `Open Hangar ${version} has landed. Reload to start using it.`;
  // Shown in your menu (a dot on the portrait) rather than a banner across the page.
  $('#upd-dot').hidden = false;
  $('#menu-upd-text').textContent = `Update ready: ${version}`;
  $('#menu-upd').hidden = false;
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
  $('#menu-upd-reload')?.addEventListener('click', () => $('#update-reload').click());
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

// @sync-start: cut from store builds until sync launches (scripts/pack.mjs, #187)
// --- openhangar.space: connect + sync (optional) -----------------------------
let siteWait = null; // { stop, code } while waiting for the website to confirm
async function renderSiteLink() {
  const el = $('#site-link');
  if (!el) return;
  // Nothing until the website is live (owner, 2026-09-30: no teaser). Developers
  // switch it on by setting the `siteUrl` storage key (e.g. to http://localhost:4321).
  if (!(await OH.siteEnabled())) {
    setHTML(el, '');
    return;
  }
  const link = await OH.getSiteLink();
  if (siteWait) {
    setHTML(
      el,
      `<span>Waiting for you to confirm on openhangar.space · code <code>${OH.escapeHtml(siteWait.code)}</code></span><button type="button" class="btn-secondary" data-site="cancel">Cancel</button>`,
    );
    return;
  }
  if (!link) {
    setHTML(
      el,
      `<span class="muted">openhangar.space: not connected (optional)</span><button type="button" class="btn-secondary" data-site="connect" title="Sync your hangar to the website to see it on any device. Nothing is sent until you press Sync now.">Connect</button>`,
    );
    return;
  }
  const when = link.lastSync
    ? `synced ${new Date(link.lastSync).toLocaleString()}`
    : 'not synced yet';
  setHTML(
    el,
    `<span class="ok">✓ Connected</span><span class="muted">${OH.escapeHtml(link.name || 'openhangar.space')} · ${OH.escapeHtml(when)}</span><button type="button" data-site="sync">Sync Now</button><button type="button" class="btn-secondary" data-site="open">Open</button><button type="button" class="btn-secondary" data-site="disconnect">Disconnect</button>`,
  );
}
$('#site-link')?.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-site]')?.dataset.site;
  if (!act) return;
  try {
    if (act === 'connect') {
      const start = await OH.siteLinkStart();
      siteWait = { stop: false, code: start.user_code };
      renderSiteLink();
      chrome.tabs.create({
        url: `${start.verification_uri}?code=${encodeURIComponent(start.user_code)}`,
      });
      const token = await OH.siteLinkWait(start, () => siteWait && !siteWait.stop);
      siteWait = null;
      setStatus(
        token
          ? 'Connected to openhangar.space. Press Sync now to send your hangar.'
          : 'Not connected.',
      );
    } else if (act === 'cancel') {
      if (siteWait) siteWait.stop = true;
      siteWait = null;
    } else if (act === 'sync') {
      setStatus('Syncing to openhangar.space…');
      await OH.siteSync();
      setStatus('Synced to openhangar.space.');
    } else if (act === 'open') {
      chrome.tabs.create({ url: `${await OH.siteUrl()}/hangar` });
    } else if (act === 'disconnect') {
      if (
        !confirm(
          'Disconnect from openhangar.space? Your synced copy stays on the website until you delete it there.',
        )
      )
        return;
      await OH.siteDisconnect();
      setStatus('Disconnected from openhangar.space.');
    }
  } catch (err) {
    siteWait = null;
    setStatus(String(err?.message || err));
    OH.log('warn', 'site', String(err?.message || err));
  }
  renderSiteLink();
});
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
  const sel = $('#currency-select');
  if (sel) sel.title = currencyNote() || 'Show amounts in your currency (converted from USD)';
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
{
  const sel = $('#currency-select');
  if (sel) {
    sel.addEventListener('change', async () => {
      await chrome.storage.local.set({ currency: sel.value });
      applyCurrency(sel.value);
    });
  }
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
  });
}
// What a ship comes with for keeps ("G12* (currently Cyclone)" → clean text).
function includedOf(name) {
  const row = includedVessels && OH.loanersFor(name, includedVessels);
  return row ? row.loaners.map((t) => t.replace(/\*/g, '').trim()) : null;
}
const vesselLink = (t) => shipLink(t.replace(/\s*\(.*\)\s*$/, '').trim(), t);

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
const shipLink = (name, text = name) =>
  `<button type="button" class="ship-link" data-ship="${OH.escapeHtml(name)}">${OH.escapeHtml(text)}</button>`;

// Stats → Fleet: the loaners your not-yet-flyable ships give you.
function loanersSectionHtml() {
  ensureLoaners();
  if (!loanerMatrix) return '<p class="muted">Loading RSI\'s loaner list…</p>';
  const rows = [];
  for (const s of ownedShips()) {
    const row = loanersOf(s.label);
    if (row) rows.push({ ship: s.label, loaners: row.loaners });
  }
  if (!rows.length)
    return '<p class="muted">Every ship you own is flight ready, so no loaners for you. Loaners only come with ships you can&#39;t fly in the game yet.</p>';
  const all = [...new Set(rows.flatMap((r) => r.loaners))].sort((a, b) => a.localeCompare(b));
  return `<p>You can fly <strong>${all.length}</strong> loaner${all.length === 1 ? '' : 's'}: ${all
    .map((l) => shipLink(l))
    .join(', ')}.</p>
    <table class="org-table"><thead><tr><th>Your Ship</th><th>Loaners</th></tr></thead><tbody>${rows
      .sort((a, b) => a.ship.localeCompare(b.ship))
      .map(
        (r) =>
          `<tr><td>${shipLink(r.ship)}</td><td>${r.loaners.map((l) => shipLink(l)).join(', ')}</td></tr>`,
      )
      .join('')}</tbody></table>
    <p class="muted value-note">From RSI's <a href="https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114" target="_blank" rel="noopener">Loaner Ship Matrix</a>. Loaners are only given while a ship isn't flyable in the game yet (they go away once it's flight ready), need a game package on the account, and don't stack.</p>`;
}

// Stats → Fleet: snubs and rovers your ships come with permanently.
function includedSectionHtml() {
  ensureLoaners();
  if (!includedVessels) return '<p class="muted">Loading RSI&#39;s included-vessels list…</p>';
  const rows = [];
  for (const s of ownedShips()) {
    const inc = includedOf(s.label);
    if (inc) rows.push({ ship: s.label, inc });
  }
  if (!rows.length)
    return '<p class="muted">None of your ships come with a snub or ground vehicle tucked inside.</p>';
  return `<table class="org-table"><thead><tr><th>Your Ship</th><th>Comes With</th></tr></thead><tbody>${rows
    .sort((a, b) => a.ship.localeCompare(b.ship))
    .map((r) => `<tr><td>${shipLink(r.ship)}</td><td>${r.inc.map(vesselLink).join(', ')}</td></tr>`)
    .join('')}</tbody></table>
    <p class="muted value-note">From RSI's <a href="https://support.robertsspaceindustries.com/hc/en-us/articles/4408770370455" target="_blank" rel="noopener">Included Vessels</a> list. Unlike loaners, these are yours to keep.</p>`;
}

function openShipModal(name) {
  hidePreview();
  const v = shipEntry(name);
  const title = (v && v.name) || name;
  const pledges = state.items.filter((p) =>
    (p.contents || []).some((c) => /^ship$/i.test(c.kind || '') && sameShip(c.label, title)),
  );
  const bbs = state.buybacks.filter((b) => buybackHasShip(b, title));
  const status = v && (SHIP_STATES.find(([k]) => k === v.status) || [])[1];
  const loan = loanersOf(title);
  const row = (k, val) =>
    val
      ? `<div class="mr"><span class="mr-k">${k}</span><span class="mr-v">${val}</span></div>`
      : '';
  const esc = OH.escapeHtml;
  const q = encodeURIComponent(title);
  const pledgeRows = pledges.length
    ? `<table class="modal-contents"><tbody>${pledges
        .map(
          (p) =>
            `<tr><td><button type="button" class="ship-link" data-open-item="${esc(String(p.id))}">${esc(
              plainName(p),
            )}</button></td><td class="num">${esc(formatValue(p))}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="muted">Not in your hangar.</p>';
  const bbRows = bbs.length
    ? `<h4 class="modal-h">In Your Buy-Backs (${bbs.length})</h4><table class="modal-contents"><tbody>${bbs
        .map(
          (b) =>
            `<tr><td><button type="button" class="ship-link" data-open-bb="${esc(String(b.id))}">${esc(buybackName(b))}</button></td><td class="num">${buybackReclaimLink(b)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  setHTML(
    modalBody,
    `<div class="modal-img placeholder">Ship</div>
    <div class="modal-info">
      <h3 class="modal-name">${esc(title)}</h3>
      <div class="modal-meta">${status ? `<span class="badge ${v.status === 'flight-ready' ? 'good' : 'warn'}">${esc(status)}</span>` : ''}${
        v && v.msrp ? `<span class="modal-val">${dollars(v.msrp)}</span>` : ''
      }</div>
      <button type="button" class="mk-btn wish-btn" data-wish-toggle="${esc(title)}">${
        onWishlist(title) ? 'Remove from Wishlist' : 'Add to Wishlist'
      }</button>
      ${row('Manufacturer', v && v.mfr ? esc(v.mfr) : '')}
      ${row('Role', v && (v.role || v.career) ? esc(titleCase(v.role || v.career)) : '')}
      ${row('Size', v && v.size ? esc(titleCase(v.size)) : '')}
      ${row('Crew', v && v.crew ? esc(String(v.crew)) : '')}
      ${row('Cargo', v && v.cargo ? `${esc(String(v.cargo))} SCU` : '')}
      ${row('In store now', storeOf(title) ? inStoreHtml(title) : '')}
      ${row('Comes with', includedOf(title) ? includedOf(title).map(vesselLink).join(', ') : '')}
      ${row('Loaners', loan ? loan.loaners.map((l) => shipLink(l)).join(', ') : '')}
      ${row(
        'Links',
        [
          `<a href="https://robertsspaceindustries.com/ship-matrix/search?q=${q}" target="_blank" rel="noopener" class="bb-reclaim">RSI ↗</a>`,
          `<a href="https://starcitizen.tools/index.php?search=${q}" target="_blank" rel="noopener" class="bb-reclaim">Wiki ↗</a>`,
          '<a href="https://www.erkul.games/live/calculator" target="_blank" rel="noopener" class="bb-reclaim">Erkul ↗</a>',
        ].join(' · '),
      )}
      <h4 class="modal-h">In Your Hangar (${pledges.length})</h4>
      ${pledgeRows}
      ${bbRows}
      ${v ? '' : '<p class="muted">No ship data for this name yet.</p>'}
    </div>`,
  );
  showItemModal();
  fillModalArt(null, title, true);
  if (!loanerMatrix) ensureLoaners();
  ensureStore();
  fillStock(modalBody);
}

// One click handler for ship / pledge / buy-back links anywhere on the page.
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-ship]');
  if (s) {
    e.preventDefault();
    closeGlobalSearch();
    return void openShipModal(s.dataset.ship);
  }
  const it = e.target.closest('[data-open-item]');
  if (it) {
    const p = state.items.find((x) => String(x.id) === it.dataset.openItem);
    closeGlobalSearch();
    if (p) openItemModal(p);
    return;
  }
  const bb = e.target.closest('[data-open-bb]');
  if (bb) {
    const b = state.buybacks.find((x) => String(x.id) === bb.dataset.openBb);
    closeGlobalSearch();
    if (b) openBuybackModal(b);
  }
});

// --- Wishlist ---------------------------------------------------------------
// Ships you want (by name), kept in this browser (`wishlist`). Toggled from the
// ship window; listed on the Store page with price, and any buy-back copies
// you could reclaim instead of buying new.
function onWishlist(name) {
  return state.wishlist.some((n) => sameShip(n, name));
}
function toggleWishlist(name) {
  state.wishlist = onWishlist(name)
    ? state.wishlist.filter((n) => !sameShip(n, name))
    : [...state.wishlist, name];
  chrome.storage.local.set({ wishlist: state.wishlist });
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-wish-toggle]');
  if (t) {
    toggleWishlist(t.dataset.wishToggle);
    t.textContent = onWishlist(t.dataset.wishToggle) ? 'Remove from Wishlist' : 'Add to Wishlist';
    if (currentView() === 'store') renderStore();
    return;
  }
  const r = e.target.closest('[data-wish-remove]');
  if (r) {
    // One click removes; an Undo bar brings it back (same spot) for 8 seconds.
    const name = r.dataset.wishRemove;
    const at = state.wishlist.indexOf(name);
    toggleWishlist(name);
    renderStore();
    showWishUndo(name, at);
    return;
  }
  if (e.target.closest('[data-wish-undo]') && wishUndo) {
    const { name, at } = wishUndo;
    if (!onWishlist(name)) {
      state.wishlist.splice(Math.max(0, at), 0, name);
      chrome.storage.local.set({ wishlist: state.wishlist });
    }
    hideWishUndo();
    renderStore();
  }
});
let wishUndo = null; // { name, at, timer }
function showWishUndo(name, at) {
  const bar = $('#wish-undo');
  if (!bar) return;
  clearTimeout(wishUndo && wishUndo.timer);
  wishUndo = { name, at, timer: setTimeout(hideWishUndo, 8000) };
  const v = shipEntry(name);
  setHTML(
    bar,
    `Removed ${OH.escapeHtml((v && v.name) || name)} from your wishlist. <button type="button" class="ship-link wish-undo-btn" data-wish-undo>Undo</button>`,
  );
  bar.hidden = false;
}
function hideWishUndo() {
  clearTimeout(wishUndo && wishUndo.timer);
  wishUndo = null;
  const bar = $('#wish-undo');
  if (bar) bar.hidden = true;
}

// --- Stats → Spending ---------------------------------------------------------
// What you've pledged per year (by pledge date) and the running total. Uses
// each pledge's melt value, the store credit you'd get back, so gifts and
// rewards count as $0 and upgrades count what they added.
function spendingSectionHtml() {
  const byYear = new Map();
  let undated = 0;
  for (const p of state.items) {
    const y = /^(\d{4})/.exec(p.date || '');
    const v = Number.isFinite(p.value) ? p.value : 0;
    if (!y) {
      undated += v;
      continue;
    }
    const cur = byYear.get(y[1]) || { n: 0, sum: 0 };
    cur.n++;
    cur.sum += v;
    byYear.set(y[1], cur);
  }
  if (!byYear.size)
    return '<p class="muted">No dated pledges yet. Hit Scan at the top and we’ll do the math on your spending (gently).</p>';
  const years = [...byYear.keys()].sort();
  const first = Number(years[0]);
  const last = Number(years[years.length - 1]);
  const all = [];
  for (let y = first; y <= last; y++)
    all.push([String(y), byYear.get(String(y)) || { n: 0, sum: 0 }]);
  const total = all.reduce((a, [, r]) => a + r.sum, 0) + undated;
  const max = Math.max(1, ...all.map(([, r]) => r.sum));
  const best = all.reduce((b, cur) => (cur[1].sum > b[1].sum ? cur : b));
  let running = 0;
  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const bars = all
    .map(([y, r]) => {
      running += r.sum;
      return `<div class="bar-row">
        <div class="bar-label">${y}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((r.sum / max) * 100)}%"></div></div>
        <div class="bar-val spend-val">${money(r.sum)} <span class="muted">· ${r.n} pledge${r.n === 1 ? '' : 's'} · total ${money(running)}</span></div>
      </div>`;
    })
    .join('');
  return `<div class="stat-grid">
      ${box(money(total), 'pledged in total')}
      ${box(`${all.length}`, `years (${first} to ${last})`)}
      ${box(money(total / all.length), 'average per year')}
      ${box(best[0], `biggest year (${money(best[1].sum)})`)}
    </div>
    <h3 class="section-title" style="margin-top:22px">By Year</h3>
    ${bars}
    <p class="muted value-note">By pledge date, using each pledge's melt value (the store credit it would return), so gifts and rewards count as $0 and upgrades count only what they added.${
      undated ? ` ${money(undated)} of pledges have no date.` : ''
    } Stays on your PC like everything else.</p>`;
}

// --- Home: event heads-up -----------------------------------------------------
// A banner while a referral bonus event runs (they come with the big sales:
// IAE, Invictus, CitizenCon, Luminalia…), from the wiki's event list.
function renderEventBanner() {
  refreshReferralEvents(); // calls back here when newer events arrive
  homeUpdated();
}

// --- Alerts bell (top bar) -------------------------------------------------------
// Home's Hangar Alerts publishes its list (OHApp.alerts); the bell shows the count
// and the same alerts in a drop-down, with × to ignore, on every page.
function renderBell() {
  const al = window.OHApp?.alerts;
  const list = (al && al.list) || [];
  const n = $('#bell-n');
  if (n) {
    n.hidden = !list.length;
    n.textContent = list.length > 9 ? '9+' : String(list.length);
  }
  const menu = $('#bell-menu');
  if (!menu) return;
  const esc = OH.escapeHtml;
  setHTML(
    menu,
    `<div class="bm-head"><span>${list.length ? `${list.length} alert${list.length === 1 ? '' : 's'}` : 'All caught up'}</span>${list.length ? '<button type="button" class="bm-clear" data-clear-alerts>Clear All</button>' : ''}</div>` +
      (list.length
        ? list
            .map(
              (x, i) =>
                `<div class="bm-row ${esc(x.kind || '')}"><a href="${esc(x.href || '#home')}" data-alert="${i}"><b>${esc(x.title)}</b><small>${esc(x.sub || '')}</small></a><button type="button" class="bm-x" data-ignore="${i}" title="Ignore" aria-label="Ignore: ${esc(x.title)}">×</button></div>`,
            )
            .join('')
        : `<p class="bm-none">${OH.quip('caughtUp')} Alerts land here when a wishlist ship goes on sale, a ship you own turns flight ready, and more.</p>`),
  );
}
document.addEventListener('oh:alerts', renderBell);
$('#bell-menu')?.addEventListener('click', (e) => {
  const list = window.OHApp?.alerts?.list || [];
  // Clear All ignores every alert showing (each comes back if something new happens).
  if (e.target.closest('[data-clear-alerts]')) {
    for (const x of list) window.OHApp.alerts.ignore(x.key);
    return;
  }
  const ig = e.target.closest('[data-ignore]');
  if (ig) {
    window.OHApp.alerts.ignore(list[+ig.dataset.ignore].key);
    return;
  }
  const go = e.target.closest('[data-alert]');
  if (go) {
    const x = list[+go.dataset.alert];
    if (x && x.go) {
      e.preventDefault();
      x.go();
    }
    closeCardMenus();
  }
});

// --- Global hangar search (Home) ------------------------------------------------
// Searches what's yours: hangar pledges (names and what's inside), buy-backs
// and earned referral rewards. Not the store catalog: a ship you don't own
// finds nothing. "/" focuses it; Esc closes.
const gsearch = $('#gsearch');
const gsearchOut = $('#gsearch-results');
// Both global searches start empty every time (#178): leaving one (click away,
// Escape, a result, another page) clears it. The page filters on Inventory and
// Buy-Backs are different: they stay.
function closeGlobalSearch() {
  if (gsearchOut) gsearchOut.hidden = true;
  if (gsearch) gsearch.value = '';
}
function closeTopSearch() {
  const out = $('#gsearch-top-results');
  if (out) out.hidden = true;
  const box = $('#gsearch-top');
  if (box) box.value = '';
}
// While results are open the wheel scrolls them, wherever the mouse is over the
// panel (gaps, titles, footer, edges), and never hands the scroll to the page
// (#168). lockPage: the page behind is dimmed, so it doesn't scroll either.
function wheelStaysInResults(panel, { lockPage = false } = {}) {
  document.addEventListener(
    'wheel',
    (e) => {
      if (panel.hidden) return;
      const inside = panel.contains(e.target);
      if (!inside && !lockPage) return;
      e.preventDefault();
      const list = panel.querySelector('.gs-scroll');
      if (list && inside) list.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    },
    { passive: false },
  );
}
// A click in either results panel: "Get Details" reads the unchecked packs'
// pages; any row opens (handled further down), then the search clears.
function onResultsClick(e, close) {
  if (e.target.closest('[data-gs-bbdetails]')) {
    close();
    location.hash = '#buybacks';
    loadBuybackDetails({ packsOnly: true });
    return;
  }
  if (e.target.closest('.gs-row')) close();
}
window.addEventListener('hashchange', () => {
  closeGlobalSearch();
  closeTopSearch();
});
// Rich results (0.3.0): a plain yes/no answer first, then one row per match with
// its picture, full name, what it's inside, key facts and price, grouped by where
// it lives. Rows open the pledge / buy-back details; the list scrolls in place.
function globalSearchHtml(q) {
  const needle = q.trim().toLowerCase();
  const esc = OH.escapeHtml;
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
  const tag = (t, cls = '') => (t ? `<span class="gs-tag ${cls}">${esc(t)}</span>` : '');
  const pic = (img, resolve, label) =>
    img
      ? `<span class="gs-img"><img src="${esc(img)}" alt="" loading="lazy"></span>`
      : `<span class="gs-img" data-resolve="${esc(resolve || '')}"><span>${esc(label || '')}</span></span>`;
  const row = ({ attr, img, resolve, name, where, tags, val, valLbl, open }) =>
    `<button type="button" class="gs-row gs-rich" ${attr}>${pic(img, resolve, name)}<span class="gs-info"><span class="gs-name">${esc(name)}</span><span class="gs-where">${where}</span><span class="gs-tags">${tags.join('')}</span></span><span class="gs-side">${val ? `<b>${esc(val)}</b>${valLbl ? `<small>${esc(valLbl)}</small>` : ''}` : ''}<span class="gs-open">${open}</span></span></button>`;
  const group = (title, rows, n) =>
    rows.length
      ? `<div class="gs-group"><div class="gs-title"><span>${title}</span><span>${n > rows.length ? `${rows.length} of ${n}` : n}</span></div>${rows.join('')}</div>`
      : '';

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
    return row({
      attr: `data-open-item="${esc(String(p.id))}"`,
      img: realImage(p.image),
      resolve: inner ? inner.label : resolveImageName(p),
      name: inner ? inner.label : cardName(p),
      where:
        // The group heading already says where it is; the row says what it's inside.
        [
          inner ? `Inside <b>${esc(cardName(p))}</b>` : '',
          p.date ? `<em>Pledged ${esc(day(p.date))}</em>` : '',
        ]
          .filter(Boolean)
          .join(' <em>·</em> '),
      tags: [
        tag(TYPE_KEYS.includes(type) ? type.toUpperCase() : p.kind, `badge ${type}`),
        tag(p.insurance),
        isMeltable(p) ? tag('Meltable', 'good') : '',
        p.giftable ? tag('Giftable', 'good') : '',
      ],
      val: isMeltable(p) ? formatValue(p) : '',
      valLbl: 'melt value',
      open: 'Details →',
    });
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
  const bbs = bbHits.slice(0, 8).map((b) => {
    const type = bbType(b);
    const inner = bbInner(b);
    return row({
      attr: `data-open-bb="${esc(String(b.id))}"`,
      img: inner || (b.ccu && b.ccu.to && !b.shipArt) ? null : realImage(b.image),
      resolve: inner
        ? inner.name
        : b.ccu && b.ccu.to
          ? b.ccu.to
          : resolveImageName({ ...b, kind: 'ship' }) || b.name,
      name: inner ? inner.name : buybackName(b),
      where: [
        inner ? `Inside <b>${esc(buybackName(b))}</b>` : b.contains ? esc(b.contains) : '',
        b.date ? `<em>Melted ${esc(day(b.date))}</em>` : '',
      ]
        .filter(Boolean)
        .join(' <em>·</em> '),
      tags: [
        tag(
          TYPE_KEYS.includes(type) ? type.toUpperCase() : type || 'BUY-BACK',
          `badge ${type || ''}`,
        ),
        tag(b.insurance),
      ],
      val: bbPriceText(b),
      open: 'Details →',
    });
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
        .map(
          (r) =>
            `<a class="gs-row gs-rich" href="#referrals">${pic(null, '', r.name)}<span class="gs-info"><span class="gs-name">${esc(r.name)}</span><span class="gs-where">Referral reward <em>· ${esc(r.sub)}</em></span></span><span class="gs-side"><span class="gs-open">Referrals →</span></span></a>`,
        )
    : [];

  // The groups say where things are (owner: no yes/no line); only an empty search
  // gets a line of its own.
  // Packs whose contents were never read can't match on what's inside them; say
  // so quietly, with a way to read just those (details stay opt-in: scans stay fast).
  const unchecked = uncheckedPacks();
  const packNote = unchecked
    ? `<div class="gs-note">${unchecked} buy-back pack${unchecked === 1 ? '' : 's'} not checked yet · <button type="button" class="gs-note-btn" data-gs-bbdetails>Get Details</button></div>`
    : '';
  const body =
    group('In Your Hangar', pledges, hits.length) +
    group('In Your Buy-Backs', bbs, bbHits.length) +
    packNote +
    group('Earned Rewards', rewards, rewards.length);
  if (!pledges.length && !bbs.length && !rewards.length)
    return `<div class="gs-none">Nothing in your hangar, buy-backs or referral rewards matches "${esc(q.trim())}".</div>${packNote}`;
  const total = pledges.length + bbs.length + rewards.length;
  return `<div class="gs-scroll">${body}</div><div class="gs-foot"><span>${total} result${total === 1 ? '' : 's'} · Enter opens the first</span><span>Searching your hangar, buy-backs and rewards</span></div>`;
}
// Search rows without RSI art get the ship's picture from the wiki (few at a time).
function resolveSearchImages(root) {
  const slots = [...root.querySelectorAll('.gs-img[data-resolve]')].filter(
    (el) => el.dataset.resolve,
  );
  let i = 0;
  const worker = async () => {
    while (i < slots.length) {
      const el = slots[i++];
      const url = await OH.getShipImage(el.dataset.resolve);
      if (!url || !el.isConnected) continue;
      const im = document.createElement('img');
      im.src = url;
      im.alt = '';
      im.loading = 'lazy';
      el.replaceChildren(im);
    }
  };
  for (let w = 0; w < 3; w++) worker();
}
if (gsearch && gsearchOut) {
  gsearch.addEventListener('input', () => {
    const q = gsearch.value;
    // Too short to search: hide the results but keep what's typed (closing
    // would also clear the box and eat the first letter).
    if (q.trim().length < 2) {
      gsearchOut.hidden = true;
      return;
    }
    ensurePrices();
    setHTML(gsearchOut, globalSearchHtml(q));
    gsearchOut.hidden = false;
    resolveSearchImages(gsearchOut);
  });
  gsearch.addEventListener('focus', () => {
    if (gsearch.value.trim().length >= 2) gsearch.dispatchEvent(new Event('input'));
  });
  gsearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeGlobalSearch();
      gsearch.blur();
    } else if (e.key === 'Enter') {
      gsearchOut.querySelector('.gs-row')?.click(); // opens it, then clears
    }
  });
  gsearchOut.addEventListener('click', (e) => onResultsClick(e, closeGlobalSearch));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.gsearch') && (gsearch.value || !gsearchOut.hidden)) closeGlobalSearch();
  });
  wheelStaysInResults(gsearchOut, { lockPage: true });
  // The top bar's search box: same results, shown under it, on every page.
  const top = $('#gsearch-top');
  const topOut = $('#gsearch-top-results');
  if (top && topOut) {
    top.addEventListener('input', () => {
      const q = top.value;
      if (q.trim().length < 2) {
        topOut.hidden = true;
        return;
      }
      ensurePrices();
      setHTML(topOut, globalSearchHtml(q));
      topOut.hidden = false;
      resolveSearchImages(topOut);
    });
    top.addEventListener('focus', () => {
      if (top.value.trim().length >= 2) top.dispatchEvent(new Event('input'));
    });
    top.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTopSearch();
        top.blur();
      } else if (e.key === 'Enter') {
        topOut.querySelector('.gs-row')?.click(); // opens it, then clears
      }
    });
    topOut.addEventListener('click', (e) => onResultsClick(e, closeTopSearch));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#top-search') && (top.value || !topOut.hidden)) closeTopSearch();
    });
    wheelStaysInResults(topOut);
  }
  document.addEventListener('keydown', (e) => {
    const typing =
      /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === '/' && !typing) {
      // Home's big box on Home; the top bar's box everywhere else.
      e.preventDefault();
      if ($('#view-home').classList.contains('active')) gsearch.focus();
      else $('#gsearch-top')?.focus();
    }
  });
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
    hideSmallBb,
    bbStack,
    savedViews,
    currency,
    uiGroupByType,
    wishlist,
    uiWishSort,
  } = await chrome.storage.local.get([
    'wishlist',
    'uiWishSort',
    'currency',
    'uiGroupByType',
    'remindRescan',
    'streamerMode',
    'hideSmallInv',
    'hideSmallBb',
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
  if (Array.isArray(wishlist)) state.wishlist = wishlist.filter((n) => typeof n === 'string');
  if (WISH_SORTS.some(([k]) => k === uiWishSort)) state.wishSort = uiWishSort;
  if (STATS_TABS.some(([k]) => k === uiStatsTab)) state.statsTab = uiStatsTab;
  if (Number.isFinite(lastBackupAt)) state.lastBackupAt = lastBackupAt;
  streamer.on = streamerMode === true;
  state.hideSmall = hideSmallInv === true;
  state.bbHideSmall = hideSmallBb !== false; // on unless turned off
  state.bbStack = bbStack === true;
  if (Array.isArray(savedViews)) state.savedViews = savedViews.filter((v) => v && v.name && v.f);
  document.documentElement.classList.toggle('streamer', streamer.on);
  const stream = $('#streamer-toggle');
  if (stream) {
    stream.checked = streamer.on;
    stream.addEventListener('change', async () => {
      streamer.on = stream.checked;
      document.documentElement.classList.toggle('streamer', streamer.on);
      await chrome.storage.local.set({ streamerMode: streamer.on });
      route(); // redraw the page with (or without) amounts
      renderAccount();
      homeUpdated();
    });
  }
  const remind = $('#remind-toggle');
  if (remind) {
    remind.checked = remindRescan !== false;
    remind.addEventListener('change', () =>
      chrome.storage.local.set({ remindRescan: remind.checked }),
    );
  }
  if (LAYOUTS.includes(bbLayout)) state.bbLayout = bbLayout;
  if (marketAnnotations && typeof marketAnnotations === 'object') state.market = marketAnnotations;

  state.bbDetails = { ...(await OH.getBuybackDetails()) };
  await OH.migrateRecovery(); // old "Restore previous hangar" snapshot → saved account
  loadStateFromDB(await OH.loadDB());

  const notice = await reconcileAccount();
  state.shown = new Set(); // default: no filter selected = show all
  state.traits = new Map();
  state.bbShown = new Set(); // default: no filter selected = show all
  state.bbTraits = new Map();
  route();
  if (notice) setStatus(notice);
  await refreshRecoveryUI();
  renderProfiles();
  renderFooter();
  renderSupporters();
  initUpdates();
  renderSiteNotice();
  renderDbNotice();
  // @sync-start
  renderSiteLink();
  // @sync-end
  if (currency && currency !== 'USD') {
    const sel = $('#currency-select');
    if (sel) sel.value = currency;
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
window.OHApp = {
  get state() {
    return state;
  },
  get recruits() {
    return state.referral?.legacy?.recruits ?? 0;
  },
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
  wishlistStock,
  tierProgress: (recruits) => tierProgress(REFERRAL_LADDER_STANDARD, recruits),
  rewardNames,
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
    state.traits = new Map(key === 'lti' ? [['lti', 'yes']] : []);
    location.hash = '#inventory';
    renderInventory();
  },
  shipOf: (name) => (state.shipOf ? state.shipOf(name) : null),
  priceOf: (name) => (state.priceOf ? state.priceOf(name) : null),
  // --- Stats (ui/stats) ---
  // The page showing now ('home', 'stats'…): Stats only draws while it's open.
  get view() {
    return currentView();
  },
  // True while the ship list (store prices, ship data) is still loading.
  get pricesLoading() {
    return !!pricesLoading;
  },
  ensureLoaners,
  statsTabs: STATS_TABS,
  presentKinds,
  bbKinds: BB_KINDS,
  titleCase,
  insLabel,
  buybackName,
  bbPrice,
  bbDetail,
  nextTokenDate,
  // Your ships that come with loaners / included vessels ([{ ship, list }]), or
  // null until RSI's list has loaded (ensureLoaners fetches it).
  loanerRows: () =>
    loanerMatrix
      ? ownedShips()
          .map((s) => ({ ship: s.label, row: loanersOf(s.label) }))
          .filter((r) => r.row)
          .map((r) => ({ ship: r.ship, list: r.row.loaners }))
      : null,
  includedRows: () =>
    includedVessels
      ? ownedShips()
          .map((s) => ({ ship: s.label, list: includedOf(s.label) }))
          .filter((r) => r.list)
      : null,
};
