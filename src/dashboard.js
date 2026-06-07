/*
 * dashboard.js — the full-page hangar hub (multi-view app).
 * Views: Home (with the About panel), Inventory (fleet gallery), Stats,
 * Buy-Backs, Store Data. Routed by URL hash so views can be linked/bookmarked.
 * Reads the scan from local storage; scanning goes through lib.js (cookie'd
 * fetch, no tab needed).
 */

const $ = (sel) => document.querySelector(sel);
const VIEWS = ['home', 'inventory', 'buybacks', 'stats', 'referrals', 'store', 'developers'];

const statusEl = $('#status');
const scannedHomeEl = $('#scanned-home');
const chipsEl = $('#chips');
const resultsEl = $('#results');
const scanBtn = $('#scan-home');
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

// Buy-back kind labels (buy-backs classify into a slightly different set than
// the hangar — notably 'paint'). Order = display order.
const BB_KINDS = [
  { key: 'ship', label: 'Ships' },
  { key: 'ccu', label: 'CCUs' },
  { key: 'paint', label: 'Paints' },
  { key: 'addon', label: 'Add-ons' },
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
  { at: 100, items: [{ n: 'Freelancer Paint Pack (4 paints)' }] },
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

// Time-limited "special incentive" events: a recruit who CONVERTS (buys a game
// package, spending the threshold) inside one of these windows earns a bonus
// reward for both you and them. STATIC reference data from
// starcitizen.tools/Referral_program (May 2026) — best-effort and will go stale as
// CIG adds events; keep updated. Dates are inclusive [start, end]. We match a
// recruit's convertedOn against these to surface "you earned this event reward".
const REFERRAL_EVENTS = [
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
    reward: 'HoverQuad (Lovestruck paint, LTI)',
  },
];

// Community links — fill these in (footer + Developers page use them).
// Until set, a "soon" placeholder shows instead of a broken link.
const REPO_URL = 'https://github.com/Draco-Foundry/open-hangar';
const DISCORD_URL = 'https://discord.gg/FF8Wm5HdnV';

// Supporters shown on the Developers page. Each entry is { name, url? }.
// Empty arrays render a friendly placeholder. When the GitHub repo is public
// these could be replaced by a live contributors-API fetch (see ROADMAP); kept
// static for now to avoid an extra network call.
const CONTRIBUTORS = [];
const BOOSTERS = [];

const LAYOUTS = ['gallery', 'compact', 'list'];

const state = {
  items: [],
  scannedAt: null,
  buybacks: [], // buy-back pledges (separate source)
  buybacksScannedAt: null,
  bbQuery: '',
  bbSort: 'default',
  bbShown: new Set(), // buy-back kind filter
  owner: null, // { nickname, displayname } the stored data was scanned from
  shown: new Set(), // inventory kind filter
  query: '',
  sort: 'default',
  layout: 'gallery', // gallery | compact | list
  referral: null, // { code, url, current, legacy, prospects, recruitsList, prospectsList }
  refTab: 'recruits', // referral list tab: 'recruits' | 'prospects'
  refQuery: '', // referral list search
  refSort: 'newest', // referral list sort: newest | oldest | name
};

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

// Global scan indicator in the header — visible from every view (the scan keeps
// running across view switches since this is a single page). `done` shows a
// final tick/warn that auto-hides; falsy text hides it immediately.
let scanIndicatorTimer = null;
function setScanning(text, done = false) {
  if (!scanIndicator) return;
  clearTimeout(scanIndicatorTimer);
  if (!text) {
    scanIndicator.hidden = true;
    scanIndicator.innerHTML = '';
    return;
  }
  scanIndicator.innerHTML =
    (done ? '' : '<span class="spin"></span>') + `<span>${OH.escapeHtml(text)}</span>`;
  scanIndicator.hidden = false;
  if (done) {
    scanIndicatorTimer = setTimeout(() => {
      scanIndicator.hidden = true;
      scanIndicator.innerHTML = '';
    }, 6000);
  }
}

const money = (n) => '$' + n.toFixed(2);

