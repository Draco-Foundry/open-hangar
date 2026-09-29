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
  'developers',
];

const statusEl = $('#status');
const scannedHomeEl = $('#scanned-home');
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
const scanIndicator = $('#scan-indicator');
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
  bbSort: 'date-desc', // default to newest buy-backs first
  groupByType: true, // Inventory: one section per type
  bbDetails: {}, // pledge id → details read from the buy-back's own RSI page
  bbShown: new Set(), // buy-back kind filter
  bbTraits: new Map(), // buy-back trait filter (AND): key → 'yes' | 'no'
  bbLayout: 'gallery', // gallery | compact | list | market (independent of inventory)
  owner: null, // { nickname, displayname } the stored data was scanned from
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
    'alt checked class colspan datetime disabled height hidden href id inputmode loading ' +
    'maxlength name placeholder rel role rowspan selected src style tabindex target title type ' +
    'value width ' +
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
      const badUrl = (an === 'href' || an === 'src') && !SAFE_URL.test(a.value.trim());
      const badStyle = an === 'style' && /url\s*\(|expression|javascript:/i.test(a.value);
      if (!known || badUrl || badStyle) {
        console.warn(`[setHTML] dropped ${an}= on <${name}>`);
        node.removeAttribute(a.name);
      }
    }
  }
  el.replaceChildren(...root.childNodes);
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  if (isError) {
    OH.log('error', 'status', text);
    // One click to a paste-ready report for #bug-reports / GitHub.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-btn';
    btn.textContent = 'Copy error report';
    btn.addEventListener('click', () => copyErrorReport(btn));
    statusEl.append(' ', btn);
  }
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
      ? 'Copied! Paste it in #bug-reports or a GitHub issue'
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

// Global scan indicator in the header — visible from every view (the scan keeps
// running across view switches since this is a single page). `done` shows a
// final tick/warn that auto-hides; falsy text hides it immediately.
let scanIndicatorTimer = null;
function setScanning(text, done = false) {
  if (!scanIndicator) return;
  clearTimeout(scanIndicatorTimer);
  if (!text) {
    scanIndicator.hidden = true;
    setHTML(scanIndicator, '');
    return;
  }
  setHTML(
    scanIndicator,
    (done ? '' : '<span class="spin"></span>') + `<span>${OH.escapeHtml(text)}</span>`,
  );
  scanIndicator.hidden = false;
  if (done) {
    scanIndicatorTimer = setTimeout(() => {
      scanIndicator.hidden = true;
      setHTML(scanIndicator, '');
    }, 6000);
  }
}

