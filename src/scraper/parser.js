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
 * Loaded via <script> in dashboard.html BEFORE lib.js, so its helpers hang off
 * globalThis.OpenHangar and lib.js can parse fetched HTML.
 */

(function () {
  const ns = (globalThis.OpenHangar = globalThis.OpenHangar || {});

  // Kept for completeness; the DOM scrape doesn't need a token, but a future
  // melt/buyback action might. See CONTRIBUTING.md if this returns null.
  ns.getCsrfToken = function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"], meta[name="rsi-token"]');
    if (meta && meta.content) return meta.content;
    const m = document.cookie.match(/(?:^|;\s*)(?:Rsi-Token|csrf_token)=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (globalThis.RSI && globalThis.RSI.token) return globalThis.RSI.token;
    return null;
  };

  // --- Classification -------------------------------------------------------

  // CCU (Cross-Chassis Upgrade) names look like "Upgrade - <from> to <to>".
  // We gate on the "Upgrade -" prefix AND the " to " join so a stray
  // "Upgrade -" without a target can't false-positive. Captures from/to so the
  // CCU can be classified and displayed (the "from → to" chain).
  //
  // NOTE: the previous scaffold used /^\s*upgrade\s*-.*-/i (two dashes). RSI's
  // real names carry a single dash ("Upgrade - Pulse to C8R Pisces ..."), so the
  // two-dash form would NOT have matched them. This pattern matches all 87 CCUs;
  // confirm the count with the verification snippet if you change it.
  const CCU_RE = /^\s*upgrade\s*-\s*(.+?)\s+to\s+(.+?)\s*$/i;

  // Standalone add-ons (paints, posters, name reservations, decorations, …) are
  // prefixed "Add-On - " when sold on their own.
  const ADDON_NAME_RE = /^\s*add[\s-]*on\s*-/i;

  // Store/discount coupons (e.g. "6 Months Imperator Reward - 20% Coupon: SR…").
  // They carry no contents and no value — neither ship nor add-on.
  const COUPON_NAME_RE = /\bcoupon\b/i;

  // Paints / skins / liveries — a common reward & buy-back type RSI doesn't tag.
  const PAINT_NAME_RE = /\b(paint|skin|livery|liveries|camo)\b/i;

  ns.detectCCU = function detectCCU(name) {
    const m = CCU_RE.exec(name || '');
    if (!m) return null;
    return { from: m[1].trim(), to: m[2].trim() };
  };

  // Classify a buy-back from its name + the free-text "contains" string (buy-back
  // cards have no structured .kind tiles like the hangar, so this is name-based
  // and best-effort). Returns one of: ccu | paint | addon | coupon | ship.
  // Defaults to 'ship' because most melted pledges are ships. Precise paint/skin
  // detection for *untagged* items still needs the external reference (ROADMAP).
  ns.classifyBuyback = function classifyBuyback(name, contains) {
    const hay = `${name || ''} ${contains || ''}`;
    if (ns.detectCCU(name)) return 'ccu';
    if (COUPON_NAME_RE.test(hay)) return 'coupon';
    if (PAINT_NAME_RE.test(hay)) return 'paint';
    if (ADDON_NAME_RE.test(name)) return 'addon';
    return 'ship';
  };

  ns.normalizePledge = function normalizePledge(raw) {
    const name = (raw.name ?? '').trim();
    const contents = Array.isArray(raw.contents) ? raw.contents : [];
    const containsShip = contents.some((c) => (c.kind || '').trim().toLowerCase() === 'ship');

    const ccu = ns.detectCCU(name);
    const isCCU = ccu != null;
    // A coupon is a non-upgrade, non-ship reward whose name says so.
    const isCoupon = !isCCU && !containsShip && COUPON_NAME_RE.test(name);
    // An add-on is anything that isn't an upgrade/coupon and carries no ship:
    // either explicitly name-prefixed, or a card whose only contents are
    // non-ship items (a standalone paint, skin, decoration, etc.).
    const isAddOn =
      !isCCU && !isCoupon && (ADDON_NAME_RE.test(name) || (!containsShip && contents.length > 0));

    // Paint/skin/livery — a finer add-on type. Detect from the name OR from a
    // contained item's kind (RSI tags some as kind "Paint"/"Skin"). Best-effort;
    // untagged reward paints still need the external reference (ROADMAP).
    const contentIsPaint = contents.some((c) =>
      PAINT_NAME_RE.test(`${c.kind || ''} ${c.label || ''}`),
    );
    const isPaint =
      !isCCU && !containsShip && !isCoupon && (PAINT_NAME_RE.test(name) || contentIsPaint);

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
      kind, // display category: 'ccu' | 'ship' | 'addon' | 'coupon' | 'other'
      raw: raw.raw ?? null, // keep originals while reverse-engineering
    };
  };

  // --- DOM extraction -------------------------------------------------------

  // Resolve a pledge card from one of its hidden inputs. Climb to the NEAREST
  // ancestor that both carries the `.row` class AND contains a `.js-pledge-name`,
  // so the full card (inputs + .kind list) is guaranteed in scope and we never
  // grab a parent `.row` that wraps several cards. Falls back progressively.
  function resolveCard(anchor) {
    for (let el = anchor; el && el.nodeType === 1; el = el.parentElement) {
      if (el.classList && el.classList.contains('row') && el.querySelector('.js-pledge-name')) {
        return el;
      }
    }
    return (
      (anchor.closest && anchor.closest('.row')) ||
      (anchor.closest && anchor.closest('.item')) ||
      anchor.parentElement ||
      anchor
    );
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
    return m ? m[2] : null;
  }

  function readContents(card) {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const contents = [];

    for (const tile of card.querySelectorAll('.item')) {
      const kind = clean(tile.querySelector('.kind')?.textContent);
      const label = clean(tile.querySelector('.title, .name, .item-name')?.textContent);
      if (!kind && !label) continue; // structural noise, not a real item tile
      contents.push({ kind, label, image: bgUrl(tile.querySelector('.image')) });
    }
    if (contents.length) return contents;

    // Fallback for layouts that expose `.kind` without an `.item` wrapper.
    return Array.from(card.querySelectorAll('.kind')).map((k) => ({
      kind: clean(k.textContent),
      label: '',
      image: null,
    }));
  }

  // The card's hero thumbnail: prefer the contained Ship's art, then any item
  // with art, then any image on the card. CCUs/coupons often have none.
  function pickImage(card, contents) {
    const ship = contents.find((c) => /^ship$/i.test(c.kind) && c.image);
    return (
      ship?.image ||
      contents.find((c) => c.image)?.image ||
      bgUrl(card.querySelector('.image')) ||
      null
    );
  }

  // Read every pledge card under `root` (a Document or Element).
  ns.parsePledgesFromDOM = function parsePledgesFromDOM(root = document) {
    const seen = new Set();
    const pledges = [];

    for (const idInput of root.querySelectorAll('.js-pledge-id')) {
      const card = resolveCard(idInput);
      if (seen.has(card)) continue; // guard against shared-ancestor double counts
      seen.add(card);

      const val = (cls) => card.querySelector('.' + cls)?.value?.trim() ?? null;
      const name = val('js-pledge-name') || '';
      const rawValue = val('js-pledge-value'); // "$35.00 USD"
      const numeric = rawValue ? Number(rawValue.replace(/[^0-9.]/g, '')) : null;
      // RSI stuffs junk into js-pledge-currency for $0 reward items (e.g.
      // "TyCustomer_ledger_-en"); keep only a real ISO-4217 code, else derive it
      // from the value string ("$35.00 USD" → USD), else null.
      const rawCurrency = val('js-pledge-currency');
      let currency = /^[A-Z]{3}$/.test(rawCurrency || '') ? rawCurrency : null;
      if (!currency) {
        const m = (rawValue || '').match(/\b([A-Z]{3})\b/);
        currency = m ? m[1] : null;
      }
      const contents = readContents(card);

      pledges.push(
        ns.normalizePledge({
          id: val('js-pledge-id'),
          name,
          value: Number.isFinite(numeric) ? numeric : null,
          currency,
          contents,
          image: pickImage(card, contents),
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
  // frontend earlier notes assumed. Per card:
  //   • name        → <h1>
  //   • date/items  → the card's <dd> cells: 4 cells → [0]=date, [2]=items;
  //                   2 cells → [0]=date, [1]=items
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
    for (const node of root.querySelectorAll('article')) {
      const name = clean(node.querySelector('h1')?.textContent);
      if (!name) continue; // every real buy-back card has a name

      const dds = node.querySelectorAll('dd');
      let date = '',
        contains = '';
      if (dds.length >= 4) {
        date = clean(dds[0].textContent);
        contains = clean(dds[2].textContent);
      } else if (dds.length >= 2) {
        date = clean(dds[0].textContent);
        contains = clean(dds[1].textContent);
      } else if (dds.length === 1) {
        date = clean(dds[0].textContent);
      }

      // The reclaim button carries the ids and the buy-back href.
      const btn = node.querySelector(".holosmallbtn, a[href*='reclaim'], a[href*='buy-back']");
      const href = btn?.getAttribute('href') || '';
      // getAttribute is case-insensitive for HTML, so lowercase names match data-pledgeId etc.
      let id = btn?.getAttribute('data-pledgeid') || '';
      const fromShipId = btn?.getAttribute('data-fromshipid') || '';
      const toShipId = btn?.getAttribute('data-toshipid') || '';
      const toSkuId = btn?.getAttribute('data-toskuid') || '';
      if (!id) {
        const m = href.match(/(\d+)/); // fall back to an id embedded in the reclaim URL
        id = m ? m[1] : name;
      }

      const img = node.querySelector('img');
      let image =
        img?.getAttribute('src') || bgUrl(node.querySelector('[style*="background"]')) || null;
      // RSI sometimes returns a RELATIVE image path (e.g. "/media/…"); in the
      // extension page context that resolves to chrome-extension://… and 404s.
      // Absolutize any root-relative URL to the RSI host so the <img> loads.
      if (image && image.startsWith('/')) {
        image = 'https://robertsspaceindustries.com' + image;
      }

      // Best-effort buy-back price (store-credit cost). RSI's exact markup here is
      // unconfirmed, so we read a price-labelled element if one exists; otherwise
      // leave it blank. Refine the selector once a real capture is available.
      const price =
        clean(node.querySelector('.price, [class*="price"], [class*="cost"]')?.textContent) || '';

      // Melted-CCU quirk: when an upgraded ship is melted, RSI reverts it to the
      // ORIGINAL ship but tags the name "<ship> - upgraded" and leaves a STALE
      // "Contained" cell naming the former CCU target (e.g. "Tiburon and 2 items")
      // — which you do NOT get back. So for "- upgraded" buybacks, drop the suffix
      // and discard the misleading contains string; the original ship is the truth.
      const wasUpgraded = /\s-\s*upgraded\s*$/i.test(name);
      let displayName = name;
      let displayContains = contains;
      if (wasUpgraded) {
        displayName = name.replace(/\s-\s*upgraded\s*$/i, '').trim();
        displayContains = ''; // stale CCU-target data — not what's actually returned
      }

      // A buy-back can itself be a CCU ("Upgrade - X to Y"); detect it so the UI
      // can show the from→to flow and resolve art from the *target* ship.
      const ccu = ns.detectCCU(displayName);
      const kind = ns.classifyBuyback(displayName, displayContains); // ship|ccu|paint|addon|coupon

      out.push({
        id: String(id),
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

  ns.parseBuybacks = function parseBuybacks(payload) {
    if (payload == null) return [];
    if (typeof payload === 'string') {
      return ns.parseBuybacksFromDOM(new DOMParser().parseFromString(payload, 'text/html'));
    }
    if (payload.querySelectorAll) return ns.parseBuybacksFromDOM(payload);
    return [];
  };
})();