function formatValue(p) {
  if (!Number.isFinite(p.value)) return '';
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
  // 'store' is static markup; About now lives on Home.
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
function realImage(url) {
  return url && !DEFAULT_IMG_RE.test(url) ? url : null;
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
      const url = await OH.getShipImage(card.dataset.resolve);
      if (!url) continue;
      card.dataset.image = url;
      const id = card.dataset.id;
      const item =
        state.items.find((p) => String(p.id) === id) ||
        state.buybacks.find((b) => String(b.id) === id);
      if (item) item.image = url;
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
    // `null` (couldn't tell) keeps the normal card so a transient error doesn't
    // lock out a signed-in user.
    const loggedOut = a.loggedIn === false;
    const acctEl = $('#cc-account'),
      sideEl = $('#cc-side'),
      loEl = $('#cc-loggedout');
    if (acctEl) acctEl.hidden = loggedOut;
    if (sideEl) sideEl.hidden = loggedOut;
    if (loEl) loEl.hidden = !loggedOut;
    if (logoutBtn) logoutBtn.hidden = a.loggedIn !== true;

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
        metaEl.innerHTML =
          `<span class="cc-meta-line">UEE ${OH.escapeHtml(a.citizenRecord || DASH)}</span>` +
          `<span class="cc-meta-line">Enlisted ${OH.escapeHtml(fmtEnlisted(a.enlistedSince))}</span>`;
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
        orgEl.innerHTML = org.sid
          ? `<a class="cc-org-link" href="https://robertsspaceindustries.com/orgs/${encodeURIComponent(org.sid)}" target="_blank" rel="noopener">${inner}</a>`
          : `<span class="cc-org-link">${inner}</span>`;
        orgEl.hidden = false;
      } else if (a.loggedIn) {
        orgEl.innerHTML = `<span class="cc-org-link cc-org-none"><span class="cc-org-logo cc-org-logo-ph"></span><span class="cc-org-text"><span class="cc-org-name">No affiliation</span></span></span>`;
        orgEl.hidden = false;
      } else {
        orgEl.innerHTML = '';
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
      flairEl.innerHTML = parts.join('');
    }

    // Balances — always rendered, with dashes when there's no data (uniform).
    if (balEl) {
      const c = a.credits || {};
      const fmt = (n) => Number(n).toLocaleString('en-US');
      const pill = (cls, label, val) =>
        `<span class="bal ${cls}"><span class="bal-lbl">${label}</span> <b>${val}</b></span>`;
      balEl.innerHTML =
        pill(
          'store',
          'Store Credit',
          c.store
            ? '$' +
                (c.store.value / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
            : DASH,
        ) +
        pill('uec', 'UEC', c.uec ? '¤' + fmt(c.uec.value) : DASH) +
        pill('rec', 'REC', c.rec ? '¤' + fmt(c.rec.value) : DASH);
    }

    renderReferralPill(a);
  });
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
    el.innerHTML = '';
    return;
  }
  const recruits = ref?.legacy?.recruits ?? ref?.current?.recruits ?? null;
  const url = ref?.url || a?.referral?.url || null;
  const countPart =
    recruits != null
      ? `<span class="bal-lbl">Referrals</span> <b>${recruits.toLocaleString('en-US')}</b> recruits`
      : `<span class="bal-lbl">Referral code</span>`;
  el.innerHTML = `<span class="ref-pill">${countPart}
      <span class="ref-code">${OH.escapeHtml(code)}</span>
      <button class="ref-copy" data-copy="${OH.escapeHtml(url || code)}" title="Copy referral link">Copy</button>
    </span>`;
}

function renderVersions() {
  const el = $('#versions');
  if (!el) return;
  const ext = chrome.runtime.getManifest().version;
  // Open Hangar → GitHub releases (once the repo URL is set), else plain text.
  const oh = REPO_URL
    ? `<a href="${REPO_URL}/releases" target="_blank" rel="noopener">Open Hangar v${ext}</a>`
    : `Open Hangar v${ext}`;
  el.innerHTML = `${oh} · Star Citizen …`;
  OH.getScVersion().then((v) => {
    let sc = 'Star Citizen n/a';
    if (v.code) {
      const label = OH.formatScVersion(v.code); // e.g. "4.8.0-LIVE"
      const semver = (v.code.match(/(\d+\.\d+(?:\.\d+)?)/) || [])[1]; // e.g. "4.8.0"
      sc = semver
        ? `<a href="https://starcitizen.tools/Star_Citizen_Alpha_${semver}" target="_blank" rel="noopener">Star Citizen ${label}</a>`
        : `Star Citizen ${label}`;
    }
    el.innerHTML = `${oh} · ${sc}`;
  });
}