// Amounts are USD; `fx` converts them to the display currency (Home → Currency).
// `rawMoney` is for numbers the user typed (My Price), which aren't converted.
const fx = { code: 'USD', rate: 1, date: null };
const fmtCurrency = (n, digits) => {
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
// Store-price info for one pledge ({ store, ships, unpriced, paid, below }) or null.
function storeInfo(p) {
  const v = hangarValue();
  return (v && v.pledges[p.id]) || null;
}

function formatValue(p) {
  if (!Number.isFinite(p.value)) return '';
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
  if (v === 'home') renderHome();
  else if (v === 'inventory') renderInventory();
  else if (v === 'stats') renderStats();
  else if (v === 'referrals') renderReferrals();
  else if (v === 'buybacks') renderBuybacks();
  else if (v === 'developers') renderProfiles();
  else if (v === 'org') renderOrg();
  else if (v === 'store') renderStore();
  else if (v === 'updates') renderUpdates();
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

// The ship name to look an image up by: a CCU's target ship, else a ship's own
// name. Add-ons/coupons return '' (don't fetch art for non-ships).
function resolveImageName(p) {
  if (p.isCCU && p.ccu && p.ccu.to) return p.ccu.to;
  if (p.kind === 'ship' || p.containsShip) return p.name || '';
  return '';
}

// After a card grid renders, fill in missing ship art from the wiki API (lazy,
// concurrency-capped). Updates the card thumbnail, its data-image (for the hover
// preview), and the backing item (so the detail modal shows it too).
function enhanceCardImages(container) {
  const cards = [...container.querySelectorAll('.card[data-resolve]')].filter(
    (c) => c.dataset.resolve && !c.querySelector('img.thumb'),
  );
  let i = 0;
  const CONCURRENCY = 3;
  const worker = async () => {
    while (i < cards.length) {
      const card = cards[i++];
      const art = await OH.getShipImage(card.dataset.resolve);
      const url = art || card.dataset.rsiImage;
      if (!url) continue;
      card.dataset.image = url;
      const id = card.dataset.id;
      const item =
        state.items.find((p) => String(p.id) === id) ||
        state.buybacks.find((b) => String(b.id) === id);
      if (item) {
        item.image = url;
        if (art) item.shipArt = true; // a CCU's target art is in hand now
      }
      const ph = card.querySelector('.thumb.placeholder');
      if (ph) {
        const im = document.createElement('img');
        im.className = 'thumb';
        im.loading = 'lazy';
        im.src = url;
        ph.replaceWith(im);
      }
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) worker();
}

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
      sideEl = $('#cc-side'),
      loEl = $('#cc-loggedout');
    if (acctEl) acctEl.hidden = loggedOut;
    if (sideEl) sideEl.hidden = loggedOut;
    if (loEl) loEl.hidden = !loggedOut;
    if (logoutBtn) logoutBtn.hidden = a.loggedIn !== true;

    updateSignedOutBanner(loggedOut);

    // Avatar (+ subscriber-tier ring)
    if (avEl) {
      avEl.style.backgroundImage = safeBgUrl(a.avatar);
      avEl.className =
        'cc-avatar' +
        (a.subscriber?.type === 'Imperator' ? ' tier-imperator' : a.subscriber ? ' tier-sub' : '');
    }

    // Name
    if (nameEl) {
      nameEl.textContent =
        a.displayname || a.nickname || (a.loggedIn === false ? 'Not signed in' : DASH);
    }

    // Meta (UEE record + enlisted date) under the portrait.
    if (metaEl) {
      if (a.loggedIn === false) {
        metaEl.textContent = 'Log in to scan your hangar';
      } else if (a.loggedIn) {
        // UEE record + enlisted date, each on its own plain line under the portrait.
        setHTML(
          metaEl,
          `<span class="cc-meta-line">UEE ${OH.escapeHtml(a.citizenRecord || DASH)}</span>` +
            `<span class="cc-meta-line">Enlisted ${OH.escapeHtml(fmtEnlisted(a.enlistedSince))}</span>`,
        );
      } else {
        metaEl.textContent = DASH;
      }
    }

    // Main organization (logo · name · rank), linked to the org page. Name can be
    // long, so it wraps. When the member has no main org (or it's redacted), show
    // a muted "No affiliation" rather than a blank gap (extension-wide convention).
    if (orgEl) {
      const org = a.loggedIn ? a.org : null;
      if (org && org.name) {
        const logo = org.logo
          ? `<img class="cc-org-logo" src="${OH.escapeHtml(org.logo)}" alt="" loading="lazy">`
          : `<span class="cc-org-logo cc-org-logo-ph"></span>`;
        const inner =
          `${logo}<span class="cc-org-text">` +
          `<span class="cc-org-name">${OH.escapeHtml(org.name)}</span>` +
          (org.rank ? `<span class="cc-org-rank">${OH.escapeHtml(org.rank)}</span>` : '') +
          `</span>`;
        setHTML(
          orgEl,
          org.sid
            ? `<a class="cc-org-link" href="https://robertsspaceindustries.com/orgs/${encodeURIComponent(org.sid)}" target="_blank" rel="noopener">${inner}</a>`
            : `<span class="cc-org-link">${inner}</span>`,
        );
        orgEl.hidden = false;
      } else if (a.loggedIn) {
        setHTML(
          orgEl,
          `<span class="cc-org-link cc-org-none"><span class="cc-org-logo cc-org-logo-ph"></span><span class="cc-org-text"><span class="cc-org-name">No affiliation</span></span></span>`,
        );
        orgEl.hidden = false;
      } else {
        setHTML(orgEl, '');
        orgEl.hidden = true;
      }
    }

    // Flair (subscriber + concierge), tier-coloured; hidden when none.
    if (flairEl) {
      const parts = [];
      if (a.subscriber?.type) {
        const tier = a.subscriber.type === 'Imperator' ? 'sub' : 'sub sub-centurion';
        parts.push(
          `<a class="flair ${tier}" href="https://robertsspaceindustries.com/en/pledge/subscriptions" target="_blank" rel="noopener"><span class="flair-lbl">Subscriber</span> <b>${OH.escapeHtml(a.subscriber.type)}</b></a>`,
        );
      }
      if (a.concierge?.level) {
        const col = CONCIERGE_COLORS[a.concierge.level.toLowerCase()] || '#d2a8ff';
        const pct = Number(a.concierge.percent) || 0;
        const prog = a.concierge.next
          ? `<span class="flair-prog"><span class="flair-bar"><span style="width:${pct}%;background:${col}"></span></span>${pct}% → ${OH.escapeHtml(a.concierge.next)}</span>`
          : '';
        parts.push(
          `<a class="flair concierge" style="border-color:${col}" href="https://robertsspaceindustries.com/en/account/concierge" target="_blank" rel="noopener"><span class="flair-lbl">Chairman's Club</span> <b style="color:${col}">${OH.escapeHtml(a.concierge.level)}</b>${prog}</a>`,
        );
      }
      setHTML(flairEl, parts.join(''));
    }

    // Balances — always rendered, with dashes when there's no data (uniform).
    if (balEl) {
      const c = a.credits || {};
      const fmt = (n) => Number(n).toLocaleString('en-US');
      const pill = (cls, label, val) =>
        `<span class="bal ${cls}"><span class="bal-lbl">${label}</span> <b>${val}</b></span>`;
      setHTML(
        balEl,
        pill('store', 'Store Credit', c.store ? money(c.store.value / 100) : DASH) +
          pill('uec', 'UEC', c.uec ? '¤' + fmt(c.uec.value) : DASH) +
          pill('rec', 'REC', c.rec ? '¤' + fmt(c.rec.value) : DASH) +
          `<a class="bal bbt" href="#buybacks" data-view="buybacks" title="${OH.escapeHtml(
            tokenTitle(),
          )}"><span class="bal-lbl">Buy-back tokens</span> <b>${
            state.bbTokens != null ? state.bbTokens : DASH
          }</b></a>`,
      );
    }

    renderReferralPill(a);
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

// Citizen Card referral pill: recruit count + code with a copy button. Prefers the
// scanned referral source (full counts); falls back to just the code from the
// account fetch (which carries it for free) so it shows even before a referral scan.
function renderReferralPill(a) {
  const el = $('#home-referral');
  if (!el) return;
  const ref = state.referral;
  const code = ref?.code || a?.referral?.code || null;
  if (!a || !a.loggedIn || !code) {
    setHTML(el, '');
    return;
  }
  const recruits = ref?.legacy?.recruits ?? ref?.current?.recruits ?? null;
  const url = ref?.url || a?.referral?.url || null;
  const countPart =
    recruits != null
      ? `<span class="bal-lbl">Referrals</span> <b>${recruits.toLocaleString('en-US')}</b>`
      : `<span class="bal-lbl">Referral code</span>`;
  setHTML(
    el,
    `<span class="ref-pill">${countPart}
      <span class="ref-pill-sep"></span>
      <span class="ref-code">${OH.escapeHtml(code)}</span>
      <button class="ref-copy" data-copy="${OH.escapeHtml(url || code)}" title="Copy referral link">Copy</button>
    </span>`,
  );
}

function renderVersions() {
  const el = $('#versions');
  if (!el) return;
  const ext = chrome.runtime.getManifest().version;
  // Open Hangar → GitHub releases (once the repo URL is set), else plain text.
  const oh = REPO_URL
    ? `<a href="${REPO_URL}/releases" target="_blank" rel="noopener">Open Hangar v${ext}</a>`
    : `Open Hangar v${ext}`;
  const news = '<a href="#updates" data-view="updates">What’s new</a>';
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

function renderHome() {
  ensurePrices();
  renderVersions();
  renderAccount();
  const has = state.items.length > 0;
  document.getElementById('view-home').classList.toggle('no-data', !has);
  if (clearBtn) clearBtn.hidden = !(state.items.length || state.scannedAt);

  // Dashboard summary strip (#1) — only once there's data.
  const sum = $('#home-summary');
  if (has) {
    const count = (k) => state.items.filter((p) => p.kind === k).length;
    const ships = state.items.filter((p) => p.containsShip).length;
    const box = (big, lbl) =>
      `<div class="sum-box"><div class="sum-big">${big}</div><div class="sum-lbl">${lbl}</div></div>`;
    setHTML(
      sum,
      box(state.items.length, 'pledges') +
        box(money(OH.totalValue(state.items)), 'melt value') +
        (hangarValue()?.store ? box(dollars(hangarValue().store), 'ships at store price') : '') +
        box(ships, 'ships') +
        box(count('ccu'), 'CCUs') +
        (count('paint') ? box(count('paint'), 'paints') : '') +
        box(count('addon'), 'add-ons') +
        (state.buybacks.length ? box(state.buybacks.length, 'buy-backs') : ''),
    );
  } else {
    setHTML(sum, '');
  }
  const ch = $('#home-changes');
  if (ch) {
    const hist = state.history;
    if (has && hist.length >= 2) {
      const d = OH.diffSnapshots(hist[hist.length - 2], hist[hist.length - 1]);
      setHTML(
        ch,
        `Since ${OH.escapeHtml(fmtDay(hist[hist.length - 2].at))}: ${OH.escapeHtml(
          changeSummary(d),
        )} · <a href="#stats" data-stats-tab="history">history</a>`,
      );
      ch.hidden = false;
    } else {
      ch.hidden = true;
    }
  }

  // Scanned line: first-run prompt (#2) or scan freshness with a stale nudge (#5).
  if (!has) {
    scannedHomeEl.textContent = 'Nothing scanned yet — click Scan to begin.';
    return;
  }
  const when = state.scannedAt ? new Date(state.scannedAt).toLocaleString() : 'previously';
  const ageDays = state.scannedAt ? (Date.now() - state.scannedAt) / 86400000 : 0;
  if (ageDays > 7) {
    setHTML(
      scannedHomeEl,
      `Scanned ${OH.escapeHtml(when)} — <span class="stale">over a week old, consider rescanning</span>`,
    );
  } else {
    scannedHomeEl.textContent = `Scanned ${when}`;
  }
}

function link(url, label, soon) {
  return url
    ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
    : `<span class="muted">${label} (soon)</span>`;
}

function renderFooter() {
  const v = chrome.runtime.getManifest().version;
  const gh = link(REPO_URL, 'GitHub');
  const dc = link(DISCORD_URL, 'Discord');
  const ideas = link(IDEAS_URL, 'Suggest a feature');
  setHTML(
    $('#footer'),
    `${gh} · ${dc} · ${ideas} · MIT License · <a href="#updates" data-view="updates">v${v}</a>`,
  );
  const dev = $('#dev-links');
  if (dev)
    setHTML(
      dev,
      link(REPO_URL, 'GitHub') +
        link(DISCORD_URL, 'Discord') +
        link(IDEAS_URL, 'Suggest a feature'),
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
        : `<span class="muted">Be the first — ${link(REPO_URL, 'contributions welcome')}.</span>`,
    );
  }
  const b = $('#sup-boosters');
  if (b) {
    setHTML(
      b,
      BOOSTERS.length
        ? BOOSTERS.map((s) => chip(s, 'booster')).join('')
        : `<span class="muted">Boosters will be thanked here — ${link(DISCORD_URL, 'join the Discord')}.</span>`,
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
    meltCandidate: state.priceOf ? OH.isMeltCandidate(p, storeInfo(p)) : null,
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
    meltCandidate: null,
  };
}
const notInsurance = (c) => !/insurance/i.test(`${c.kind || ''} ${c.label || ''}`);

// Trait filters cut ACROSS kinds (a pack is still a "ship" pledge), so they're a
// second, AND-combined row under the kind chips: Ships + LTI + Giftable = LTI
// ships you can gift. A trait only shows if some item in that view has it.
const TRAITS = [
  {
    key: 'package',
    label: 'Game packages',
    title: 'Pledges that include game access (Star Citizen / Squadron 42)',
    notLabel: 'No game package',
    test: (f) =>
      /^package\b/i.test(f.name) ||
      f.items.some((c) => /^game$/i.test(c.kind || '') || GAME_ITEM_RE.test(c.label || '')),
  },
  {
    // Most packs bundle a ship with paints and gear (e.g. Nine Tails Shogun Pack:
    // 1 vehicle + 1 paint + 8 gear items), so count every item, not just ships.
    key: 'pack',
    label: 'Packs',
    title: 'Pledges that bundle two or more items (ships, paints, gear…)',
    notLabel: 'Single items',
    test: (f) => f.items.filter(notInsurance).length >= 2,
  },
  { key: 'lti', label: 'LTI', notLabel: 'No LTI', title: 'Lifetime insurance', test: (f) => f.lti },
  {
    key: 'giftable',
    label: 'Giftable',
    title: 'RSI shows a Gift action for this pledge',
    notLabel: 'Not giftable',
    test: (f) => f.giftable === true,
    neg: (f) => f.giftable === false,
  },
  {
    key: 'meltable',
    label: 'Meltable',
    title: 'RSI shows an Exchange action, so it can be melted for store credit',
    notLabel: 'Not meltable',
    test: (f) => f.meltable === true,
    neg: (f) => f.meltable === false,
  },
  {
    key: 'warbond',
    label: 'Warbond',
    // RSI's hangar has no warbond marker, so this relies on the pledge name — some
    // warbond purchases (e.g. packs) aren't named that way and won't show here.
    title: "Pledges whose name says Warbond (RSI doesn't always include it)",
    notLabel: 'Not warbond',
    test: (f) => /warbond/i.test(f.name),
  },
  {
    // Catches warbonds and sales that aren't named that way (see TODO.md).
    key: 'below',
    label: 'Below store price',
    title:
      "Paid less than today's store price (star-citizen.wiki): warbonds, sales, older cheaper pricing. Ship pledges and CCUs.",
    notLabel: 'At / above store price',
    test: (f) => f.below === true,
    neg: (f) => f.below === false,
  },
  {
    key: 'melt',
    label: 'Melt candidates',
    title:
      'Meltable, no LTI, ships only, and paid at least today’s store price — you could melt and buy it back for the same credit (check it’s on sale first)',
    notLabel: 'Keep',
    test: (f) => f.meltCandidate === true,
    neg: (f) => f.meltCandidate === false,
  },
  {
    key: 'free',
    label: 'Free / rewards',
    title: '$0 pledges: referral, event and other rewards',
    notLabel: 'Paid pledges',
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
function traitRowHtml(list, selected, facets, anyFilter) {
  const all = list.map(facets);
  const chips = TRAITS.map((t) => {
    const mode = selected.get(t.key);
    const yes = all.filter(t.test).length;
    const no = all.filter(traitNeg(t)).length;
    // Offer a trait only when it splits the list (some have it, some are known
    // not to) — or when it's already picked, so it can still be cleared.
    if (!mode && (!yes || yes === all.length)) return '';
    const label = mode === 'no' ? t.notLabel || `Not ${t.label}` : t.label;
    const n = mode === 'no' ? no : yes;
    const hint = mode === 'yes' ? 'Click again to exclude' : mode === 'no' ? 'Click to clear' : '';
    const title = hint ? `${t.title} · ${hint}` : t.title;
    return `<button class="chip trait" data-trait="${t.key}" data-mode="${mode || ''}" aria-pressed="${!!mode}" title="${OH.escapeHtml(title)}">${OH.escapeHtml(
      label,
    )}<span class="n">${n}</span></button>`;
  }).join('');
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
  return `<span class="flag ${state}" title="${label}" aria-label="${label}">${letter}</span>`;
}
function flagsHtml(p) {
  return `<span class="flags">${flagHtml('M', p.meltable, 'Meltable', 'Not meltable')}${flagHtml(
    'G',
    p.giftable,
    'Giftable',
    'Not giftable',
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
    ? `<img class="thumb" loading="lazy" data-kind="${OH.escapeHtml(p.kind)}" src="${OH.escapeHtml(img)}" alt="">`
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
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(p.kind) ? p.kind : '';
  const sel = state.selecting && state.selected.has(String(p.id)) ? ' selected' : '';
  const rsiImg = ccuArt ? realImage(p.image) || '' : '';
  return `<div class="card${sel}" data-id="${OH.escapeHtml(String(p.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}" data-rsi-image="${OH.escapeHtml(rsiImg)}">
    ${thumb}
    <div class="card-body">
      <div class="card-name" title="${OH.escapeHtml(plainName(p))}">${nameHtml}</div>
      ${contentsLine}
      <div class="card-ins" title="Insurance">${OH.escapeHtml(insLabel(p.insurance))}</div>
      <div class="card-foot">
        <span class="foot-left"><span class="badge ${badgeClass}">${OH.escapeHtml(p.kind)}</span>${flagsHtml(p)}</span>
        <span class="val"${valTitle(p)}>${OH.escapeHtml(formatValue(p))}</span>
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
  const n = Number(m[1]);
  const unit = /y/i.test(m[2]) ? 'Year' : 'Month';
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
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
  { key: 'ship', label: 'Standalone Ships', test: (p) => p.containsShip && !isPack(p) },
  { key: 'pack', label: 'Packs', test: (p) => isPack(p) },
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
      }> Giftable only</label>
      <button class="mk-btn mk-export-csv" type="button">Export CSV</button>
      <button class="mk-btn mk-export-img" type="button">Copy image</button>
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
// the file matches the view. Everything stays local — a download or a clipboard
// copy; nothing is uploaded.

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
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export');
  downloadBlob(
    new Blob([marketCsv(sections)], { type: 'text/csv;charset=utf-8' }),
    marketFilename('csv'),
  );
  setExportStatus(statusEl, 'Saved CSV');
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
function marketImageCanvas(
  sections,
  { title = '', cols = MK_IMG_COLS, cellsOf = marketImageCells } = {},
) {
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

  ctx.fillStyle = '#0d1117';
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
    ctx.fillStyle = '#e6edf3';
    ctx.font = f(700, 22);
    ctx.fillText(clip(title, tableW), PAD, y + 16);
    ctx.fillStyle = '#8b949e';
    ctx.font = f(400, 12);
    ctx.textAlign = 'right';
    ctx.fillText('Open Hangar · openhangar.space', PAD + tableW, y + 16);
    ctx.textAlign = 'left';
    y += HEADER_H;
  }
  for (const { section, groups } of sections) {
    ctx.fillStyle = '#e6edf3';
    ctx.font = f(600, 16);
    ctx.fillText(`${section.label}  (${groups.length})`, PAD, y + TITLE_H / 2);
    y += TITLE_H;

    ctx.fillStyle = '#1c222b';
    ctx.fillRect(PAD, y, tableW, HEAD_H);
    ctx.fillStyle = '#e6edf3';
    ctx.font = f(600, 13);
    cols.forEach((c, i) => ctx.fillText(c.label, colX[i] + CELL_X, y + HEAD_H / 2));
    y += HEAD_H;

    groups.forEach((g, ri) => {
      if (ri % 2 === 1) {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(PAD, y, tableW, ROW_H);
      }
      ctx.strokeStyle = '#2a3139';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + ROW_H + 0.5);
      ctx.lineTo(PAD + tableW, y + ROW_H + 0.5);
      ctx.stroke();

      const cells = cellsOf(g);
      cols.forEach((c, i) => {
        if (c.key === 'name' || c.key === 'price') ctx.fillStyle = '#e6edf3';
        else if (c.key === 'gift') ctx.fillStyle = g.giftable === 0 ? '#8b949e' : '#2ea043';
        else ctx.fillStyle = '#8b949e';
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
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export');
  marketImageCanvas(sections).toBlob(async (blob) => {
    if (!blob) return setExportStatus(statusEl, 'Image failed');
    // Prefer a clipboard copy (paste straight into Discord/forums); fall back to
    // a PNG download where the async Clipboard image API isn't available.
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        return setExportStatus(statusEl, 'Copied to clipboard');
      }
      throw new Error('clipboard unavailable');
    } catch {
      downloadBlob(blob, marketFilename('png'));
      setExportStatus(statusEl, 'Saved PNG');
    }
  }, 'image/png');
}

function renderInventory() {
  ensurePrices();
  updateSelectBar();
  layoutEl
    .querySelectorAll('button')
    .forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  if (!state.items.length) {
    setHTML(chipsEl, '');
    setHTML(resultsEl, '<div class="empty">No hangar data yet. Scan from the Home tab.</div>');
    return;
  }
  setHTML(
    chipsEl,
    `<div class="chip-row">${presentKinds().map(chipHtml).join('')}</div>` +
      traitRowHtml(state.items, state.traits, pledgeFacets, state.shown.size || state.traits.size),
  );
  const shown = computeShown();
  if (!shown.length) {
    setHTML(resultsEl, '<div class="empty">No pledges match the current filters.</div>');
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
  } · ${money(OH.totalValue(shown))}</div><div class="market-actions">${groupToggle}</div></div>`;
  if (!state.groupByType) {
    setHTML(
      resultsEl,
      head + `<div class="grid ${state.layout}">${shown.map(cardHtml).join('')}</div>`,
    );
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
// canvas locally; copied to the clipboard or saved as PNG, never uploaded.
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
    selectToggle.textContent = state.selecting ? 'Done selecting' : 'Select';
  }
  const n = state.selected.size;
  $('#sb-count').textContent = n ? `${n} selected` : 'Click items to select them';
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
  const C = {
    bg: '#0d1117',
    card: '#161b22',
    line: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    ph: '#21262d',
    good: '#3fb950',
    bad: '#f85149',
  };
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
  if (!list.length) return setExportStatus(status, 'Select some items first');
  if (list.length > 80) return setExportStatus(status, 'Pick 80 or fewer for one image');
  setExportStatus(status, 'Drawing…');
  const titleEl = $('#sb-title');
  const title = (titleEl.value || titleEl.placeholder || 'My hangar').trim();
  // In Market view the picture is the table itself (rows are easy to scan);
  // elsewhere it's the card layout.
  const inMarket = currentView() === 'inventory' && state.layout === 'market';
  const canvas = inMarket
    ? marketImageCanvas(computeMarketSections(marketExportShown()), { title })
    : await fleetImageCanvas(list, { title, price: state.imagePrice });
  canvas.toBlob(async (blob) => {
    if (!blob) return setExportStatus(status, 'Image failed');
    const who = (state.owner && (state.owner.nickname || state.owner.displayname)) || 'hangar';
    const filename = `open-hangar-fleet-${who}.png`.replace(/[^\w.-]+/g, '_');
    if (action === 'copy') {
      try {
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        return setExportStatus(status, 'Copied — paste it anywhere');
      } catch {
        /* fall through to a download */
      }
    }
    downloadBlob(blob, filename);
    setExportStatus(status, 'Saved PNG');
  }, 'image/png');
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
    else if (act === 'copy' || act === 'save') makeFleetImage(act);
  });
  $('#sb-price').addEventListener('change', (e) => {
    state.imagePrice = e.target.value;
  });
}

// --- Store: your CCUs + price list -----------------------------------------
// Light on purpose: chain planning is ccugame.app's job, we just show what
// your CCUs are worth at standard store prices. Ship list is state.catalog.
function ownedCCUs() {
  if (!state.priceOf) return [];
  const v = hangarValue();
  return state.items
    .filter((p) => p.isCCU && p.ccu)
    .map((p) => {
      const si = v && v.pledges[p.id];
      return {
        from: OH.htfShipName(p.ccu.from) || p.ccu.from,
        to: OH.htfShipName(p.ccu.to) || p.ccu.to,
        fromMsrp: si && si.from,
        toMsrp: si && si.to,
        paid: p.value,
      };
    })
    .filter((c) => c.fromMsrp && c.toMsrp);
}

const capFirst = (t) => String(t || '').replace(/^\w/, (c) => c.toUpperCase());

// One table per production state (flight ready first, then concepts, …).
const SHIP_STATES = [
  ['flight-ready', 'Flight ready'],
  ['in-production', 'In production'],
  ['in-concept', 'In concept'],
];
function priceRowsHtml(q) {
  const needle = q.trim().toLowerCase();
  const rows = (state.catalog || [])
    .filter((v) => v.msrp && (!needle || v.lname.includes(needle)))
    .sort((a, b) => (a.name || a.lname).localeCompare(b.name || b.lname));
  if (!rows.length) return '<p class="muted">No ships match.</p>';
  const known = new Set(SHIP_STATES.map(([k]) => k));
  const groups = SHIP_STATES.map(([k, label]) => [label, rows.filter((v) => v.status === k)]);
  groups.push(['Other', rows.filter((v) => !known.has(v.status))]);
  return groups
    .filter(([, list]) => list.length)
    .map(
      ([label, list]) =>
        `<h4 class="price-group">${label} <span class="muted">(${list.length})</span></h4>` +
        `<table class="org-table"><thead><tr><th>Ship</th><th class="num">Store price</th><th>Role</th><th>Size</th></tr></thead><tbody>${list
          .map(
            (v) =>
              `<tr><td>${OH.escapeHtml(v.name || v.lname)}</td><td class="num">${dollars(v.msrp)}</td><td>${OH.escapeHtml(
                v.role || '',
              )}</td><td>${OH.escapeHtml(capFirst(v.size))}</td></tr>`,
          )
          .join('')}</tbody></table>`,
    )
    .join('');
}

function renderStore() {
  ensurePrices();
  if (!state.catalog) {
    setHTML($('#price-table'), '<p class="muted">Loading ship prices…</p>');
    return;
  }
  setHTML($('#price-table'), priceRowsHtml($('#price-search').value));
  const owned = ownedCCUs();
  setHTML(
    $('#ccu-owned'),
    owned.length
      ? `<ul>${owned
          .map(
            (c) =>
              `<li>${OH.escapeHtml(c.from)} → ${OH.escapeHtml(c.to)}: worth ${dollars(
                c.toMsrp - c.fromMsrp,
              )}${Number.isFinite(c.paid) ? ` (you paid ${money(c.paid)})` : ''}</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">No CCUs with known prices in your hangar yet.</p>',
  );
}

$('#price-search')?.addEventListener('input', (e) =>
  setHTML($('#price-table'), priceRowsHtml(e.target.value)),
);

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
function upsertMember(name, ships) {
  const i = orgMembers.findIndex((m) => m.name.toLowerCase() === name.toLowerCase());
  const row = { name, importedAt: Date.now(), ships };
  if (i >= 0) orgMembers[i] = row;
  else orgMembers.push(row);
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
        <div class="bar-label">${OH.escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}</div>
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
  const chips = f.roles
    .map(
      (r) =>
        `<button type="button" class="role-chip ${r.count ? 'have' : 'missing'}${
          orgUi.role === r.key ? ' open' : ''
        }" data-role="${r.key}" aria-expanded="${orgUi.role === r.key}">${OH.escapeHtml(r.label)}${
          r.count ? ` <b>${r.count}</b>` : ''
        }</button>`,
    )
    .join('');
  return `<h3 class="section-title" style="margin-top:22px">Roles</h3>
    <p class="muted org-intro">${
      missing.length
        ? `No ships for: <strong>${missing.map((r) => OH.escapeHtml(r.label)).join(', ')}</strong>.`
        : 'Every role is covered.'
    } Click a role to see what fills it.</p>
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
          `<tr><td>${OH.escapeHtml(sh.name)}</td><td class="muted">${OH.escapeHtml(sh.role)}</td><td class="num">${
            sh.count
          }</td><td class="org-owners">${sh.owners
            .map((o) => OH.escapeHtml(o.n > 1 ? `${o.name} ×${o.n}` : o.name))
            .join(', ')}</td></tr>`,
      )
      .join('');
    return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(r.label)}</strong> · ${
      r.count
    } ship${r.count === 1 ? '' : 's'}<button type="button" class="org-close" data-close="role" aria-label="Close">×</button></div>
      <table class="org-table"><thead><tr><th>Ship</th><th>Role</th><th class="num">Count</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const options = (state.catalog || [])
    .filter((v) => v.role && def.re.test(v.role) && v.msrp)
    .sort((x, y) => x.msrp - y.msrp)
    .slice(0, 10)
    .map(
      (v) =>
        `<tr><td>${OH.escapeHtml(v.name || v.lname)}</td><td class="muted">${OH.escapeHtml(v.role)}</td><td class="muted">${OH.escapeHtml(
          v.status === 'flight-ready' ? 'Flight ready' : 'In concept',
        )}</td><td class="num">${dollars(v.msrp)}</td></tr>`,
    )
    .join('');
  return `<div class="org-panel"><div class="org-panel-head"><strong>${OH.escapeHtml(r.label)}</strong> · nobody has one yet<button type="button" class="org-close" data-close="role" aria-label="Close">×</button></div>
    ${
      options
        ? `<p class="muted org-intro">Ships that fill this role, cheapest first:</p><table class="org-table"><thead><tr><th>Ship</th><th>Role</th><th>Status</th><th class="num">Store price</th></tr></thead><tbody>${options}</tbody></table>`
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
      ? `<div class="org-compare-bar">Compare <select class="org-cmp" data-side="a"><option value="">pick a member</option>${opts(
          orgUi.a,
        )}</select> with <select class="org-cmp" data-side="b"><option value="">pick a member</option>${opts(orgUi.b)}</select></div>`
      : '';
  return `<h3 class="section-title" style="margin-top:22px">Members</h3>
    <p class="muted org-intro">Click a member to see their fleet next to the rest of the org.</p>
    <table class="org-table"><thead><tr><th>Member</th><th class="num">Ships</th><th class="num">LTI</th><th class="num">Fleet value</th><th class="num">Share</th></tr></thead><tbody>${rows}</tbody></table>
    ${orgMemberPanelHtml(f, members)}${compare}${orgComparePanelHtml(members)}`;
}

// Two-series bars: one row per key, `a` and `b` side by side.
function pairBarsHtml(mapA, mapB, labelA, labelB) {
  const keys = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort(
    (x, y) => (mapB[y] || 0) + (mapA[y] || 0) - ((mapB[x] || 0) + (mapA[x] || 0)),
  );
  const max = Math.max(1, ...keys.map((k) => Math.max(mapA[k] || 0, mapB[k] || 0)));
  const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  return `<div class="pair-legend"><span class="sw a"></span>${OH.escapeHtml(labelA)} <span class="sw b"></span>${OH.escapeHtml(
    labelB,
  )}</div>${keys
    .map(
      (
        k,
      ) => `<div class="pair-row"><div class="bar-label">${OH.escapeHtml(cap(k))}</div><div class="pair-bars">
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
        `<tr><td>${OH.escapeHtml(r.name)}</td><td>${OH.escapeHtml(r.size || '')}</td><td class="num">${
          r.count
        }</td><td class="num">${r.msrp ? dollars(r.msrp) : '—'}</td><td class="org-owners">${r.owners
          .map((o) => OH.escapeHtml(o.n > 1 ? `${o.name} ×${o.n}` : o.name))
          .join(', ')}</td></tr>`,
    )
    .join('');
  return `<h3 class="section-title" style="margin-top:22px">Biggest Ships</h3>
    <table class="org-table"><thead><tr><th>Ship</th><th>Size</th><th class="num">Count</th><th class="num">Store price</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function renderOrg() {
  ensurePrices();
  const body = $('#org-body');
  const members = await loadOrg();
  if (!members.length) {
    setHTML(
      body,
      '<div class="empty">No fleets yet. Import member files, or start with <strong>Add my fleet</strong>.</div>',
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
      `<table class="org-table"><thead><tr><th>Ship</th><th class="num">Count</th><th class="num">LTI</th><th class="num">Store price</th><th>Owners</th></tr></thead><tbody>${rows}</tbody></table>`,
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
  if (!state.items.length) return orgMsg('Scan your hangar first.');
  await loadOrg();
  const who = (state.owner && (state.owner.displayname || state.owner.nickname)) || 'Me';
  const r = OH.shipsFromFile({ sources: { hangar: { items: state.items } } });
  if (r.error) return orgMsg(r.error);
  upsertMember(who, r.ships);
  await saveOrg();
  orgMsg(`Added your fleet (${r.ships.length} ships).`);
  renderOrg();
});
$('#org-csv')?.addEventListener('click', async () => {
  const members = await loadOrg();
  if (!members.length || !state.shipOf) return orgMsg('Nothing to export yet.');
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
  orgMsg('Saved CSV.');
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

// Stats → Hangar value: ships at today's store price vs what you paid, best
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
          `vs what you paid${pct ? ` (${sign}${pct}%)` : ''}`,
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
    `<p class="muted value-note">Ships at current standalone store prices (USD, before tax) from star-citizen.wiki; a CCU's standard price is the gap between its two ships. Paints, gear and game access aren't counted; concept and limited ships often have no public price. "vs what you paid" covers ship pledges whose ships are all priced.</p>`
  );
}

// Stats → Melt candidates (OH.isMeltCandidate): biggest credit first.
function meltSectionHtml() {
  const v = hangarValue();
  if (!v) return '';
  const list = state.items
    .filter((p) => OH.isMeltCandidate(p, v.pledges[p.id]))
    .sort((a, b) => b.value - a.value);
  if (!list.length) return '';
  const total = list.reduce((a, p) => a + p.value, 0);
  const rows = list
    .slice(0, 15)
    .map(
      (p) =>
        `<div class="row"><div class="nm">${OH.escapeHtml(plainName(p))}</div><div class="vl">melt ${money(
          p.value,
        )} · store ${dollars(v.pledges[p.id].store)}</div></div>`,
    )
    .join('');
  const more =
    list.length > 15
      ? `<div class="row muted">+${list.length - 15} more — use the Melt candidates filter in Inventory</div>`
      : '';
  return (
    `<h3 class="section-title">Melt Candidates <span class="muted">${list.length} · ${money(total)} credit</span></h3>` +
    `<p class="muted value-note tight">Pledges you could melt and buy back for the same store credit: meltable, no LTI, nothing but ships inside, and you paid at least today's store price. Check the ship is on sale before melting — limited ships may not come back, and non-LTI insurance resets to the store's standard.</p>` +
    `<div class="top-list spaced">${rows}${more}</div>`
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
        <div class="bar-label">${OH.escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}</div>
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

// Melt value per snapshot as a small line chart (inline SVG, no chart lib).
function historySvg(hist) {
  const pts = hist.map((h) => ({ t: h.at, v: OH.snapshotMelt(h) }));
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
        `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${fmtDay(p.t)}: ${money(p.v)}</title></circle>`,
    )
    .join('');
  return `<svg class="hist-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Melt value over time">
    <text x="${L - 6}" y="${T + 8}" text-anchor="end">${dollars(vmax)}</text>
    <text x="${L - 6}" y="${H - B}" text-anchor="end">${dollars(vmin)}</text>
    <text x="${L}" y="${H - 4}">${fmtDay(t0)}</text>
    <text x="${W - R}" y="${H - 4}" text-anchor="end">${fmtDay(t1)}</text>
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2"/>${dots}
  </svg>`;
}

// Stats → History: melt value over time + a log of what changed per scan.
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
    `<h3 class="section-title" id="history">Melt Value Over Time</h3>` +
    historySvg(hist) +
    `<div class="hist-list">${steps.join('')}</div>` +
    `<p class="muted value-note">A snapshot is kept each time a full scan finds changes — ${hist.length} so far, up to the last 100.</p>`
  );
}

function renderStats() {
  ensurePrices();
  const body = $('#stats-body');
  if (!state.items.length) {
    setHTML(body, '<div class="empty">No hangar data yet. Scan from the Home tab.</div>');
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
    value: () => valueSectionHtml() + meltSectionHtml(),
    fleet: () =>
      fleetSectionHtml() ||
      `<p class="muted">${pricesLoading ? 'Loading ship data…' : 'Ship data unavailable (offline?).'}</p>`,
    collection: () => collectionSectionHtml(),
    buybacks: () => buybackStatsHtml(),
    top: () => topListsHtml(),
    history: () =>
      (historySectionHtml() ||
        '<p class="muted">History starts with your next scan — each scan that finds changes is kept here.</p>') +
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
      ]) => `<div class="bar-row"${title ? ` title="${OH.escapeHtml(title)}"` : ''}>
        <div class="bar-label">${OH.escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
        <div class="bar-val">${fmt(n)}</div>
      </div>`,
    )
    .join('');
}
const itemRow = (p, right) =>
  `<div class="row clickable" data-open-item="${OH.escapeHtml(String(p.id))}"><div class="nm">${OH.escapeHtml(
    plainName(p),
  )}</div><div class="vl">${right}</div></div>`;
const bbRow = (b, right) =>
  `<div class="row clickable" data-open-bb="${OH.escapeHtml(String(b.id))}"><div class="nm">${OH.escapeHtml(
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
    `<h3 class="section-title">Insurance</h3>${ins.length ? sBars(ins) : '<p class="muted">No insurance found in your pledges.</p>'}` +
    `<h3 class="section-title" style="margin-top:26px">Collection by Manufacturer</h3>` +
    `<p class="muted value-note tight">How many of each maker's ship models you own (out of the ones with a store price). Hover a row to see which.</p>` +
    (makers || '<p class="muted">No ships matched the ship list yet.</p>')
  );
}

function buybackStatsHtml() {
  const bbs = state.buybacks;
  if (!bbs.length) return '<p class="muted">No buy-backs yet. Scan from Home to include them.</p>';
  if (!state.priceOf) ensurePrices();
  const byKind = BB_KINDS.map((k) => [k.label, bbs.filter((b) => b.kind === k.key).length]).filter(
    (r) => r[1],
  );
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
    `<div class="top-list">${top.map(({ b, v }) => bbRow(b, (bbDetail(b) ? '' : '~') + dollars(v))).join('') || '<div class="row muted">No prices yet.</div>'}</div>` +
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
    `<p class="muted value-note">Click any row to open it. Savings compare what you paid with today's standard store price (warbonds, sales, CCU'd pledges).</p>`
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
    <button class="mk-btn" type="button" data-backup>Download backup</button>
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
  if (dated.length < 2) return '<p class="muted">Not enough dated recruits to chart yet.</p>';
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
      <span><span class="dot" style="background:#7ee787"></span>${recruits.toLocaleString('en-US')} recruits</span>
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
      const mark = isUnlocked ? '✓' : isNext ? '◷' : '🔒';
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
    : 'All tiers unlocked 🎉';
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
    event's bonus reward — once per event. The event list refreshes weekly from the Star Citizen wiki.</p>`;
  if (!earned.length) {
    return intro + '<p class="muted">No recruits converted during a tracked bonus event.</p>';
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
      const tip = `${t.at.toLocaleString('en-US')} recruits${t.rank ? ` · ${t.rank}` : ''}: ${rewardNames(t.items)}`;
      return `<div class="rt-step ${cls}" title="${OH.escapeHtml(tip)}"><span class="rt-dot"></span><span class="rt-at">${t.at.toLocaleString('en-US')}</span></div>`;
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
    : 'Every standard reward unlocked 🎉';
  const running = runningEvent();
  const eventPill = running
    ? `<div class="ref-hero-event">🎁 Bonus event on now: <strong>${OH.escapeHtml(running.name)}</strong>, until ${OH.escapeHtml(
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
        <label class="mk-toggle" title="Adds your referral code and a QR code people can scan"><input type="checkbox" id="ref-share-code"> Include my code</label>
        <button type="button" class="mk-btn" id="ref-share">Share image</button>
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
    return '<p class="muted">No rewards yet. Your first recruit unlocks the GCD-Army armor.</p>';
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
  if (!rows.length) return '<p class="muted">Your first milestone is 1 recruit.</p>';
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
  let speed = '<p class="muted">No recruits with both dates yet.</p>';
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
      <p class="muted ref-small">People who signed up with your code but haven't bought a game package yet. RSI doesn't share a way to contact them.</p></div>
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
    return `<div class="ref-event-banner live">🎁 <strong>${OH.escapeHtml(running.name)}</strong> is on until ${OH.escapeHtml(
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
  const byMonth = new Map();
  for (const d of dates) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + 1);
  const best = Math.max(0, ...byMonth.values());

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
  bg.addColorStop(0, '#0d1117');
  bg.addColorStop(1, '#131c2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  let y = PAD + 22;
  ctx.fillStyle = '#8b949e';
  ctx.font = f(600, 15);
  ctx.fillText(who ? `${who.toUpperCase()} · REFERRALS` : 'REFERRALS', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillText('Open Hangar', W - PAD, y);
  ctx.textAlign = 'left';

  y += 72;
  ctx.fillStyle = '#e6edf3';
  ctx.font = f(800, 72);
  const nText = recruits.toLocaleString('en-US');
  ctx.fillText(nText, PAD, y);
  const nW = ctx.measureText(nText).width;
  ctx.font = f(600, 24);
  ctx.fillStyle = '#8b949e';
  ctx.fillText(recruits === 1 ? 'recruit' : 'recruits', PAD + nW + 12, y);
  if (rank) {
    ctx.fillStyle = '#e3b341';
    ctx.font = f(700, 18);
    ctx.fillText(rank.toUpperCase(), PAD, y + 30);
  }

  // Progress to the next tier.
  y += rank ? 70 : 50;
  ctx.fillStyle = '#e6edf3';
  ctx.font = f(600, 17);
  const next = p.next
    ? `${(p.next.at - recruits).toLocaleString('en-US')} more to ${rewardNames(p.next.items)}`
    : 'Every standard reward unlocked';
  ctx.fillText(next, PAD, y);
  y += 14;
  const barW = W - PAD * 2;
  ctx.fillStyle = '#21262d';
  ctx.beginPath();
  ctx.roundRect(PAD, y, barW, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#3fb950';
  ctx.beginPath();
  ctx.roundRect(PAD, y, Math.max(14, barW * p.pct), 14, 7);
  ctx.fill();
  ctx.fillStyle = '#8b949e';
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
    [String(best), 'best month'],
  ];
  const boxW = (barW - 3 * 12) / 4;
  stats.forEach(([big, lbl], i) => {
    const x = PAD + i * (boxW + 12);
    ctx.fillStyle = '#161b22';
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 78, 10);
    ctx.fill();
    ctx.fillStyle = '#e6edf3';
    ctx.font = f(700, 26);
    ctx.fillText(big, x + 16, y + 38);
    ctx.fillStyle = '#8b949e';
    ctx.font = f(400, 13);
    ctx.fillText(lbl, x + 16, y + 62);
  });
  y += 78;

  // Ship rewards earned.
  if (ships.length) {
    y += 34;
    ctx.fillStyle = '#e6edf3';
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
      ctx.fillStyle = '#161b22';
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
      ctx.fillStyle = '#c9d1d9';
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
    ctx.fillStyle = '#e6edf3';
    ctx.font = f(700, 18);
    ctx.fillText(`Enlist with my code: ${ref.code}`, PAD, footY - 22);
    ctx.fillStyle = '#8b949e';
    ctx.font = f(400, 13);
    ctx.fillText(
      'Scan the QR code, or enter the code when you sign up at robertsspaceindustries.com',
      PAD,
      footY,
    );
  } else {
    ctx.fillStyle = '#8b949e';
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
  setExportStatus(status, 'Drawing…');
  const canvas = await referralShareCanvas({ withCode });
  canvas.toBlob(async (blob) => {
    if (!blob) return setExportStatus(status, 'Image failed');
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        return setExportStatus(status, 'Copied to clipboard');
      }
      throw new Error('clipboard unavailable');
    } catch {
      downloadBlob(blob, marketFilename('png').replace('sale-sheet', 'referrals'));
      setExportStatus(status, 'Saved PNG');
    }
  }, 'image/png');
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
      <p class="muted">No referral data yet. Click <strong>Scan</strong> on the Home page to pull
        your recruits and prospects from your
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
  const byMonth = new Map();
  for (const d of dates) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + 1);
  let best = null;
  for (const [k, n] of byMonth) if (!best || n > best.n) best = { k, n };
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
            ? `~${Math.round(months)} mo`
            : `~${(months / 12).toFixed(1)} yr`;
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
    box(best ? `${best.n}` : '—', best ? `best month (${best.k})` : 'best month') +
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
        <button class="ref-copy" data-copy="${OH.escapeHtml(ref.url || ref.code)}" title="Copy referral link">Copy link</button>
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
      <input id="ref-search" class="ref-search" type="search" placeholder="Search handle / moniker…" value="${OH.escapeHtml(state.refQuery)}" />
      <select id="ref-sort" class="ref-sort">
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
  // A CCU resolves art from its target ship; a plain buy-back from its own name.
  const resolve = b.ccu && b.ccu.to ? b.ccu.to : b.name; // also the broken-image fallback
  const thumb = img
    ? `<img class="thumb" loading="lazy" src="${OH.escapeHtml(img)}" alt="">`
    : `<div class="thumb placeholder">Buy-Back</div>`;
  const nameHtml = b.ccu
    ? `${OH.escapeHtml(b.ccu.from)} <span class="ccu-flow">→</span> ${OH.escapeHtml(b.ccu.to)}`
    : OH.escapeHtml(b.name || '—');
  const reclaim = buybackReclaimLink(b);
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(b.kind) ? b.kind : '';
  // Every cell is always emitted (empty when there's nothing) so the List view's
  // fixed column grid lines up across rows, as in the Inventory cards.
  return `<div class="card" data-id="${OH.escapeHtml(String(b.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}" data-rsi-image="${OH.escapeHtml(ccuArt ? realImage(b.image) || '' : '')}">
    ${thumb}
    <div class="card-body">
      <div class="card-name">${nameHtml}</div>
      <div class="card-contents">${OH.escapeHtml(b.contains || '')}</div>
      <div class="card-foot">
        <span class="foot-left"><span class="badge ${badgeClass}">${OH.escapeHtml(b.kind || 'buy-back')}</span></span>
        <span class="bb-date">${OH.escapeHtml(b.date || '')}</span>
        <span class="bb-end">${bbPriceHtml(b)}${reclaim}</span>
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
function tokenLineHtml() {
  const n = state.bbTokens;
  const next = nextTokenDate();
  const have =
    n == null
      ? 'Rescan to see your buy-back tokens.'
      : `You have <strong>${n}</strong> buy-back token${n === 1 ? '' : 's'}${
          n ? ' (one store-credit buy-back each)' : ''
        }.`;
  return `<div class="bb-tokens">${have} ${
    next ? `Next token: <strong>${OH.escapeHtml(next)}</strong>.` : 'RSI adds one each quarter.'
  } Tokens don't roll over, so use them all before the next one arrives. Cash buy-backs don't need a token.</div>`;
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
  const mins = Math.max(1, Math.round((need.length * 1.3) / 60));
  return `<div class="bb-details-bar">${have ? `${have} of ${list.length} have details. ` : ''}Insurance, real prices and pack contents come from each buy-back's own RSI page. <button type="button" class="mk-btn primary" id="bbd-load">Load details for ${need.length}</button> <span class="muted">(about ${mins} min, one page at a time; you can keep browsing)</span></div>`;
}
async function loadBuybackDetails() {
  const list = computeBuybacks().filter((b) => !b.isCCU && !state.bbDetails[b.id]);
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
  if (res.errors)
    setStatus(`Read ${res.done - res.errors} buy-back pages; ${res.errors} couldn't be read.`);
  if (currentView() === 'buybacks') renderBuybacks();
}

function computeBuybacks() {
  const q = state.bbQuery.trim().toLowerCase();
  // Same include-selection model as the inventory chips: empty = show all.
  let list = state.bbShown.size
    ? state.buybacks.filter((b) => state.bbShown.has(b.kind))
    : state.buybacks.slice();
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
      <p class="muted">Your melted pledges that you can re-acquire from RSI. Click
        <strong>Scan</strong> on the Home page to pull them in alongside your hangar.</p>
      <p class="muted">Buy-backs are read from
        <a href="https://robertsspaceindustries.com/account/buy-back-pledges" target="_blank" rel="noopener">RSI › Account › Buy-Back Pledges</a>
        — the same server-rendered pages as the hangar.</p>
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
    setHTML(
      bbChipsEl,
      `<div class="chip-row">${presentBbKinds().map(bbChipHtml).join('')}</div>` +
        traitRowHtml(
          state.buybacks,
          state.bbTraits,
          buybackFacets,
          state.bbShown.size || state.bbTraits.size,
        ),
    );
  }
  if (!state.priceOf) ensurePrices();
  const list = computeBuybacks();
  const when = state.buybacksScannedAt ? new Date(state.buybacksScannedAt).toLocaleString() : '';
  if (!list.length) {
    setHTML(body, '<div class="empty">No buy-backs match the current filters.</div>');
    return;
  }
  const count =
    tokenLineHtml() +
    bbDetailsBarHtml(list) +
    `<div class="result-count">Showing ${list.length} of ${state.buybacks.length}${when ? ` · scanned ${OH.escapeHtml(when)}` : ''}</div>`;
  // Market = a table like the Inventory Market (pick, total, price, export);
  // the other layouts reuse the shared card grid like the inventory.
  if (state.bbLayout === 'market') {
    setHTML(
      body,
      tokenLineHtml() +
        bbDetailsBarHtml(list) +
        bbToolbarHtml(list, when) +
        buybackMarketHtml(list),
    );
    return; // table has no thumbnails to enhance
  }
  setHTML(
    body,
    count + `<div class="grid ${state.bbLayout}">${list.map(buybackCardHtml).join('')}</div>`,
  );
  enhanceCardImages(body);
}

// Buy-back "Market": one reclaim table per kind (Ships, CCUs, Paints, …), with
// the columns a buy-back has — name, reclaim cost, quantity, and a reclaim link.
// Identical copies are stacked into one row with a Qty count, mirroring the
// inventory Market's per-category stacked tables.
function buybackName(b) {
  return b.ccu ? `${b.ccu.from} → ${b.ccu.to}` : b.name || '—';
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
function buybackReclaimLink(b) {
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
    ? `<span class="val est" title="Estimate: the ship's store price today. Load details for the real buy-back price.">~${dollars(sp)}</span>`
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
  return sp ? `~${dollars(sp)}` : '';
}

function buybackRowHtml(b) {
  const name = b.ccu
    ? `${OH.escapeHtml(b.ccu.from)} <span class="ccu-flow">→</span> ${OH.escapeHtml(b.ccu.to)}`
    : OH.escapeHtml(b.name || '—');
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
          <th>Items Name</th><th>Insurance</th><th title="RSI's buy-back price (after Load details); ~ = estimate from today's store price">Buy-Back Price</th>
          <th title="Today's standard store price (ships, or a CCU's price gap)">Store Price</th><th title="Store price minus the buy-back price (needs Load details)">vs Store</th>
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
  let est = false;
  for (const b of picked) {
    const d = bbDetail(b);
    const v = bbPrice(b);
    if (v) total += v;
    if (!d || d.price == null) est = true;
  }
  const n = picked.length;
  const tokens =
    state.bbTokens != null
      ? ` · ${n} token${n === 1 ? '' : 's'} with store credit (you have ${state.bbTokens})`
      : '';
  return ` · ${n} picked · ${est ? '~' : ''}${money(total)}${tokens}`;
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
      <button class="mk-btn bb-export-img" type="button">Copy image</button>
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
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export');
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
  setExportStatus(statusEl, 'Saved CSV');
}
const BB_IMG_COLS = [
  { key: 'name', label: 'Items Name' },
  { key: 'ins', label: 'Insurance' },
  { key: 'melt', label: 'Buy-Back Price' },
  { key: 'store', label: 'Store Price' },
  { key: 'vs', label: 'vs Store' },
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
  if (!sections.length) return setExportStatus(statusEl, 'Nothing to export');
  const canvas = marketImageCanvas(sections, { cols: BB_IMG_COLS, cellsOf: bbImageCells });
  canvas.toBlob(async (blob) => {
    if (!blob) return setExportStatus(statusEl, 'Image failed');
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        return setExportStatus(statusEl, 'Copied to clipboard');
      }
      throw new Error('clipboard unavailable');
    } catch {
      downloadBlob(blob, bbFilename('png'));
      setExportStatus(statusEl, 'Saved PNG');
    }
  }, 'image/png');
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

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  renderInventory();
});

sortEl.addEventListener('change', () => {
  state.sort = sortEl.value;
  renderInventory();
});

if (bbSearchEl) {
  bbSearchEl.addEventListener('input', () => {
    state.bbQuery = bbSearchEl.value;
    renderBuybacks();
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
    if (!btn) return;
    if (btn.dataset.clear) {
      state.bbShown.clear();
      state.bbTraits.clear();
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
  if (!url || !/media\.robertsspaceindustries\.com/.test(url)) return [];
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
  const item = e.target.closest('.reward-item.ship[data-image]');
  const img = item && item.dataset.image;
  if (!img) {
    if (previewId) hidePreview();
    return;
  }
  const key = 'reward:' + item.dataset.resolve;
  if (key !== previewId && itemPreviewImg) {
    previewId = key;
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
  const melt = OH.isMeltCandidate(p, si)
    ? row('Melt candidate', 'Yes — paid full price, no LTI or extras')
    : '';
  return row('Store price', v + parts) + melt;
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
    const im = document.createElement('img');
    im.className = 'modal-img';
    im.alt = '';
    slot.replaceWith(im);
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
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(p.kind) ? p.kind : '';
  const contents = p.contents || [];
  const contentsHtml = contents.length
    ? `<table class="modal-contents"><tbody>${contents
        .map(
          (c) =>
            `<tr><td>${OH.escapeHtml(contentKind(c))}</td><td>${OH.escapeHtml(c.label || '')}</td></tr>`,
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
      <div class="modal-meta"><span class="badge ${badgeClass}">${OH.escapeHtml(p.kind)}</span><span class="modal-val">${OH.escapeHtml(formatValue(p))}</span></div>
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
  itemModal.hidden = false;
  fillModalArt(real, resolveImageName(p), p.isCCU && !p.shipArt);
}
function closeItemModal() {
  itemModal.hidden = true;
  setHTML(modalBody, '');
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
      <div class="modal-meta"><span class="badge">buy-back</span>${bbPriceHtml(b) ? `<span class="modal-val">${bbPriceHtml(b)}</span>` : ''}</div>
      ${b.ccu ? row('Upgrade', OH.escapeHtml(`${b.ccu.from} → ${b.ccu.to}`)) : ''}
      ${b.isCCU ? '' : row('Insurance', OH.escapeHtml(bbInsurance(b)))}
      ${b.date ? row('Melted', OH.escapeHtml(b.date)) : ''}
      ${b.id ? row('Pledge ID', OH.escapeHtml(b.id)) : ''}
      ${url ? row('Reclaim', url) : ''}
      ${contents}
    </div>`,
  );
  itemModal.hidden = false;
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
  if (e.key === 'Escape' && !itemModal.hidden) closeItemModal();
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

// Copy referral link/code button (Citizen Card pill). Uses the clipboard API with
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
async function runScan({ hangar = true, buybacks = true, referrals = true } = {}) {
  if (!hangar && !buybacks && !referrals) return;
  scanBtn.disabled = true;
  if (scanSelectedBtn) scanSelectedBtn.disabled = true;
  setStatus('Scanning…');
  setScanning('Scanning…');
  const parts = [];
  let anyErr = false;

  if (hangar) {
    const h = await OH.scanSource('hangar', (page, c, retry) => {
      setStatus(
        retry
          ? `RSI hiccup on hangar page ${page} — retrying (${retry.attempt}/${retry.of})…`
          : `Scanning hangar… page ${page}, ${c} items`,
      );
      setScanning(retry ? `hangar… retrying` : `hangar… ${c}`);
    });
    if (h.ok) {
      state.items = h.items;
      state.scannedAt = h.scannedAt;
      state.history = await OH.getHistory();
      state.selected.clear();
      state.shown = new Set(); // default: no filter selected = show all
      state.traits = new Map();
      const acct = await OH.getAccount();
      if (acct.loggedIn && acct.nickname) {
        state.owner = { nickname: acct.nickname, displayname: acct.displayname || null };
      }
      parts.push(`${h.items.length} pledges${h.partial ? ` (partial: ${h.partial})` : ''}`);
      if (h.partial) anyErr = true;
    } else {
      parts.push(`hangar: ${h.error}`);
      anyErr = true;
    }
  }

  if (buybacks) {
    const b = await OH.scanSource('buybacks', (page, c, retry) => {
      setStatus(
        retry
          ? `RSI hiccup on buy-backs page ${page} — retrying (${retry.attempt}/${retry.of})…`
          : `Scanning buy-backs… page ${page}, ${c} items`,
      );
      setScanning(retry ? `buy-backs… retrying` : `buy-backs… ${c}`);
    });
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
  if (referrals) {
    const r = await OH.getReferral((phase, n) => {
      setStatus(`Scanning referrals — ${phase}… ${n}`);
      setScanning(`referrals ${phase}… ${n}`);
    });
    if (r?.ok) {
      state.referral = r.referral;
      parts.push(`${r.referral.legacy?.recruits ?? 0} recruits`);
    } else if (r) {
      parts.push(`referrals: ${r.error}`);
      anyErr = true;
    }
  }

  const summary = parts.join(' · ') || 'Nothing scanned';
  setStatus(summary, anyErr);
  setScanning(`${anyErr ? '⚠ ' : '✓ '}${summary}`, true);
  route();
  renderAccount(); // refresh the Citizen Card pill with the new referral counts
  scanBtn.disabled = false;
  if (scanSelectedBtn) scanSelectedBtn.disabled = false;
}

// Primary button scans everything; the caret opens a per-source menu.
scanBtn.addEventListener('click', () => runScan());

function closeScanMenu() {
  if (!scanMenu || scanMenu.hidden) return;
  scanMenu.hidden = true;
  if (scanMenuBtn) scanMenuBtn.setAttribute('aria-expanded', 'false');
}

if (scanMenuBtn && scanMenu) {
  scanMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let the document handler immediately re-close it
    const open = scanMenu.hidden;
    scanMenu.hidden = !open;
    scanMenuBtn.setAttribute('aria-expanded', String(open));
  });
  // Clicks inside the menu (toggling checkboxes) shouldn't close it.
  scanMenu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closeScanMenu);
}

if (scanSelectedBtn) {
  scanSelectedBtn.addEventListener('click', () => {
    const checked = new Set(
      [...document.querySelectorAll('.scan-src:checked')].map((el) => el.value),
    );
    if (!checked.size) {
      setStatus('Select at least one source to scan.', true);
      return;
    }
    closeScanMenu();
    runScan({
      hangar: checked.has('hangar'),
      buybacks: checked.has('buybacks'),
      referrals: checked.has('referrals'),
    });
  });
}

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  setStatus('Signing out of RSI…');
  const res = await OH.logout();
  if (!res.ok) {
    setStatus(res.error || 'Could not sign out of RSI.', true);
  } else {
    await OH.getAccount({ force: true }); // refresh the now signed-out state
    setStatus('Signed out of RSI.');
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
  setStatus('Local data cleared.');
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
      setDataMsg('Nothing to restore.', true);
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
      setDataMsg('No ships to export yet — scan your hangar first.');
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
      setDataMsg('Could not parse that file as JSON.', true);
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
      ? ` ${parked}'s data is saved and comes back when you sign in as them.`
      : '';
    return restored
      ? `Switched to ${who}: loaded your last scan.${kept}`
      : `Switched to ${who}. Hit Scan to load this account.${kept}`;
  }
  return '';
}

// Developers → Saved accounts: every account with data in this browser.
async function renderProfiles() {
  const box = $('#profiles');
  if (!box) return;
  const list = await OH.listProfiles();
  if (!list.length) {
    setHTML(box, '<p class="muted">No saved accounts yet. Scan to save one.</p>');
    return;
  }
  setHTML(
    box,
    list
      .map((p) => {
        const name = OH.escapeHtml(p.displayname || p.nickname);
        const when = p.scannedAt ? new Date(p.scannedAt).toLocaleDateString() : 'never scanned';
        const tail = p.active
          ? '<span class="badge ship">signed in</span>'
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

// Split a release's bullets into "New & improved" and "Fixed" (bullets that
// start with "Fixed"/"Fix:"), ccugame-changelog style.
function releaseGroupsHtml(items) {
  const isFix = (t) => /^(\*\*)?fix(ed)?\b/i.test(t);
  const groups = [
    ['new', 'New & improved', items.filter((t) => !isFix(t))],
    ['fixed', 'Fixed', items.filter(isFix)],
  ];
  return groups
    .filter(([, , list]) => list.length)
    .map(
      ([k, label, list]) =>
        `<span class="release-group g-${k}">${label}</span><ul>${list
          .map(
            (t) =>
              `<li>${OH.inlineMarkdown(capFirst(t.replace(/^(\*\*)?fix(ed)?\s*:?\s*/i, '$1')))}</li>`,
          )
          .join('')}</ul>`,
    )
    .join('');
}

// Updates page: "Check for updates". Chrome and Edge can ask their store right
// now (a found update downloads, then the Reload bar appears); Firefox only
// checks on its own schedule, so it gets directions to about:addons instead.
{
  const btn = $('#update-check-btn');
  const out = $('#update-check-status');
  const curEl = $('#update-cur');
  if (curEl) curEl.textContent = chrome.runtime.getManifest().version;
  btn?.addEventListener('click', async () => {
    // Looked up by name so Firefox's linter doesn't flag it (see initUpdates).
    const check = chrome.runtime[['request', 'Update', 'Check'].join('')];
    if (typeof check !== 'function') {
      out.textContent =
        'Firefox checks by itself. To check now, open about:addons, click the gear, then Check for Updates.';
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
            : "You're on the latest version.";
    } catch {
      out.textContent =
        "Couldn't check. Developer builds (loaded unpacked) don't update from the store.";
    }
    btn.disabled = false;
  });
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
  $('#update-text').textContent = `Open Hangar ${version} is ready. Reload to start using it.`;
  bar.hidden = false;
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
      `<span>Open Hangar updated to ${OH.escapeHtml(cur)}. <a href="#updates" data-view="updates">See what’s new</a></span><button type="button" class="note-close" aria-label="Dismiss">×</button>`,
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

// --- openhangar.space: connect + sync (optional) -----------------------------
let siteWait = null; // { stop, code } while waiting for the website to confirm
async function renderSiteLink() {
  const el = $('#site-link');
  if (!el) return;
  // Until the website is live, show "coming soon". Developers switch it on
  // by setting the `siteUrl` storage key (e.g. to http://localhost:4321).
  if (!(await OH.siteEnabled())) {
    setHTML(
      el,
      '<span class="tease">🚀 <strong>Something big is coming.</strong> Your hangar on any device, your org’s fleet live, and more. Stay tuned.</span>',
    );
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
    `<span class="ok">✓ Connected</span><span class="muted">${OH.escapeHtml(link.name || 'openhangar.space')} · ${OH.escapeHtml(when)}</span><button type="button" data-site="sync">Sync now</button><button type="button" class="btn-secondary" data-site="open">Open</button><button type="button" class="btn-secondary" data-site="disconnect">Disconnect</button>`,
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

$('#stats-body')?.addEventListener('click', (e) => {
  const it = e.target.closest('[data-open-item]');
  if (it) {
    const p = state.items.find((x) => String(x.id) === it.dataset.openItem);
    if (p) openItemModal(p);
    return;
  }
  const bb = e.target.closest('[data-open-bb]');
  if (bb) {
    const b = state.buybacks.find((x) => String(x.id) === bb.dataset.openBb);
    if (b) openBuybackModal(b);
  }
});

// --- Init -----------------------------------------------------------------

(async () => {
  const {
    uiLayout,
    bbLayout,
    marketAnnotations,
    uiStatsTab,
    lastBackupAt,
    remindRescan,
    currency,
    uiGroupByType,
  } = await chrome.storage.local.get([
    'currency',
    'uiGroupByType',
    'remindRescan',
    'lastBackupAt',
    'uiStatsTab',
    'uiLayout',
    'bbLayout',
    'marketAnnotations',
  ]);
  if (LAYOUTS.includes(uiLayout)) state.layout = uiLayout;
  if (uiGroupByType === false) state.groupByType = false;
  if (STATS_TABS.some(([k]) => k === uiStatsTab)) state.statsTab = uiStatsTab;
  if (Number.isFinite(lastBackupAt)) state.lastBackupAt = lastBackupAt;
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
  renderSiteLink();
  if (currency && currency !== 'USD') {
    const sel = $('#currency-select');
    if (sel) sel.value = currency;
    applyCurrency(currency);
  }
})();
