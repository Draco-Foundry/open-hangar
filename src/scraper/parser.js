/*
 * parser.js — THE FRAGILE LAYER (re-anchored to RSI's real markup)
 * ---------------------------------------------------------------------------
 * RSI renders each pledge as a card whose real container is `.row` (NOT `.item`,
 * which `closest('.item')` missed for most cards). Each card carries hidden
 * <input>s with the authoritative structured data:
 *   <input class="js-pledge-id"       value="108485174">
 *   <input class="js-pledge-name"     value="Upgrade - Pulse to C8R Pisces ...">
 *   <input class="js-pledge-value"    value="$35.00 USD">
 *   <input class="js-pledge-currency" ...>
 *
 * A card ALSO contains zero or more `.kind` elements ("Ship", "Skin",
 * "Insurance", "Component", "Paint", ...). These describe the items CONTAINED
 * in the pledge — they are NOT the pledge's own category. There is no single
 * authoritative pledge-category field in the markup, so we derive classification
 * from the name (CCU / add-on) plus the contained `.kind` set (containsShip).
 *
 * Where each of these is (selectors, cell positions, name patterns) lives in the
 * parser rules, src/data/parser-rules.json (read through src/parser-rules.js as
 * RULES); this file is how they're read. When RSI moves something, fix the rules.
 *
 * Loaded via <script> in dashboard.html BEFORE lib.js (and after parser-rules.js),
 * so its helpers hang off globalThis.OpenHangar and lib.js can parse fetched HTML.
 */