function renderHome() {
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
    sum.innerHTML =
      box(state.items.length, 'pledges') +
      box(money(OH.totalValue(state.items)), 'fleet value') +
      box(ships, 'ships') +
      box(count('ccu'), 'CCUs') +
      (count('paint') ? box(count('paint'), 'paints') : '') +
      box(count('addon'), 'add-ons') +
      (state.buybacks.length ? box(state.buybacks.length, 'buy-backs') : '');
  } else {
    sum.innerHTML = '';
  }

  // Scanned line: first-run prompt (#2) or scan freshness with a stale nudge (#5).
  if (!has) {
    scannedHomeEl.textContent = 'Nothing scanned yet — click Scan to begin.';
    return;
  }
  const when = state.scannedAt ? new Date(state.scannedAt).toLocaleString() : 'previously';
  const ageDays = state.scannedAt ? (Date.now() - state.scannedAt) / 86400000 : 0;
  if (ageDays > 7) {
    scannedHomeEl.innerHTML = `Scanned ${OH.escapeHtml(when)} — <span class="stale">over a week old, consider rescanning</span>`;
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
  $('#footer').innerHTML = `${gh} · ${dc} · MIT License · v${v}`;
  const dev = $('#dev-links');
  if (dev) dev.innerHTML = link(REPO_URL, 'GitHub') + link(DISCORD_URL, 'Discord');
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
    c.innerHTML = CONTRIBUTORS.length
      ? CONTRIBUTORS.map((s) => chip(s)).join('')
      : `<span class="muted">Be the first — ${link(REPO_URL, 'contributions welcome')}.</span>`;
  }
  const b = $('#sup-boosters');
  if (b) {
    b.innerHTML = BOOSTERS.length
      ? BOOSTERS.map((s) => chip(s, 'booster')).join('')
      : `<span class="muted">Boosters will be thanked here — ${link(DISCORD_URL, 'join the Discord')}.</span>`;
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
  let list = state.items.filter((p) => state.shown.has(p.kind));
  if (q) list = list.filter((p) => haystack(p).includes(q));
  if (state.sort !== 'default') {
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    list = list.slice().sort((a, b) => {
      switch (state.sort) {
        case 'value-desc':
          return cmpValue(a, b, -1);
        case 'value-asc':
          return cmpValue(a, b, 1);
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

function chipHtml(kind) {
  const n = state.items.filter((p) => p.kind === kind.key).length;
  return `<button class="chip k-${kind.key}" data-key="${kind.key}" aria-pressed="${state.shown.has(
    kind.key,
  )}">${OH.escapeHtml(kind.label)}<span class="n">${n}</span></button>`;
}

function cardHtml(p) {
  const contents = (p.contents || []).map((c) => c.label || c.kind).filter(Boolean);
  const img = realImage(p.image);
  const resolve = img ? '' : resolveImageName(p); // ship name to fetch art for
  const thumb = img
    ? `<img class="thumb" loading="lazy" data-kind="${p.kind}" src="${OH.escapeHtml(img)}" alt="">`
    : `<div class="thumb placeholder">${OH.escapeHtml(p.kind)}</div>`;
  const nameHtml =
    p.isCCU && p.ccu
      ? `${OH.escapeHtml(p.ccu.from)} <span class="ccu-flow">→</span> ${OH.escapeHtml(p.ccu.to)}`
      : OH.escapeHtml(p.name || '—');
  let contentsLine = '';
  if (!p.isCCU && contents.length) {
    const head = contents.slice(0, 4).join(' · ');
    const more = contents.length > 4 ? ` +${contents.length - 4}` : '';
    contentsLine = `<div class="card-contents">${OH.escapeHtml(head)}${more}</div>`;
  }
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(p.kind) ? p.kind : '';
  return `<div class="card" data-id="${OH.escapeHtml(String(p.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}">
    ${thumb}
    <div class="card-body">
      <div class="card-name">${nameHtml}</div>
      ${contentsLine}
      <div class="card-foot">
        <span class="badge ${badgeClass}">${OH.escapeHtml(p.kind)}</span>
        <span class="val">${OH.escapeHtml(formatValue(p))}</span>
      </div>
    </div>
  </div>`;
}

function renderInventory() {
  layoutEl
    .querySelectorAll('button')
    .forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  if (!state.items.length) {
    chipsEl.innerHTML = '';
    resultsEl.innerHTML = '<div class="empty">No hangar data yet. Scan from the Home tab.</div>';
    return;
  }
  chipsEl.innerHTML = presentKinds().map(chipHtml).join('');
  const shown = computeShown();
  if (!shown.length) {
    resultsEl.innerHTML = '<div class="empty">No pledges match the current filters.</div>';
    return;
  }
  resultsEl.innerHTML =
    `<div class="result-count">Showing ${shown.length} of ${state.items.length} · ${money(OH.totalValue(shown))}</div>` +
    `<div class="grid ${state.layout}">${shown.map(cardHtml).join('')}</div>`;
  enhanceCardImages(resultsEl);
}

// --- Stats ----------------------------------------------------------------

function renderStats() {
  const body = $('#stats-body');
  if (!state.items.length) {
    body.innerHTML = '<div class="empty">No hangar data yet. Scan from the Home tab.</div>';
    return;
  }
  const items = state.items;
  const count = (k) => items.filter((p) => p.kind === k).length;
  const ships = items.filter((p) => p.containsShip).length;

  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const stats =
    box(items.length, 'pledges') +
    box(money(OH.totalValue(items)), 'total value') +
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

  body.innerHTML =
    `<div class="stat-grid">${stats}</div>` +
    `<h3 class="section-title">By category</h3>${bars}` +
    `<h3 class="section-title" style="margin-top:26px">Top pledges by value</h3>` +
    `<div class="top-list">${topRows || '<div class="row muted">No priced pledges.</div>'}</div>`;
}

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
  for (const ev of REFERRAL_EVENTS) {
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
    event's bonus reward — once per event. Best-effort; may not include the newest events.</p>`;
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
      const link = r.handle
        ? `<a href="https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener">${OH.escapeHtml(handle)}</a>`
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
  if (tbody) tbody.innerHTML = refListRows();
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

function renderReferrals() {
  const body = $('#referrals-body');
  if (!body) return;
  const ref = state.referral;

  // Not signed in / never scanned → a friendly prompt instead of a blank page.
  if (!ref) {
    body.innerHTML = `<div class="placeholder-view">
      <p class="muted">No referral data yet. Click <strong>Scan</strong> on the Home page to pull
        your recruits and prospects from your
        <a href="https://robertsspaceindustries.com/en/referral" target="_blank" rel="noopener">RSI Referral Rewards</a> page.</p>
    </div>`;
    return;
  }

  const box = (big, lbl, cls = '') =>
    `<div class="stat-box ${cls}"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const recruitsRows = ref.recruitsList || [];
  const recruits = ref.legacy?.recruits ?? 0; // all-time recruit total
  const prospects = ref.prospects ?? 0;
  const total = prospects + recruits; // everyone who used your code (signed up or converted)

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

  // Prospect funnel: pending (never converted) + oldest pending age.
  const pending = prospectsList.length;
  const pendingAges = prospectsList
    .map((p) => {
      const e = parseTs(p.enlistedOn);
      return e ? (now - e) / DAY : null;
    })
    .filter((x) => x != null);
  const oldestPending = pendingAges.length ? Math.max(...pendingAges) : null;
  const fmtAge = (days) =>
    days == null ? '—' : days >= 365 ? `${(days / 365).toFixed(1)}y` : `${Math.round(days)}d`;

  const latest = dates.length
    ? new Date(Math.max(...dates)).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

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
    box(fmtAge(oldestPending), 'oldest pending') +
    box(best ? `${best.n}` : '—', best ? `best month (${best.k})` : 'best month') +
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

  body.innerHTML = `
    ${code}

    <div class="stat-group-label">Overview</div>
    <div class="stat-grid ref-totals">${overview}</div>

    <div class="stat-group-label">Recent activity</div>
    <div class="stat-grid">${activity}</div>

    <div class="stat-group-label">Pipeline &amp; progress</div>
    <div class="stat-grid">${pipeline}</div>

    <h3 class="section-title" style="margin-top:26px">Trends</h3>
    <div class="ref-charts">
      <div class="ref-chart"><h4>Recruits over time (cumulative · monthly)</h4>${recruitsOverTimeSvg(recruitsRows)}</div>
      <div class="ref-chart"><h4>Prospect → recruit conversion</h4>${conversionHtml(ref)}</div>
    </div>
    <div class="stat-group-label">Recruits by year</div>
    ${recruitsByYearHtml(recruitsRows)}

    <h3 class="section-title" style="margin-top:26px">Tier rewards</h3>
    ${rewardsHtml(ref)}

    <h3 class="section-title" style="margin-top:26px">Event bonuses</h3>
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
    </div>`;

  renderRefList(); // fills #ref-count
  enhanceRewardImages(body); // lazily resolve ship art for reward-item hovers
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

function buybackUrl(b) {
  if (!b.href) return '';
  return b.href.startsWith('http') ? b.href : 'https://robertsspaceindustries.com' + b.href;
}

function buybackCardHtml(b) {
  const img = realImage(b.image);
  // A CCU resolves art from its target ship; a plain buy-back from its own name.
  const resolve = img ? '' : b.ccu && b.ccu.to ? b.ccu.to : b.name;
  const thumb = img
    ? `<img class="thumb" loading="lazy" src="${OH.escapeHtml(img)}" alt="">`
    : `<div class="thumb placeholder">Buy-Back</div>`;
  const nameHtml = b.ccu
    ? `${OH.escapeHtml(b.ccu.from)} <span class="ccu-flow">→</span> ${OH.escapeHtml(b.ccu.to)}`
    : OH.escapeHtml(b.name || '—');
  const url = buybackUrl(b);
  const reclaim = url
    ? `<a class="bb-reclaim" href="${OH.escapeHtml(url)}" target="_blank" rel="noopener">Reclaim ↗</a>`
    : '';
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(b.kind) ? b.kind : '';
  return `<div class="card" data-id="${OH.escapeHtml(String(b.id || ''))}" data-image="${OH.escapeHtml(img || '')}" data-resolve="${OH.escapeHtml(resolve)}">
    ${thumb}
    <div class="card-body">
      <div class="card-name">${nameHtml}</div>
      ${b.contains ? `<div class="card-contents">${OH.escapeHtml(b.contains)}</div>` : ''}
      <div class="card-foot">
        <span class="badge ${badgeClass}">${OH.escapeHtml(b.kind || 'buy-back')}</span>
        ${b.date ? `<span class="bb-date">${OH.escapeHtml(b.date)}</span>` : ''}
        ${b.price ? `<span class="val">${OH.escapeHtml(b.price)}</span>` : ''}
        ${reclaim}
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
  return `<button class="chip k-${kind.key}" data-key="${kind.key}" aria-pressed="${state.bbShown.has(
    kind.key,
  )}">${OH.escapeHtml(kind.label)}<span class="n">${n}</span></button>`;
}

function computeBuybacks() {
  const q = state.bbQuery.trim().toLowerCase();
  let list = state.buybacks.filter((b) => state.bbShown.has(b.kind));
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
    body.innerHTML = `<div class="placeholder-view">
      <h2>Buy-back pledges</h2>
      <p class="muted">Your melted pledges that you can re-acquire from RSI. Click
        <strong>Scan</strong> on the Home page to pull them in alongside your hangar.</p>
      <p class="muted">Buy-backs are read from
        <a href="https://robertsspaceindustries.com/account/buy-back-pledges" target="_blank" rel="noopener">RSI › Account › Buy-Back Pledges</a>
        — the same server-rendered pages as the hangar.</p>
    </div>`;
    return;
  }
  if (controls) controls.hidden = false;
  if (bbChipsEl) bbChipsEl.innerHTML = presentBbKinds().map(bbChipHtml).join('');
  const list = computeBuybacks();
  const when = state.buybacksScannedAt ? new Date(state.buybacksScannedAt).toLocaleString() : '';
  if (!list.length) {
    body.innerHTML = '<div class="empty">No buy-backs match the current filters.</div>';
    return;
  }
  body.innerHTML =
    `<div class="result-count">Showing ${list.length} of ${state.buybacks.length}${when ? ` · scanned ${OH.escapeHtml(when)}` : ''}</div>` +
    `<div class="grid">${list.map(buybackCardHtml).join('')}</div>`;
  enhanceCardImages(body);
}

// --- Events ---------------------------------------------------------------

chipsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const key = btn.dataset.key;
  if (state.shown.has(key)) state.shown.delete(key);
  else state.shown.add(key);
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
    const key = btn.dataset.key;
    if (state.bbShown.has(key)) state.bbShown.delete(key);
    else state.bbShown.add(key);
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
function onThumbError(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.classList.contains('thumb')) return;
  const ph = document.createElement('div');
  ph.className = 'thumb placeholder';
  ph.textContent = img.dataset.kind || '';
  img.replaceWith(ph);
}
resultsEl.addEventListener('error', onThumbError, true);
if (buybacksBodyEl) buybacksBodyEl.addEventListener('error', onThumbError, true);

// --- Inventory: hover preview + click detail modal ------------------------
const itemPreview = $('#item-preview');
const itemPreviewImg = itemPreview ? itemPreview.querySelector('img') : null;
const itemModal = $('#item-modal');
const modalBody = $('#modal-body');
const modalClose = $('#modal-close');
let previewId = null;
let previewTimer = null;

// RSI media thumbnails are tiny (~216px); swap the variant for the full-res
// "source" image. Falls back to the original if "source" doesn't exist.
function hiRes(url) {
  if (!url || !/media\.robertsspaceindustries\.com/.test(url)) return url;
  if (/\/source\.\w+(\?|$)/.test(url)) return url; // already full-res (e.g. wiki source.png)
  // RSI media: swap the size variant (store_small.jpg, slideshow.jpg, …) for the
  // full-res source.jpg. Covers both hangar thumbnails and ship-matrix images.
  return url.replace(/\/[^/?]+(\?.*)?$/, '/source.jpg$1');
}

function hidePreview() {
  clearTimeout(previewTimer);
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
function onCardMouseMove(e) {
  const card = e.target.closest('.card');
  const img = card && card.dataset.image;
  if (!img) {
    if (previewId) hidePreview();
    return;
  }
  if (card.dataset.id !== previewId && itemPreviewImg) {
    const id = card.dataset.id;
    previewId = id;
    clearTimeout(previewTimer);
    itemPreviewImg.src = img; // instant: the already-cached thumbnail
    itemPreview.classList.add('show');
    const hi = hiRes(img);
    if (hi !== img) {
      // upgrade to full-res after a brief dwell
      previewTimer = setTimeout(() => {
        const probe = new Image();
        probe.onload = () => {
          if (previewId === id) itemPreviewImg.src = hi;
        };
        probe.src = hi; // 404 → onload never fires, thumbnail stays
      }, 180);
    }
  }
  positionPreview(e.clientX, e.clientY);
}
resultsEl.addEventListener('mousemove', onCardMouseMove);
resultsEl.addEventListener('mouseleave', hidePreview);
if (buybacksBodyEl) {
  buybacksBodyEl.addEventListener('mousemove', onCardMouseMove);
  buybacksBodyEl.addEventListener('mouseleave', hidePreview);
}

// Hover preview for reward items (ship art). Keyed on the item's resolve name since
// these links have no id. Reuses the same #item-preview popup as inventory cards.
// (Listeners are attached where referralsBodyEl is defined, below.)
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
    clearTimeout(previewTimer);
    itemPreviewImg.src = img;
    itemPreview.classList.add('show');
    const hi = hiRes(img);
    if (hi !== img) {
      previewTimer = setTimeout(() => {
        const probe = new Image();
        probe.onload = () => {
          if (previewId === key) itemPreviewImg.src = hi;
        };
        probe.src = hi;
      }, 180);
    }
  }
  positionPreview(e.clientX, e.clientY);
}

function fmtScan() {
  return state.scannedAt ? new Date(state.scannedAt).toLocaleString() : '—';
}
function openItemModal(p) {
  hidePreview();
  const real = realImage(p.image);
  const img = real
    ? `<img class="modal-img" src="${OH.escapeHtml(hiRes(real))}" alt="">`
    : `<div class="modal-img placeholder">${OH.escapeHtml(p.kind)}</div>`;
  const badgeClass = ['ccu', 'ship', 'paint', 'addon', 'coupon'].includes(p.kind) ? p.kind : '';
  const contents = p.contents || [];
  const contentsHtml = contents.length
    ? `<table class="modal-contents"><tbody>${contents
        .map(
          (c) =>
            `<tr><td>${OH.escapeHtml(c.kind || '—')}</td><td>${OH.escapeHtml(c.label || '')}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="muted">No itemized contents.</p>';
  const row = (k, v) =>
    `<div class="mr"><span class="mr-k">${k}</span><span class="mr-v">${v}</span></div>`;
  modalBody.innerHTML =
    img +
    `<div class="modal-info">
      <h3 class="modal-name">${OH.escapeHtml(plainName(p))}</h3>
      <div class="modal-meta"><span class="badge ${badgeClass}">${OH.escapeHtml(p.kind)}</span><span class="modal-val">${OH.escapeHtml(formatValue(p))}</span></div>
      ${row('ID', OH.escapeHtml(p.id || '—'))}
      ${p.currency ? row('Currency', OH.escapeHtml(p.currency)) : ''}
      ${p.isCCU && p.ccu ? row('Upgrade', OH.escapeHtml(`${p.ccu.from} → ${p.ccu.to}`)) : ''}
      ${row('Scanned', OH.escapeHtml(fmtScan()))}
      <h4 class="modal-h">Contents (${contents.length})</h4>
      ${contentsHtml}
    </div>`;
  itemModal.hidden = false;
  // If the full-res "source" image 404s, fall back to the thumbnail.
  const mimg = modalBody.querySelector('img.modal-img');
  if (mimg && p.image) {
    mimg.addEventListener(
      'error',
      () => {
        if (!mimg.src.endsWith(p.image)) mimg.src = p.image;
      },
      { once: true },
    );
  }
}
function closeItemModal() {
  itemModal.hidden = true;
  modalBody.innerHTML = '';
}

// Buy-back detail modal (reuses the inventory modal shell).
function openBuybackModal(b) {
  hidePreview();
  const img = realImage(b.image)
    ? `<img class="modal-img" src="${OH.escapeHtml(hiRes(b.image))}" alt="">`
    : `<div class="modal-img placeholder">Buy-Back</div>`;
  const url = b.href
    ? b.href.startsWith('http')
      ? b.href
      : 'https://robertsspaceindustries.com' + b.href
    : '';
  const row = (k, v) =>
    `<div class="mr"><span class="mr-k">${k}</span><span class="mr-v">${v}</span></div>`;
  modalBody.innerHTML =
    img +
    `<div class="modal-info">
      <h3 class="modal-name">${b.ccu ? `${OH.escapeHtml(b.ccu.from)} → ${OH.escapeHtml(b.ccu.to)}` : OH.escapeHtml(b.name || '—')}</h3>
      <div class="modal-meta"><span class="badge">buy-back</span>${b.price ? `<span class="modal-val">${OH.escapeHtml(b.price)}</span>` : ''}</div>
      ${b.ccu ? row('Upgrade', OH.escapeHtml(`${b.ccu.from} → ${b.ccu.to}`)) : ''}
      ${b.date ? row('Melted', OH.escapeHtml(b.date)) : ''}
      ${b.contains ? row('Contains', OH.escapeHtml(b.contains)) : ''}
      ${b.id ? row('Pledge ID', OH.escapeHtml(b.id)) : ''}
      ${url ? `<div class="mr"><span class="mr-k">Reclaim</span><span class="mr-v"><a href="${OH.escapeHtml(url)}" target="_blank" rel="noopener">Open on RSI ↗</a></span></div>` : ''}
    </div>`;
  itemModal.hidden = false;
  const mimg = modalBody.querySelector('img.modal-img');
  if (mimg && b.image) {
    mimg.addEventListener(
      'error',
      () => {
        if (!mimg.src.endsWith(b.image)) mimg.src = b.image;
      },
      { once: true },
    );
  }
}
resultsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const p = state.items.find((it) => String(it.id) === card.dataset.id);
  if (p) openItemModal(p);
});
if (buybacksBodyEl) {
  buybacksBodyEl.addEventListener('click', (e) => {
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

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  setStatus('Scanning…');
  setScanning('Scanning…');
  // Scan every registered source (hangar + buy-backs). Each is independent, so a
  // failure in one (e.g. buy-backs) still keeps the other's results.
  const res = await OH.scanAll((id, page, c) => {
    const label = OH.getSource(id)?.label || id;
    setStatus(`Scanning ${label}… page ${page}, ${c} items`);
    setScanning(`${label}… ${c}`);
  });

  const h = res.hangar;
  if (h?.ok) {
    state.items = h.items;
    state.scannedAt = h.scannedAt;
    state.shown = new Set(presentKinds().map((k) => k.key));
    const acct = await OH.getAccount();
    if (acct.loggedIn && acct.nickname) {
      state.owner = { nickname: acct.nickname, displayname: acct.displayname || null };
    }
  }
  const b = res.buybacks;
  if (b?.ok) {
    state.buybacks = b.items;
    state.buybacksScannedAt = b.scannedAt;
    state.bbShown = new Set(presentBbKinds().map((k) => k.key));
  }

  // Referrals — separate source (GraphQL, not in OH.SOURCES). Independent, so a
  // failure here doesn't affect the hangar/buy-back results above.
  const r = await OH.getReferral((phase, n) => {
    setStatus(`Scanning referrals — ${phase}… ${n}`);
    setScanning(`referrals ${phase}… ${n}`);
  });
  if (r?.ok) state.referral = r.referral;

  const parts = [];
  if (h) parts.push(h.ok ? `${h.items.length} pledges` : `hangar: ${h.error}`);
  if (b) parts.push(b.ok ? `${b.items.length} buy-backs` : `buy-backs: ${b.error}`);
  if (r)
    parts.push(r.ok ? `${r.referral.legacy?.recruits ?? 0} recruits` : `referrals: ${r.error}`);
  const anyErr = (h && !h.ok) || (b && !b.ok) || (r && !r.ok);
  const summary = parts.join(' · ');
  setStatus(summary, anyErr);
  setScanning(`${anyErr ? '⚠ ' : '✓ '}${summary}`, true);
  route();
  renderAccount(); // refresh the Citizen Card pill with the new referral counts
  scanBtn.disabled = false;
});

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
    !confirm('Clear all scraped hangar data stored in this browser? You can re-scan at any time.')
  )
    return;
  await OH.clearData();
  state.items = [];
  state.scannedAt = null;
  state.buybacks = [];
  state.buybacksScannedAt = null;
  state.owner = null;
  state.shown = new Set();
  state.bbShown = new Set();
  state.referral = null;
  setStatus('Local data cleared.');
  renderAccount(); // clear the referral pill too
  route();
});

