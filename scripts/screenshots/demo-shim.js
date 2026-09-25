// Screenshot harness: runs the real dashboard with a fictional demo account.
// - chrome.* is stubbed with in-memory storage seeded from DEMO_DB.
// - RSI / star-citizen.wiki PUBLIC lookups (ship-matrix, wiki) go through the
//   local proxy (no cookies ever sent); account/graphql calls never happen
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
    ship(9010, 'Standalone Ship - Drake Corsair', 250, 'Corsair'),
    ship(9011, 'Standalone Ship - Aegis Vanguard Sentinel', 275, 'Vanguard Sentinel'),
    ship(9012, 'Standalone Ship - MISC Freelancer MAX', 150, 'Freelancer MAX'),
    ccu(9013, 'Avenger Titan', 'Cutlass Black', 20),
    ccu(9014, 'Cutlass Black', 'Constellation Andromeda', 130),
    ccu(9015, 'Freelancer', 'Freelancer MAX', 25),
    paint(9016, 'Paints - Carrack Stormbringer Paint', 15),
    paint(9017, 'Paints - Cutlass Black Ghoulish Green Paint', 5),
    addon(9018, 'Add-On - Fleet Week Hangar Poster', 5),
  ];
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
  const store = {
    db: {
      schemaVersion: 2,
      owner,
      sources: {
        hangar: { items: hangar, scannedAt: ts },
        buybacks: { items: buybacks, scannedAt: ts },
        referral: { items: referral, scannedAt: ts },
      },
    },
  };
  window.DEMO_ACCOUNT = {
    loggedIn: true,
    nickname: 'Demo_Citizen',
    displayname: 'Demo Citizen',
    avatar: null,
    enlistedSince: '2016-11-04T00:00:00.000Z',
    countryName: 'United States',
    credits: {
      store: { value: 4250, symbol: '$', label: 'Store Credit', currency: 'USD' },
      uec: { value: 25000, symbol: '¤', label: 'UEC', currency: 'UEC' },
      rec: { value: 12400, symbol: '¤', label: 'REC', currency: 'REC' },
    },
    subscriber: { type: 'Centurion', frequency: 'monthly' },
    concierge: null,
    citizenRecord: 'n/a',
    org: { name: 'Demo Fleet Collective', sid: 'DEMOFLT', rank: 'Admiral', logo: null },
    referral: { code: referral.code, url: referral.url, referrerCode: null },
    fetchedAt: now,
  };
  window.DEMO_REFERRAL = referral;

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
          Object.assign(store, clone(o));
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

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/^https:\/\/(robertsspaceindustries\.com|api\.star-citizen\.wiki)\//.test(url)) {
      if (/\/account\/|\/graphql|\/citizens\//.test(url))
        return Promise.resolve(new Response('', { status: 404 }));
      return realFetch('/proxy?u=' + encodeURIComponent(url), { method: 'GET' });
    }
    return realFetch(input, init);
  };
})();