(function () {
  const ns = (globalThis.OpenHangar = globalThis.OpenHangar || {});
  if (!globalThis.OHRules && typeof require === 'function') require('../parser-rules.js');
  const RULES = globalThis.OHRules;

  // --- Classification -------------------------------------------------------
  // The name patterns are RULES.names: an upgrade ("Upgrade - <from> to <to>", gated
  // on the "Upgrade -" prefix AND the " to " join so a stray "Upgrade -" without a
  // target can't false-positive), a standalone add-on ("Add-On - …"), a store coupon
  // (no contents, no value: neither ship nor add-on), game access ("Star Citizen
  // Digital Download", "Squadron 42 Digital Game", …: anything carrying it is a
  // package, not a pack, owner 2026-10-01; the same test as the dashboard's Game
  // Packages chip, GAME_ITEM_RE) and paints / skins / liveries (a common reward and
  // buy-back type RSI doesn't tag).

  ns.detectCCU = function detectCCU(name) {
    const m = RULES.names.ccu.exec(name || '');
    if (!m) return null;
    return { from: m.groups.from.trim(), to: m.groups.to.trim() };
  };

  // RSI prefixes most pledge names with their store category — "Standalone Ships
  // - …", "Paints - …", "Gear - …", "Subscribers Store - …", "Add-On - …". Pull
  // that leading category out (the text before the first spaced " - "); '' if
  // none. The dash must have spaces around it: "Add-Ons - X" is category
  // "Add-Ons", not "Add".
  ns.buybackCategoryPrefix = function buybackCategoryPrefix(name) {
    const m = String(name || '').match(RULES.names.category);
    return m ? m.groups.prefix.trim() : '';
  };

  // Classify a buy-back from its name + the free-text "contains" string (buy-back
  // cards have no structured .kind tiles like the hangar). The store-category
  // prefix is the most reliable signal — e.g. "Subscribers Store - Chance Cube"
  // is NOT a ship — so map it first, then fall back to content hints, then 'ship'
  // (most untagged melted pledges are ships). Returns: ccu|paint|addon|coupon|
  // other|ship.
  ns.classifyBuyback = function classifyBuyback(name, contains) {
    const hay = `${name || ''} ${contains || ''}`;
    if (ns.detectCCU(name)) return 'ccu';
    if (RULES.names.coupon.test(hay)) return 'coupon';

    const prefix = ns.buybackCategoryPrefix(name);
    if (RULES.categories.package.test(prefix)) return 'package';
    // Owner: a package is anything with game access (Star Citizen or Squadron 42),
    // whatever it's called ("Mustang Alpha Starter Pack" + "Star Citizen Digital
    // Download" in its items line).
    if (RULES.names.gameAccess.test(hay)) return 'package';
    // Owner's rule: "Pack" in the name makes it a pack, whatever the label in front
    // says ("Standalone Ships - Nine Tails Shogun Pack", "Paints - Wolf - 8 Paint
    // Pack", "… Paint Pack - Referral Reward"). Game packages ("Package - … Starter
    // Pack") stay packages, just above.
    if (RULES.names.pack.test(name || '')) return 'pack';
    for (const row of RULES.categories.kinds) if (row.pattern.test(prefix)) return row.kind;
    if (RULES.categories.ship.test(prefix)) return 'ship';

    if (RULES.names.paint.test(hay)) return 'paint';
    if (RULES.names.addon.test(name)) return 'addon';
    return 'ship';
  };

  // Insurance term, read from the contained item RSI tags kind "Insurance" (its
  // label names the duration: "Lifetime Insurance", "120 Month Insurance",
  // "6 Months Insurance", …). Normalized to the short forms sellers use —
  // LTI / 120M / 6M / 5Y. Returns null when the pledge carries no insurance item
  // (most CCUs, gear, and add-ons), which the UI renders as "----".
  // Insurance hinted by a buy-back's name ("… - LTI", "… - 10 Year", "6 Month"),
  // since RSI's buy-back list doesn't list contents. null when there's no hint.
  ns.insuranceFromName = function insuranceFromName(name) {
    const n = String(name || '');
    if (RULES.insurance.fromName.lti.test(n)) return 'LTI';
    const yr = n.match(RULES.insurance.fromName.years);
    if (yr) return `${Number(yr.groups.n) * 12}M`;
    const mo = n.match(RULES.insurance.fromName.months);
    if (mo) return `${mo.groups.n}M`;
    return null;
  };

  // One insurance item's term in months (Infinity for LTI), or null when the
  // phrasing isn't recognized. Years count as months, the same as
  // insuranceFromName ("10 Year" → 120), so one term never shows up two ways in
  // filters and stats.
  function insuranceMonths(label) {
    if (RULES.insurance.fromItem.lti.test(label)) return Infinity;
    const mo = label.match(RULES.insurance.fromItem.months);
    if (mo) return Number(mo.groups.n);
    const yr = label.match(RULES.insurance.fromItem.years);
    if (yr) return Number(yr.groups.n) * 12;
    return null;
  }

  // An upgraded pledge lists its original insurance and the upgrade as separate
  // items, original first (#712), so the best term wins: LTI, then the most months.
  ns.insuranceTerm = function insuranceTerm(contents) {
    const items = (contents || []).filter((c) => RULES.kinds.insurance.test(c.kind || ''));
    if (!items.length) return null;
    let best = null;
    for (const c of items) {
      const m = insuranceMonths(c.label || '');
      if (m !== null && (best === null || m > best)) best = m;
    }
    if (best === Infinity) return 'LTI';
    if (best !== null) return `${best}M`;
    return items[0].label || null; // unrecognized phrasing — surface RSI's text verbatim
  };

  // RSI leaves the type off some contained items (#296; other tools see about 1 in
  // 6). When it's missing, read it from the item's own name where that's safe:
  // insurance and paints say so, and the ship in a "Standalone Ships - …" pledge
  // is the item the pledge is named after. Anything else stays untyped ('').
  ns.inferKind = function inferKind(label, pledgeName) {
    const l = String(label || '').trim();
    if (!l) return '';
    if (RULES.kinds.insuranceName.test(l)) return 'Insurance';
    if (RULES.names.paint.test(l)) return 'Paint';
    const n = String(pledgeName || '');
    if (
      RULES.categories.ship.test(ns.buybackCategoryPrefix(n)) &&
      n.toLowerCase().includes(l.toLowerCase())
    )
      return 'Ship';
    return '';
  };

  ns.normalizePledge = function normalizePledge(raw) {
    const name = (raw.name ?? '').trim();
    // Untyped items get a type from their name when it's safe (see inferKind),
    // marked `guessed` so it's never mistaken for what RSI said.
    const contents = (Array.isArray(raw.contents) ? raw.contents : []).map((c) => {
      if (!c || (c.kind || '').trim()) return c;
      const kind = ns.inferKind(c.label, name);
      return kind ? { ...c, kind, guessed: true } : c;
    });
    const containsShip = contents.some((c) => RULES.kinds.ship.test((c.kind || '').trim()));

    const ccu = ns.detectCCU(name);
    const isCCU = ccu != null;
    // A coupon is a non-upgrade, non-ship reward whose name says so.
    const isCoupon = !isCCU && !containsShip && RULES.names.coupon.test(name);
    // An add-on is anything that isn't an upgrade/coupon and carries no ship:
    // either explicitly name-prefixed, or a card whose only contents are
    // non-ship items (a standalone paint, skin, decoration, etc.).
    const isAddOn =
      !isCCU &&
      !isCoupon &&
      (RULES.names.addon.test(name) || (!containsShip && contents.length > 0));

    // Paint/skin/livery — a finer add-on type. Detect from the name OR from a
    // contained item's kind (RSI tags some as kind "Paint"/"Skin"). Best-effort;
    // untagged reward paints still need the external reference (ROADMAP).
    const contentIsPaint = contents.some((c) =>
      RULES.names.paint.test(`${c.kind || ''} ${c.label || ''}`),
    );
    const isPaint =
      !isCCU && !containsShip && !isCoupon && (RULES.names.paint.test(name) || contentIsPaint);

    // Backward-compatible display category (the dashboard renders `kind`). Derived,
    // best-effort — the structured fields above are the source of truth.
    const kind = isCCU
      ? 'ccu'
      : containsShip
        ? 'ship'
        : isCoupon
          ? 'coupon'
          : isPaint
            ? 'paint'
            : isAddOn
              ? 'addon'
              : 'other';

    return {
      id: raw.id ?? null,
      name,
      value: raw.value ?? null, // numeric dollars, e.g. 35
      currency: raw.currency ?? null,
      contents, // [{ kind, label, image }] of items contained in this pledge
      image: raw.image ?? null, // hero thumbnail URL (RSI CDN), or null
      containsShip, // true if any contained .kind === "Ship"
      isCCU,
      ccu, // { from, to } | null
      isAddOn,
      isCoupon,
      isPaint,
      kind, // display category: 'ccu' | 'ship' | 'paint' | 'addon' | 'coupon' | 'other'
      giftable: raw.giftable === true, // hangar showed a "Gift" action → transferable
      meltable: raw.meltable === true, // hangar showed an "Exchange" (melt) action
      insurance: ns.insuranceTerm(contents), // 'LTI' | '120M' | '6M' | … | null
      date: raw.date ?? null, // pledge (purchase) date, ISO 'YYYY-MM-DD', or null
      raw: raw.raw ?? null, // keep originals while reverse-engineering
    };
  };

  // RSI prints dates as "December 08, 2016" / "Dec 8, 2016" (sometimes behind a
  // "Created:" label). Return ISO 'YYYY-MM-DD' — built by hand, not via Date, so
  // the user's timezone can't shift the day — or null if it doesn't parse.
  ns.parseRsiDate = function parseRsiDate(text) {
    const s = String(text || '')
      .replace(RULES.dates.label, '')
      .trim();
    let m = s.match(RULES.dates.iso); // already ISO
    if (m) return `${m.groups.year}-${m.groups.month}-${m.groups.day}`;
    m = s.match(RULES.dates.named);
    if (!m) return null;
    const month = RULES.dates.months.indexOf(m.groups.month.toLowerCase()) + 1;
    const day = Number(m.groups.day);
    if (!month || day < 1 || day > 31) return null;
    return `${m.groups.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // --- DOM extraction -------------------------------------------------------

  // Resolve a pledge card from one of its hidden inputs. Climb to the NEAREST
  // ancestor that both is a card AND contains a name input, so the full card
  // (inputs + .kind list) is guaranteed in scope and we never grab a parent `.row`
  // that wraps several cards. Falls back progressively.
  function resolveCard(anchor) {
    for (let el = anchor; el && el.nodeType === 1; el = el.parentElement) {
      if (el.matches(RULES.hangar.card) && el.querySelector(RULES.hangar.cardHas)) {
        return el;
      }
    }
    for (const fallback of RULES.hangar.cardFallbacks) {
      const el = anchor.closest && anchor.closest(fallback);
      if (el) return el;
    }
    return anchor.parentElement || anchor;
  }

  // Build the contents array from the card's contained-item tiles (`.item`).
  // Each tile carries a `.title`/`.name` (the item) and OPTIONALLY a `.kind`
  // ("Ship", "Skin", "Insurance", …). RSI omits `.kind` for many reward/gear
  // items (armor sets, reward paints, posters, merch), so we anchor on the tile
  // and treat kind as optional — anchoring on `.kind` alone drops every untagged
  // item and misclassifies whole gear bundles as empty/"other". Falls back to
  // bare `.kind` elements if a card exposes no `.item` tiles.
  // Pull the URL out of an element's inline `background-image: url(...)`.
  function bgUrl(el) {
    const m = (el?.getAttribute('style') || '').match(/url\((['"]?)(.*?)\1\)/i);
    if (!m) return null;
    // RSI serves some art as a RELATIVE path ("/media/…"), which would resolve
    // against the extension's own origin and break. Make it absolute.
    return m[2].startsWith('/') && !m[2].startsWith('//')
      ? 'https://robertsspaceindustries.com' + m[2]
      : m[2];
  }

  function readContents(card) {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const contents = [];

    for (const tile of card.querySelectorAll(RULES.hangar.item)) {
      const kind = clean(tile.querySelector(RULES.hangar.itemKind)?.textContent);
      const label = clean(tile.querySelector(RULES.hangar.itemName)?.textContent);
      if (!kind && !label) continue; // structural noise, not a real item tile
      contents.push({ kind, label, image: bgUrl(tile.querySelector(RULES.hangar.itemImage)) });
    }
    if (contents.length) return contents;

    // Fallback for layouts that expose `.kind` without an `.item` wrapper.
    return Array.from(card.querySelectorAll(RULES.hangar.kindFallback)).map((k) => ({
      kind: clean(k.textContent),
      label: '',
      image: null,
    }));
  }

  // The card's hero thumbnail: prefer the contained Ship's art, then any item
  // with art, then any image on the card. CCUs/coupons often have none.
  function pickImage(card, contents) {
    const ship = contents.find((c) => RULES.kinds.ship.test(c.kind) && c.image);
    return (
      ship?.image ||
      contents.find((c) => c.image)?.image ||
      bgUrl(card.querySelector(RULES.hangar.image)) ||
      null
    );
  }

  // Read every pledge card under `root` (a Document or Element).
  ns.parsePledgesFromDOM = function parsePledgesFromDOM(root = document) {
    const seen = new Set();
    const pledges = [];

    for (const idInput of root.querySelectorAll(RULES.hangar.id)) {
      const card = resolveCard(idInput);
      if (seen.has(card)) continue; // guard against shared-ancestor double counts
      seen.add(card);

      const val = (selector) => card.querySelector(selector)?.value?.trim() ?? null;
      const name = val(RULES.hangar.name) || '';
      const rawValue = val(RULES.hangar.value); // "$35.00 USD"
      // A value with no digits in it means RSI showed none: no price (null), never
      // $0, so totals can say what they leave out. "$0.00 USD" is a real $0.
      const digits = rawValue ? rawValue.replace(/[^0-9.]/g, '') : '';
      const hasDigit = [...digits].some((c) => c >= '0' && c <= '9');
      const numeric = hasDigit && Number.isFinite(Number(digits)) ? Number(digits) : null;
      // RSI stuffs junk into js-pledge-currency for $0 reward items (e.g.
      // "TyCustomer_ledger_-en"); keep only a real ISO-4217 code, else derive it
      // from the value string ("$35.00 USD" → USD), else null.
      const rawCurrency = val(RULES.hangar.currency);
      let currency = /^[A-Z]{3}$/.test(rawCurrency || '') ? rawCurrency : null;
      if (!currency) {
        const m = (rawValue || '').match(/\b([A-Z]{3})\b/);
        currency = m ? m[1] : null;
      }
      const contents = readContents(card);
      // Giftability is whatever RSI decided: a transferable pledge renders a
      // "Gift" action (`a.js-gift`), a bound one doesn't. We read the rendered
      // button rather than re-deriving the rules (store-credit purchases, gear,
      // CCUs, …) — RSI already computed it. `.js-gift` lives inside this card's
      // `.row`, so scope the query to the card to avoid neighbour bleed.
      const giftable = !!card.querySelector(RULES.hangar.gift);
      // Meltable: RSI renders an "Exchange" action (`a.js-reclaim`) on pledges you
      // can melt for store credit — same approach as giftability, same scoping.
      const meltable = !!card.querySelector(RULES.hangar.melt);
      // Pledge date: the card's first `.date-col` (the selector HangarXPLOR has
      // relied on for years), e.g. "Created: December 08, 2016".
      const dateEl = card.querySelector(RULES.hangar.date);
      const date = dateEl ? ns.parseRsiDate(dateEl.textContent.replace(/\s+/g, ' ')) : null;

      pledges.push(
        ns.normalizePledge({
          id: val(RULES.hangar.id),
          name,
          value: Number.isFinite(numeric) ? numeric : null,
          currency,
          contents,
          image: pickImage(card, contents),
          giftable,
          meltable,
          date,
          raw: { rawValue },
        }),
      );
    }

    return pledges;
  };

  // Accept either an HTML string (from fetch) or an object, return pledges.
  ns.parsePledges = function parsePledges(payload) {
    if (payload == null) return [];
    if (typeof payload === 'string') {
      const doc = new DOMParser().parseFromString(payload, 'text/html');
      return ns.parsePledgesFromDOM(doc);
    }
    // already a Document/Element
    if (payload.querySelectorAll) return ns.parsePledgesFromDOM(payload);
    return [];
  };

  // --- Buy-backs ------------------------------------------------------------
  // The buy-back page (/account/buy-back-pledges) is the SAME server-rendered
  // HTML style as the hangar — a list of <article> cards — NOT the GraphQL
  // frontend earlier notes assumed. Per card (RULES.buybacks):
  //   • name        → <h1>
  //   • date/items  → the card's <dd> cells: 4 cells → [0]=date, [2]=items;
  //                   2 cells → [0]=date, [1]=items (cellLayouts)
  //   • id + reclaim link + ship ids → the `.holosmallbtn` element's
  //                   data-pledgeid / data-fromshipid / data-toshipid /
  //                   data-toskuid attributes and its href
  //   • art         → best-effort: an <img> or a background-image in the card
  // Selector map derived from the MIT-licensed SC-Open/hangarlink-hangarexport
  // extension. Returns:
  //   { id, name, image, date, contains, href, wasUpgraded, fromShipId, toShipId,
  //     toSkuId, kind }
  // (`wasUpgraded` = a melted CCU'd ship reverted to its original; its name suffix
  //  is stripped and its stale "Contained" string discarded — see below.)
  ns.parseBuybacksFromDOM = function parseBuybacksFromDOM(root = document) {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const node of root.querySelectorAll(RULES.buybacks.card)) {
      const name = clean(node.querySelector(RULES.buybacks.name)?.textContent);
      if (!name) continue; // every real buy-back card has a name

      const dds = node.querySelectorAll(RULES.buybacks.cells);
      const layout = RULES.buybacks.cellLayouts.find((l) => dds.length >= l.min);
      const date = layout ? clean(dds[layout.date]?.textContent) : '';
      const contains =
        layout && layout.contains != null ? clean(dds[layout.contains]?.textContent) : '';

      // The reclaim button carries the ids and the buy-back href.
      const btn = node.querySelector(RULES.buybacks.button);
      const href = btn?.getAttribute('href') || '';
      // getAttribute is case-insensitive for HTML, so lowercase names match data-pledgeId etc.
      let id = btn?.getAttribute(RULES.buybacks.ids.pledge) || '';
      const fromShipId = btn?.getAttribute(RULES.buybacks.ids.fromShip) || '';
      const toShipId = btn?.getAttribute(RULES.buybacks.ids.toShip) || '';
      const toSkuId = btn?.getAttribute(RULES.buybacks.ids.toSku) || '';
      if (!id) {
        const m = href.match(RULES.buybacks.hrefId); // fall back to an id embedded in the reclaim URL
        id = m ? m.groups.id : null; // no button: the scanner gives it a per-page id (never merged)
      }

      const img = node.querySelector(RULES.buybacks.image);
      let image =
        img?.getAttribute('src') || bgUrl(node.querySelector(RULES.buybacks.background)) || null;
      // RSI sometimes returns a RELATIVE image path (e.g. "/media/…"); in the
      // extension page context that resolves to chrome-extension://… and 404s.
      // Absolutize any root-relative URL to the RSI host so the <img> loads.
      if (image && image.startsWith('/')) {
        image = 'https://robertsspaceindustries.com' + image;
      }

      // Best-effort buy-back price (store-credit cost). RSI's exact markup here is
      // unconfirmed, so we read a price-labelled element if one exists; otherwise
      // leave it blank. Refine the selector once a real capture is available.
      const price = clean(node.querySelector(RULES.buybacks.price)?.textContent) || '';

      // Melted-CCU quirk: when an upgraded ship is melted, RSI reverts it to the
      // ORIGINAL ship but tags the name "<ship> - upgraded" and leaves a STALE
      // "Contained" cell naming the former CCU target (e.g. "Tiburon and 2 items")
      // — which you do NOT get back. So for "- upgraded" buybacks, drop the suffix
      // and discard the misleading contains string; the original ship is the truth.
      const wasUpgraded = RULES.buybacks.upgraded.test(name);
      let displayName = name;
      let displayContains = contains;
      if (wasUpgraded) {
        displayName = name.replace(RULES.buybacks.upgraded, '').trim();
        displayContains = ''; // stale CCU-target data — not what's actually returned
      }

      // A buy-back can itself be a CCU ("Upgrade - X to Y"); detect it so the UI
      // can show the from→to flow and resolve art from the *target* ship.
      const ccu = ns.detectCCU(displayName);
      const kind = ns.classifyBuyback(displayName, displayContains); // ship|ccu|paint|addon|coupon

      out.push({
        id: id ? String(id) : null,
        name: displayName,
        image,
        date,
        contains: displayContains,
        href,
        price,
        isCCU: !!ccu,
        ccu,
        wasUpgraded, // true = a melted CCU'd ship, reverted to its original
        fromShipId,
        toShipId,
        toSkuId,
        kind,
      });
    }
    return out;
  };

  // Buy-back tokens: the page header reads "You have <strong>2</strong>
  // opportunity to buy back a pledge with store credits." → 2. "no" → 0.
  // null when the sentence isn't there (RSI changed the page, or signed out).
  ns.parseBuybackTokens = function parseBuybackTokens(html) {
    const text = String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    const m = text.match(RULES.buybacks.tokens);
    if (!m) return null;
    return RULES.buybacks.noTokens.test(m.groups.n) ? 0 : Number(m.groups.n);
  };

  // One buy-back's own page (/pledge/buyback/<pledge id>): what the list page
  // leaves out. → { title, price (USD), currency, ships: [{ name, manufacturer,
  // focus, image }], also: [labels], insurance } or null if it isn't one.
  ns.parseBuybackDetail = function parseBuybackDetail(html) {
    const doc =
      typeof html === 'string' ? new DOMParser().parseFromString(html, 'text/html') : html;
    const clean = (t) =>
      String(t || '')
        .replace(/\s+/g, ' ')
        .trim();
    const priceEl = doc.querySelector(RULES.buybackDetail.price);
    const title = clean(doc.querySelector(RULES.buybackDetail.title)?.textContent);
    if (!priceEl && !title) return null;
    const ships = [...doc.querySelectorAll(RULES.buybackDetail.ships)].map((li) => {
      const info = {};
      for (const d of li.querySelectorAll(RULES.buybackDetail.info)) {
        const m = clean(d.textContent).match(RULES.buybackDetail.infoLine);
        if (m) info[m.groups.label.toLowerCase()] = m.groups.value;
      }
      // A field is the first of its labels the ship has.
      const field = (labels) => labels.map((l) => info[l]).find(Boolean) || '';
      let image = li.querySelector(RULES.buybackDetail.image)?.getAttribute('src') || null;
      if (image && image.startsWith('/')) image = 'https://robertsspaceindustries.com' + image;
      return {
        name: field(RULES.buybackDetail.fields.name),
        manufacturer: field(RULES.buybackDetail.fields.manufacturer),
        focus: field(RULES.buybackDetail.fields.focus),
        image,
      };
    });
    const also = [...doc.querySelectorAll(RULES.buybackDetail.also)].map((li) =>
      clean(li.textContent),
    );
    const cents = priceEl ? Number(priceEl.getAttribute(RULES.buybackDetail.cents)) : NaN;
    return {
      title,
      price: Number.isFinite(cents) ? cents / 100 : null,
      currency: priceEl?.getAttribute(RULES.buybackDetail.currency) || 'USD',
      ships: ships.filter((x) => x.name),
      also,
      insurance: ns.insuranceTerm(
        also.map((label) => ({
          kind: RULES.kinds.insurance.test(label) ? 'Insurance' : '',
          label,
        })),
      ),
    };
  };

  // RSI's pager under a paged account list (hangar and buy-backs): → { current, max }
  // (the page shown, and the highest page it links to; null when it doesn't say), or
  // null with no pager. It reads page numbers from the links' ?page=N, not from their
  // arrows, so the last page needs no markup of its own. The buy-back list's page-size
  // picker is a plain link too (?page=1&pagesize=N), so whatever size RSI serves, these
  // numbers follow it. scanHtmlSource in src/lib.js stops on them.
  ns.parsePager = function parsePager(html) {
    const doc =
      typeof html === 'string' ? new DOMParser().parseFromString(html, 'text/html') : html;
    const pager = doc.querySelector(RULES.paging.pager);
    if (!pager) return null;
    const pageOf = (a) => {
      const query = (a?.getAttribute('href') || '').split('?')[1];
      const n = Number(new URLSearchParams(query || '').get(RULES.paging.page));
      return Number.isInteger(n) && n > 0 ? n : null;
    };
    const pages = [...pager.querySelectorAll(RULES.paging.links)].map(pageOf).filter(Boolean);
    return {
      current: pageOf(pager.querySelector(RULES.paging.active)),
      max: pages.length ? Math.max(...pages) : null,
    };
  };

  ns.parseBuybacks = function parseBuybacks(payload) {
    if (payload == null) return [];
    if (typeof payload === 'string') {
      return ns.parseBuybacksFromDOM(new DOMParser().parseFromString(payload, 'text/html'));
    }
    if (payload.querySelectorAll) return ns.parseBuybacksFromDOM(payload);
    return [];
  };

  // --- Has RSI changed the page? ----------------------------------------------
  // One hangar or buy-back page (HTML or a Document) that has cards → what of the
  // rules' shape it no longer has, as a list of short reasons, [] when it fits. A scan
  // checks every page with this on the device and saves nothing when a page doesn't
  // fit (src/lib.js scanHtmlSource): better your last scan than one read wrong. Only
  // what the parser can't do without: a pledge's name, a date it can read, the items
  // inside; a buy-back's name and date. A new label or js-* hook isn't a change here
  // (unrecognized, below, lists those for the saved pages' test).
  ns.pageChanged = function pageChanged(payload, kind) {
    const doc =
      typeof payload === 'string' ? new DOMParser().parseFromString(payload, 'text/html') : payload;
    const out = [];
    if (kind === 'hangar') {
      const list = ns.parsePledgesFromDOM(doc);
      if (!list.length) return out;
      if (list.some((p) => !p.id || !p.name)) out.push('a pledge without its id or name');
      if (!list.some((p) => p.date)) out.push('no pledge date reads');
      if (list.length >= 3 && !list.some((p) => p.contents.length)) out.push('no pledge items');
    } else {
      const cards = doc.querySelectorAll(RULES.buybacks.card).length;
      const list = ns.parseBuybacksFromDOM(doc);
      if (cards && !list.length) out.push('buy-back cards without names');
      if (list.length && !list.some((b) => ns.parseRsiDate(b.date)))
        out.push('no buy-back date reads');
    }
    return out;
  };

  // --- What the parser didn't recognize --------------------------------------
  // One hangar or buy-back page (HTML or a Document) → { pledges, items, tags,
  // labels, hooks }, each a list of what the page shows outside the rules: a pledge
  // with no id, name, readable date or kind; an item kind, a tag beside a pledge's
  // name, a card label or a js-* class (RSI's script hooks, so a new one usually
  // means a new feature) not in RULES.known. test/parser-corpus.test.js runs it over
  // saved pages (test/parser-report.js) and fails on anything listed.
  ns.unrecognized = function unrecognized(payload, kind) {
    const doc =
      typeof payload === 'string' ? new DOMParser().parseFromString(payload, 'text/html') : payload;
    const clean = (s) =>
      String(s || '')
        .replace(/\s+/g, ' ')
        .trim();
    const out = { pledges: [], items: [], tags: [], labels: [], hooks: [] };
    const hangar = kind === 'hangar';
    const known = hangar
      ? { labels: RULES.known.hangar.labels, hooks: RULES.known.hangar.hooks }
      : { labels: RULES.known.buybacks.labels, hooks: RULES.known.buybacks.hooks };
    const cards = hangar
      ? [...doc.querySelectorAll(RULES.hangar.id)].map(resolveCard)
      : [...doc.querySelectorAll(RULES.buybacks.card)];

    if (hangar) {
      for (const p of ns.parsePledgesFromDOM(doc)) {
        if (!p.id || !p.name) out.pledges.push(`a pledge with no ${p.id ? 'name' : 'id'}`);
        else if (!p.date) out.pledges.push(`pledge ${p.id}: date doesn't read`);
        else if (p.kind === 'other') out.pledges.push(`pledge ${p.id}: no kind`);
        for (const c of p.contents) {
          if (c.kind && !c.guessed && !RULES.known.hangar.itemKinds.includes(c.kind))
            out.items.push(`pledge ${p.id}: item kind "${c.kind}"`);
        }
      }
      for (const card of cards)
        for (const t of card.querySelectorAll(RULES.hangar.tag)) {
          const text = clean(t.textContent);
          if (text && !RULES.known.hangar.tags.includes(text)) out.tags.push(`tag "${text}"`);
        }
    } else {
      for (const b of ns.parseBuybacksFromDOM(doc)) {
        if (!b.id || !b.name) out.pledges.push(`a buy-back with no ${b.id ? 'name' : 'id'}`);
        else if (!ns.parseRsiDate(b.date)) out.pledges.push(`buy-back ${b.id}: date doesn't read`);
      }
    }

    const labels = hangar ? RULES.hangar.label : RULES.buybacks.label;
    const hooks = hangar ? RULES.hangar.hook : RULES.buybacks.hook;
    for (const card of cards) {
      for (const l of card.querySelectorAll(labels)) {
        const text = clean(l.textContent);
        if (text && !known.labels.includes(text)) out.labels.push(`label "${text}"`);
      }
      for (const el of card.querySelectorAll(hooks))
        for (const c of String(el.className).split(' '))
          if (c.startsWith('js-') && !known.hooks.includes(c)) out.hooks.push(`hook ${c}`);
    }
    for (const k of Object.keys(out)) out[k] = [...new Set(out[k])]; // one line per shape
    return out;
  };
})();