// --- Developers: export / import -----------------------------------------
const exportBtn = $('#export-db');
const importBtn = $('#import-db');
const importFile = $('#import-file');
const dataMsg = $('#data-msg');

function setDataMsg(text, isError = false) {
  if (!dataMsg) return;
  dataMsg.textContent = text;
  dataMsg.classList.toggle('error', isError);
}

const sourceItemCount = (sources) =>
  Object.values(sources || {}).reduce(
    (s, src) => s + (Array.isArray(src.items) ? src.items.length : 0),
    0,
  );

if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    const data = await OH.exportDB();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const who = data.account?.handle ? `-${data.account.handle}` : '';
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-hangar${who}-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDataMsg(`Exported ${sourceItemCount(data.sources)} item(s).`);
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
      !confirm('Importing replaces your current data. Continue?')
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
    const bb = res.db.sources.buybacks || { items: [], scannedAt: null };
    state.buybacks = bb.items || [];
    state.buybacksScannedAt = bb.scannedAt || null;
    const refSrc = res.db.sources.referral;
    state.referral = refSrc && refSrc.items && !Array.isArray(refSrc.items) ? refSrc.items : null;
    state.owner = null; // imports aren't attributed to an account (see importDB)
    state.shown = new Set(presentKinds().map((k) => k.key));
    state.bbShown = new Set(presentBbKinds().map((k) => k.key));
    renderAccount(); // reflect imported referral in the pill
    setDataMsg(
      `Imported ${sourceItemCount(res.db.sources)} item(s) — open Inventory / Buy-Backs / Stats to view.`,
    );
  });
}

