// Screenshot harness: runs the real dashboard with a fictional demo account.
// - chrome.* is stubbed with in-memory storage seeded from DEMO_DB.
// - RSI PUBLIC lookups (ship-matrix) go through the local proxy; openhangar.space's
//   feeds are answered here with invented data (no cookies ever sent); account/graphql calls never happen
//   because getAccount/getReferral are stubbed after lib.js loads.
(function () {
  const now = Date.now();
  const day = 864e5;
  const ship = (id, name, value, shipLabel, ins = 'LTI', giftable = true) => ({
    id: String(id),
    name,
    value,
    currency: 'USD',
    contents: [
      { kind: 'Ship', label: shipLabel, image: null },
      {
        kind: 'Insurance',
        label: ins === 'LTI' ? 'Lifetime Insurance' : `${ins} Insurance`,
        image: null,
      },
    ],
    image: null,
    containsShip: true,
    isCCU: false,
    ccu: null,
    isAddOn: false,
    isCoupon: false,
    isPaint: false,
    kind: 'ship',
    giftable,
    insurance: ins,
  });
  const ccu = (id, from, to, value) => ({
    id: String(id),
    name: `Upgrade - ${from} to ${to}`,
    value,
    currency: 'USD',
    contents: [],
    image: null,
    containsShip: false,
    isCCU: true,
    ccu: { from, to },
    isAddOn: false,
    isCoupon: false,
    isPaint: false,
    kind: 'ccu',
    giftable: true,
    insurance: null,
  });
  const paint = (id, name, value) => ({
    id: String(id),
    name,
    value,
    currency: 'USD',
    contents: [{ kind: 'Paint', label: name.replace(/^Paints? - /, ''), image: null }],
    image: null,
    containsShip: false,
    isCCU: false,
    ccu: null,
    isAddOn: true,
    isCoupon: false,
    isPaint: true,
    kind: 'paint',
    giftable: true,
    insurance: null,
  });
  const addon = (id, name, value) => ({
    id: String(id),
    name,
    value,
    currency: 'USD',
    contents: [{ kind: 'Hangar decoration', label: name, image: null }],
    image: null,
    containsShip: false,
    isCCU: false,
    ccu: null,
    isAddOn: true,
    isCoupon: false,
    isPaint: false,
    kind: 'addon',
    giftable: true,
    insurance: null,
  });
  const hangar = [
    ship(9001, 'Package - Mustang Alpha Starter Pack', 45, 'Mustang Alpha', 'LTI', false),
    ship(9002, 'Standalone Ship - Drake Cutlass Black', 110, 'Cutlass Black'),
    ship(9003, 'Standalone Ship - Anvil Carrack', 600, 'Carrack'),
    ship(9004, 'Standalone Ship - Origin 400i', 250, '400i'),
    ship(9005, 'Standalone Ship - Aegis Gladius', 90, 'Gladius', '120M'),
    ship(9006, 'Standalone Ship - MISC Prospector', 155, 'Prospector'),
    ship(9007, 'Standalone Ship - RSI Constellation Andromeda', 240, 'Constellation Andromeda'),
    ship(
      9008,
      'Standalone Ship - Crusader Mercury Star Runner',
      260,
      'Mercury Star Runner',
      '120M',
    ),
    ship(9009, 'Standalone Ship - Anvil Arrow', 75, 'Arrow', '6M'),
    ship(9010, 'Standalone Ship - Drake Corsair Warbond', 220, 'Corsair'),
    ship(9011, 'Standalone Ship - Aegis Vanguard Sentinel', 275, 'Vanguard Sentinel'),
    ship(9012, 'Standalone Ship - MISC Freelancer MAX', 150, 'Freelancer MAX'),
    ccu(9013, 'Avenger Titan', 'Cutlass Black', 20),
    ccu(9014, 'Cutlass Black', 'Constellation Andromeda', 130),
    ccu(9015, 'Freelancer', 'Freelancer MAX', 25),
    paint(9016, 'Paints - Carrack Stormbringer Paint', 15),
    paint(9017, 'Paints - Cutlass Black Ghoulish Green Paint', 5),
    addon(9018, 'Add-On - Fleet Week Hangar Poster', 5),
    {
      ...ship(9019, 'Standalone Ships - Nine Tails Shogun Pack', 75, 'ATLS IKTI Akuma'),
      // Mirrors the real store pack: 1 vehicle, 1 paint, 8 gear items, LTI.
      contents: [
        { kind: 'Ship', label: 'ATLS IKTI Akuma', image: null },
        { kind: 'Paint', label: 'Cutlass - Akuma Paint', image: null },
        ...[
          "Behring P8-AR 'Akuma' Rifle",
          "Gemini A03 'Akuma' Sniper Rifle",
          "Gemini LH86 'Akuma' Pistol",
          "Quirinus Tech Shogun Kiba 'Akuma' Helmet",
          "Quirinus Tech Artimex 'Akuma' Core",
          "Quirinus Tech Artimex 'Akuma' Arms",
          "Quirinus Tech Artimex 'Akuma' Legs",
          "CDS Geist 'Stronghold' Backpack",
        ].map((label) => ({ kind: 'FPS Equipment', label, image: null })),
        { kind: 'Insurance', label: 'Lifetime Insurance', image: null },
      ],
    },
    ship(9020, 'Aegis Gladius Dunlevy - Referral Reward', 0, 'Gladius Dunlevy', 'LTI', false),
  ];
  // Everything paid is meltable in the demo except the starter package (commonly
  // kept as the game licence) and the $0 referral reward.
  hangar.forEach((p) => {
    p.meltable = p.value > 0 && p.id !== '9001';
  });
  // The starter package grants game access (what the "Game packages" trait finds).
  hangar[0].contents.push({ kind: 'Game', label: 'Star Citizen Digital Download', image: null });
  // Spread pledge dates from 2014 to last year so date sorting has something to show.
  hangar.forEach((p, i) => {
    const d = new Date(Date.UTC(2014 + (i % 12), (i * 5) % 12, 1 + ((i * 7) % 27)));
    p.date = d.toISOString().slice(0, 10);
  });
  const buybacks = [
    {
      id: '8801',
      name: 'Origin 300i',
      date: '2025-08-14',
      contains: '300i · Lifetime Insurance',
      href: '/account/buy-back-pledges/reclaim/8801',
      price: '',
      isCCU: false,
      ccu: null,
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ship',
      image: null,
    },
    {
      id: '8802',
      name: 'Aegis Avenger Titan',
      date: '2025-03-02',
      contains: 'Avenger Titan · 120 Month Insurance',
      href: '/account/buy-back-pledges/reclaim/8802',
      price: '',
      isCCU: false,
      ccu: null,
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ship',
      image: null,
    },
    {
      id: '8803',
      name: 'Drake Cutter',
      date: '2024-11-29',
      contains: 'Cutter · Lifetime Insurance',
      href: '/account/buy-back-pledges/reclaim/8803',
      price: '',
      isCCU: false,
      ccu: null,
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ship',
      image: null,
    },
    {
      id: '8804',
      name: 'Upgrade - Aurora MR to Mustang Alpha',
      date: '2024-05-20',
      contains: 'Aurora MR → Mustang Alpha',
      href: '/account/buy-back-pledges/reclaim/8804',
      price: '',
      isCCU: true,
      ccu: { from: 'Aurora MR', to: 'Mustang Alpha' },
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ccu',
      image: null,
    },
  ];
  buybacks.push(
    {
      id: '8805',
      name: 'Package - Aurora MR Starter Pack',
      date: '2023-12-02',
      contains: 'Aurora MR · Star Citizen Digital Download · 6 Month Insurance',
      href: '/account/buy-back-pledges/reclaim/8805',
      price: '',
      isCCU: false,
      ccu: null,
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ship',
      image: null,
    },
    {
      id: '8806',
      name: 'Standalone Ships - Cutlass Black plus Akuma Paint',
      date: '2023-06-18',
      contains: 'Cutlass Black · Cutlass - Akuma Paint · Lifetime Insurance',
      href: '/account/buy-back-pledges/reclaim/8806',
      price: '',
      isCCU: false,
      ccu: null,
      wasUpgraded: false,
      fromShipId: '',
      toShipId: '',
      toSkuId: '',
      kind: 'ship',
      image: null,
    },
  );
  const iso = (d) => new Date(now - d * day).toISOString();
  const recruitsList = Array.from({ length: 14 }, (_, i) => ({
    id: `r${i}`,
    handle: `Demo_Pilot_${String(i + 1).padStart(2, '0')}`,
    moniker: `Demo Pilot ${i + 1}`,
    avatar: null,
    enlistedOn: iso(14 + i * 47),
    convertedOn: iso(4 + i * 41),
    campaign: i < 9 ? 'current' : 'legacy',
  }));
  const prospectsList = Array.from({ length: 23 }, (_, i) => ({
    id: `p${i}`,
    handle: `Demo_Recruit_${String(i + 1).padStart(2, '0')}`,
    moniker: `Demo Recruit ${i + 1}`,
    avatar: null,
    enlistedOn: iso(10 + i * 31),
    convertedOn: null,
  }));
  const referral = {
    code: 'STAR-DEMO-0000',
    url: 'https://robertsspaceindustries.com/enlist?referral=STAR-DEMO-0000',
    current: { recruits: 9 },
    legacy: { recruits: 14 },
    prospects: 23,
    recruitsList,
    prospectsList,
  };
  const owner = { nickname: 'Demo_Citizen', displayname: 'Demo Citizen' };
  const ts = now - 2 * 3600e3;
  // Scan history (Stats → History, Home "since last scan"): a melted Aurora, a
  // few pledges bought over the last months.
  const snap = (items, at) => ({
    at,
    items: items.map((p) => [String(p.id), p.name, p.value]),
  });
  const aurora = { id: 8999, name: 'Package - Aurora MR Starter', value: 45 };
  const history = [
    snap([...hangar.slice(0, -4), aurora], now - 150 * 86400e3),
    snap([...hangar.slice(0, -2), aurora], now - 70 * 86400e3),
    snap(hangar.slice(0, -1), now - 21 * 86400e3),
    snap(hangar, ts),
  ];
  const store = {
    uiStatsTab: 'value', // store screenshot shows the Value tab
    db: {
      schemaVersion: 2,
      owner,
      history,
      sources: {
        hangar: { items: hangar, scannedAt: ts },
        buybacks: { items: buybacks, scannedAt: ts, meta: { tokens: 2 } },
        referral: { items: referral, scannedAt: ts },
      },
    },
  };
  window.DEMO_ACCOUNT = {
    loggedIn: true,
    nickname: 'Demo_Citizen',
    displayname: 'Demo Citizen',
    // RSI's default portrait (every new account starts with it) and a made-up org
    // emblem, so store screenshots never show a real player.
    avatar: 'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg',
    enlistedSince: '2016-11-04T00:00:00.000Z',
    countryName: 'United States',
    credits: {
      store: { value: 4250, symbol: '$', label: 'Store Credit', currency: 'USD' },
      uec: { value: 25000, symbol: '¤', label: 'UEC', currency: 'UEC' },
      rec: { value: 12400, symbol: '¤', label: 'REC', currency: 'REC' },
    },
    subscriber: { type: 'Centurion', frequency: 'monthly' },
    // Invented Chairman's Club standing (RSI's own percentage), for the Home popup.
    concierge: { level: 'Space Marshal', next: 'Wing Commander', percent: 42 },
    citizenRecord: 'n/a',
    org: {
      name: 'Demo Fleet Collective',
      sid: 'DEMOFLT',
      rank: 'Admiral',
      logo: '/__demo/demo-org.svg',
    },
    referral: { code: referral.code, url: referral.url, referrerCode: null },
    fetchedAt: now,
  };
  window.DEMO_REFERRAL = referral;
  // Invented subscriber items (names, prices and stock are made up).
  const subItem = (id, name, cents, extra = {}) => ({
    id,
    name,
    title: name,
    url: `/en/pledge/Subscribers-Store/Demo-${id}`,
    media: null,
    nativePrice: { amount: cents, discounted: null },
    stock: { available: true },
    tags: [],
    isWarbond: false,
    ...extra,
  });
  window.DEMO_SUB_STORE = [
    {
      data: {
        store: {
          listing: {
            resources: [
              subItem(1, 'Nebula Drift Paint', 500, { tags: [{ name: 'Paints' }] }),
              subItem(2, 'Quasar Explorer Helmet', 1200, {
                nativePrice: { amount: 1200, discounted: 900 },
                isWarbond: true,
                tags: [{ name: 'Armor' }],
              }),
              subItem(3, 'Tiny Hangar Plushie', 300, {
                stock: { available: false },
                tags: [{ name: 'Decorations' }],
              }),
              subItem(4, 'Starlight Flight Jacket', 800, {
                label: 'Centurion',
                tags: [{ name: 'Clothing' }],
              }),
              // A long name that wraps, and a kit: cards in a row still line up.
              subItem(5, "Kastak Arms Inquisitor 'Star Kitten' Armor Set", 2500),
              subItem(6, 'Star Kitten Kit', 1500),
            ],
            count: 6,
            totalCount: 6,
          },
        },
      },
    },
  ];

  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const keysOf = (k) =>
    k == null
      ? Object.keys(store)
      : typeof k === 'string'
        ? [k]
        : Array.isArray(k)
          ? k
          : Object.keys(k);
  window.chrome = {
    storage: {
      local: {
        get: async (k) =>
          Object.fromEntries(
            keysOf(k)
              .filter((x) => x in store)
              .map((x) => [x, clone(store[x])]),
          ),
        set: async (o) => {
          // The demo's "RSI" is mostly local fixtures; only a few public lookups
          // go through the proxy to the real internet. A slow or failed one would
          // mark robertsspaceindustries.com as down (lib.js netDown) and the local
          // store fixture would then be refused for 10 minutes: the UI test's old
          // "store details / wishlist" flake. The demo never records that.
          const { netDown: _skip, ...rest } = o || {};
          Object.assign(store, clone(rest));
        },
        remove: async (k) => {
          for (const x of keysOf(k)) delete store[x];
        },
      },
    },
    runtime: {
      getManifest: () => ({ version: '0.2.7', name: 'Open Hangar' }),
      // Extension paths are rooted at the repo; the harness serves src/ at /.
      getURL: (p) => '/' + String(p).replace(/^\/?src\//, ''),
      onInstalled: { addListener() {} },
    },
    cookies: { getAll: async () => [], remove: async () => {} },
    tabs: { create() {} },
    action: { setBadgeText() {}, onClicked: { addListener() {} } },
  };

  // The store catalog (openhangar.space/api/catalog, v1), invented: Cutlass Black on
  // sale on its own, Hull A sold out, the Carrack and Pioneer not for sale, and a
  // pack, a paint, gear and an upgrade to the Freelancer.
  const item = (id, kind, name, price, extra = {}) => ({
    id,
    kind,
    name,
    img: null,
    url: `https://robertsspaceindustries.com/pledge/Demo/${name.replace(/\W+/g, '-')}`,
    price,
    wasPrice: null,
    warbond: false,
    standardPrice: null,
    savings: null,
    inStore: true,
    insurance: null,
    upgrade: null,
    ...extra,
  });
  window.DEMO_CATALOG = {
    v: 1,
    updatedAt: new Date(now - 3600e3).toISOString(),
    items: [
      item('sku-89', 'ship', 'Cutlass Black', 110, {
        url: 'https://robertsspaceindustries.com/pledge/Standalone-Ships/Cutlass-Black',
        insurance: '6 Mo',
      }),
      item('sku-92', 'ship', 'Hull A', 100, { inStore: false }),
      item('sku-19453', 'pack', 'ATLS Duo Pack', 75, {
        warbond: true,
        standardPrice: 90,
        savings: 15,
      }),
      item('sku-501', 'paint', 'Cutlass - Ghoulish Green Paint', 10),
      item('sku-502', 'gear', 'Cutlass Pilot Armor Set', 20),
      item('upgrade-16', 'upgrade', 'Upgrade to Freelancer', 110, {
        url: 'https://robertsspaceindustries.com/en/pledge',
        upgrade: { toShipId: 16, to: 'Freelancer', skus: [13002] },
      }),
    ],
    ships: [
      {
        id: 16,
        name: 'Freelancer',
        msrp: 110,
        editions: [
          { sku: 13002, price: 110, warbond: false },
          { sku: 13003, price: 100, warbond: true },
        ],
      },
    ],
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/pledge-store\/api\/upgrade\/graphql/.test(url)) return realFetch('/__store-ships.json');
    if (/\/api\/spectrum\/forum\/channel\/threads/.test(url))
      return realFetch('/__patchnotes.json');
    // Fixed exchange rates, so the demo and the UI test never wait on the live file.
    if (url === 'https://openhangar.space/rates.json')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            base: 'USD',
            date: '2026-09-30',
            source: 'demo',
            rates: {
              USD: 1,
              EUR: 0.880669,
              GBP: 0.752646,
              CAD: 1.41832,
              AUD: 1.43523,
              NZD: 1.77147,
              CHF: 0.834698,
              SEK: 9.97886,
              PLN: 3.84764,
              CZK: 21.5236,
              BRL: 5.20273,
              CNY: 6.70454,
              JPY: 156.997,
              KRW: 1355.4,
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    // The top bar's Game Status pill: an invented feed in the v1 shape
    // (openhangar.space/api/game-status), dated around now.
    if (url === 'https://openhangar.space/api/game-status') {
      const at = (d) => new Date(Date.now() + d * 864e5).toISOString();
      return Promise.resolve(
        Response.json({
          v: 1,
          updatedAt: at(0),
          status: { level: 'ok', label: 'All Systems Go', url: 'https://openhangar.space/' },
          live: { version: '4.10.1', released: at(-20) },
          ptu: { version: '4.10.2', wave: 'Wave 2', notesAt: at(-1) },
          patchNotes: {
            title: 'Alpha 4.10.2 PTU Patch Notes',
            url: 'https://robertsspaceindustries.com/spectrum/community/SC/forum/190048',
            at: at(-1),
          },
          event: { name: 'Demo Fleet Week', start: at(-3), end: at(4), url: null },
          nextEvent: { name: 'Demo Ship Showdown', start: at(12), end: at(19), url: null },
        }),
      );
    }
    // openhangar.space's other public feeds (the extension talks only to RSI and
    // openhangar.space): invented, so the demo and the UI test never go online.
    if (url === 'https://openhangar.space/api/catalog')
      return Promise.resolve(
        Response.json(window.DEMO_CATALOG, { headers: { etag: 'W/"demo-catalog"' } }),
      );
    if (url === 'https://openhangar.space/api/ships')
      return Promise.resolve(Response.json({ v: 1, updatedAt: null, credit: 'demo', ships: [] }));
    // Referral events: none beyond the built-in list; every tier's reward picture is
    // a ship picture on RSI's media host (open to canvases, for the share card).
    if (url === 'https://openhangar.space/api/referral-events') {
      const pic = 'https://media.robertsspaceindustries.com/dogyaf0p2eup4/store_small.jpg';
      // REFERRAL_TIER_FILES: dashboard.js's tier pictures, by ladder and tier.
      const files = Object.values(REFERRAL_TIER_FILES).flatMap((l) => Object.values(l));
      return Promise.resolve(
        Response.json({
          v: 1,
          updatedAt: null,
          credit: 'demo',
          events: [],
          images: Object.fromEntries(files.map((f) => [f, pic])),
        }),
      );
    }
    if (url === 'https://openhangar.space/api/known-issues')
      return Promise.resolve(Response.json({ v: 1, updatedAt: null, issues: [] }));
    if (url === 'https://openhangar.space/versions.json')
      return Promise.resolve(
        Response.json({ version: '0.2.19', stores: { firefox: { live: '0.2.19' } } }),
      );
    // Your Subscriber Store (#418): an invented listing for the demo subscriber.
    if (/\/graphql$/.test(url) && /GetBrowseSkusByFilter/.test(String(init.body || '')))
      return Promise.resolve(Response.json(window.DEMO_SUB_STORE));
    if (/^https:\/\/robertsspaceindustries\.com\//.test(url)) {
      if (/\/account\/|\/graphql|\/citizens\//.test(url) && !/\/pledge\/buyback\//.test(url))
        return Promise.resolve(new Response('', { status: 404 }));
      return realFetch('/proxy?u=' + encodeURIComponent(url), { method: 'GET' });
    }
    return realFetch(input, init);
  };
})();
