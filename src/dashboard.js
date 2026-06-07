/*
 * dashboard.js — the full-page hangar hub (multi-view app).
 * Views: Home (with the About panel), Inventory (fleet gallery), Stats,
 * Buy-Backs, Store Data. Routed by URL hash so views can be linked/bookmarked.
 * Reads the scan from local storage; scanning goes through lib.js (cookie'd
 * fetch, no tab needed).
 */

const $ = (sel) => document.querySelector(sel);
const VIEWS = ['home', 'inventory', 'stats', 'buybacks', 'store', 'developers'];

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
    renderReferrals(); // referrals are independent of hangar data — still show them
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

  renderReferrals();
}

// --- Referrals (section inside Stats) -------------------------------------
// Charts are hand-built inline SVG — no chart lib, no network (extension CSP +
// the project's zero-runtime-deps rule). Data comes from OH.getReferral.

// Parse RSI's "YYYY-MM-DD HH:MM:SS" timestamps to a Date (treat as local).
function parseEnlist(s) {
  if (!s) return null;
  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(t) ? null : new Date(t);
}
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Build a cumulative-over-time area+line chart + a per-month bar chart, as one SVG.
function recruitsOverTimeSvg(rows) {
  const dated = rows
    .map((r) => parseEnlist(r.enlistedOn))
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
  const legacyR = ref.legacy?.recruits ?? 0;
  const currentR = ref.current?.recruits ?? 0;
  const pct = prospects > 0 ? (legacyR / prospects) * 100 : 0;
  const restPct = Math.max(0, 100 - pct);
  return `<div class="ref-conv-rate" style="font-size:26px;font-weight:700;margin-bottom:8px">${pct.toFixed(1)}%</div>
    <div class="ref-conv-bar">
      <div class="seg-conv" style="width:${pct.toFixed(2)}%"></div>
      <div class="seg-rest" style="width:${restPct.toFixed(2)}%"></div>
    </div>
    <div class="ref-conv-legend">
      <span><span class="dot" style="background:#7ee787"></span>${legacyR.toLocaleString('en-US')} recruits</span>
      <span><span class="dot" style="background:rgba(255,255,255,0.1)"></span>${(prospects - legacyR).toLocaleString('en-US')} still prospects</span>
    </div>
    <div class="muted" style="margin-top:10px;font-size:12px">Current program: ${currentR.toLocaleString('en-US')} · Legacy total: ${legacyR.toLocaleString('en-US')} · Prospects: ${prospects.toLocaleString('en-US')}</div>`;
}

function refListRows() {
  const ref = state.referral;
  const list = state.refTab === 'prospects' ? ref.prospectsList || [] : ref.recruitsList || [];
  if (!list.length) return `<tr><td colspan="3" class="muted">No ${state.refTab} found.</td></tr>`;
  return list
    .map((r) => {
      const handle = r.handle || r.moniker || '—';
      const link = r.handle
        ? `<a href="https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener">${OH.escapeHtml(handle)}</a>`
        : OH.escapeHtml(handle);
      const badge =
        state.refTab === 'recruits' && r.campaign
          ? ` <span class="ref-badge ${r.campaign}">${r.campaign}</span>`
          : '';
      const when = r.enlistedOn
        ? new Date(r.enlistedOn.replace(' ', 'T')).toLocaleDateString()
        : '—';
      return `<tr>
      <td class="r-handle">${link}${badge}</td>
      <td>${OH.escapeHtml(r.moniker || '')}</td>
      <td>${OH.escapeHtml(when)}</td>
    </tr>`;
    })
    .join('');
}

function renderReferrals() {
  const body = $('#referrals-body');
  if (!body) return;
  const ref = state.referral;
  if (!ref) {
    body.innerHTML = '';
    return;
  } // nothing scanned → section hidden

  const box = (big, lbl) =>
    `<div class="stat-box"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`;
  const recruitsRows = ref.recruitsList || [];
  const legacyR = ref.legacy?.recruits ?? 0;
  const currentR = ref.current?.recruits ?? 0;
  // Best month by new recruits (from dated rows).
  const byMonth = new Map();
  for (const r of recruitsRows) {
    const d = parseEnlist(r.enlistedOn);
    if (d) byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) || 0) + 1);
  }
  let best = null;
  for (const [k, n] of byMonth) if (!best || n > best.n) best = { k, n };

  const stats =
    box(legacyR.toLocaleString('en-US'), 'recruits (all-time)') +
    box(currentR.toLocaleString('en-US'), 'recruits (current)') +
    box((ref.prospects ?? 0).toLocaleString('en-US'), 'prospects') +
    box(best ? `${best.n}` : '—', best ? `best month (${best.k})` : 'best month');

  const tab = (key, label, n) =>
    `<button class="ref-tab ${state.refTab === key ? 'active' : ''}" data-reftab="${key}">${label} <b>${n.toLocaleString('en-US')}</b></button>`;

  body.innerHTML = `<div class="ref-section">
    <h3 class="section-title">Referrals</h3>
    <div class="stat-grid">${stats}</div>
    <div class="ref-charts">
      <div class="ref-chart"><h4>Recruits over time (cumulative · monthly)</h4>${recruitsOverTimeSvg(recruitsRows)}</div>
      <div class="ref-chart"><h4>Prospect → recruit conversion</h4>${conversionHtml(ref)}</div>
    </div>
    <div class="ref-list-controls">
      <div class="ref-tabs">
        ${tab('recruits', 'Recruits', legacyR)}
        ${tab('prospects', 'Prospects', ref.prospects ?? 0)}
      </div>
    </div>
    <table class="ref-table">
      <thead><tr><th>Handle</th><th>Moniker</th><th>Enlisted</th></tr></thead>
      <tbody>${refListRows()}</tbody>
    </table>
  </div>`;
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

// Referral list tab switching (Recruits / Prospects) inside Stats.
const referralsBodyEl = $('#referrals-body');
if (referralsBodyEl) {
  referralsBodyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reftab]');
    if (!btn) return;
    state.refTab = btn.dataset.reftab;
    renderReferrals();
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