// Multi-account safety: force a fresh read of the current RSI account (the cache
// could still hold the previous user) and, if a *different* account is signed
// in, drop the stored hangar — it isn't theirs. Returns a notice string or ''.
async function reconcileAccount() {
  let acct;
  try {
    acct = await OH.getAccount({ force: true });
  } catch {
    return ''; // offline / can't determine — keep showing what we have
  }
  if (acct.loggedIn && acct.nickname && state.owner && acct.nickname !== state.owner.nickname) {
    const prev = state.owner.displayname || state.owner.nickname;
    await OH.clearData();
    state.items = [];
    state.scannedAt = null;
    state.buybacks = [];
    state.buybacksScannedAt = null;
    state.owner = null;
    state.shown = new Set();
    state.bbShown = new Set();
    state.referral = null;
    return `Cleared ${prev}'s hangar — a different account is signed in. Scan to load this account's hangar.`;
  }
  return '';
}

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

// --- Init -----------------------------------------------------------------

(async () => {
  const { uiLayout } = await chrome.storage.local.get('uiLayout');
  if (LAYOUTS.includes(uiLayout)) state.layout = uiLayout;

  const db = await OH.loadDB();
  const hangar = db.sources.hangar || { items: [], scannedAt: null };
  state.items = hangar.items || [];
  state.scannedAt = hangar.scannedAt || null;
  const buybacks = db.sources.buybacks || { items: [], scannedAt: null };
  state.buybacks = buybacks.items || [];
  state.buybacksScannedAt = buybacks.scannedAt || null;
  const referral = db.sources.referral;
  state.referral =
    referral && referral.items && !Array.isArray(referral.items) ? referral.items : null;
  state.owner = db.owner || null;

  const notice = await reconcileAccount();
  state.shown = new Set(presentKinds().map((k) => k.key));
  state.bbShown = new Set(presentBbKinds().map((k) => k.key));
  route();
  if (notice) setStatus(notice);
  renderFooter();
  renderSupporters();
})();
