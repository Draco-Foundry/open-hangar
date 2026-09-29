/*
 * smoke.mjs: click through the real dashboard (demo account) and fail on the
 * kind of bug unit tests can't see: page errors, empty views, and List-view rows
 * whose columns don't line up. `npm run test:ui` (also runs in CI).
 *
 * Starts the same demo server as `npm run demo` (run.mjs --serve) on port 8323.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL0 = 'http://localhost:8323/';

function findChrome() {
  return [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
    .filter(Boolean)
    .find((p) => fs.existsSync(p));
}

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✖ ${msg}`);
};
const ok = (msg) => console.log(`  ✔ ${msg}`);

const server = spawn(process.execPath, [path.join(HERE, 'run.mjs'), '--serve'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('serving only') && resolve());
  server.on('exit', (c) => reject(new Error(`demo server exited (${c})`)));
});

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: process.env.CI ? ['--no-sandbox'] : [],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => fail(`page error: ${e.message}`));
page.on('console', (m) => {
  // Network hiccups to public APIs aren't our bugs; script errors are.
  if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) {
    fail(`console error: ${m.text()}`);
  }
  // The allowlist sanitizer dropped something we render: add it to SAFE_TAGS /
  // SAFE_ATTRS in dashboard.js (if it's safe) or stop generating it.
  if (m.text().startsWith('[setHTML]')) fail(`sanitizer: ${m.text()}`);
});

const go = async (hash) => {
  await page.goto(URL0 + hash, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 300));
};

// Every cell in a List-view row must start at the same x as the same cell in
// every other row (the Buy-Backs badge bug was a row missing one cell).
async function checkListAlignment(label, rootSel) {
  const bad = await page.$$eval(`${rootSel} .grid.list .card-body`, (bodies) => {
    const cells = (b) =>
      [...b.children].flatMap((c) =>
        getComputedStyle(c).display === 'contents' ? [...c.children] : [c],
      );
    const counts = new Set(bodies.map((b) => cells(b).length));
    const first = bodies[0]
      ? cells(bodies[0]).map((c) => Math.round(c.getBoundingClientRect().left))
      : [];
    const misaligned = bodies.filter((b) =>
      cells(b).some((c, i) => Math.abs(Math.round(c.getBoundingClientRect().left) - first[i]) > 2),
    ).length;
    return { rows: bodies.length, counts: [...counts], misaligned };
  });
  if (!bad.rows) fail(`${label}: no List rows rendered`);
  else if (bad.counts.length > 1 || bad.misaligned)
    fail(
      `${label}: List rows don't line up (cell counts ${bad.counts.join('/')}, ${bad.misaligned} misaligned)`,
    );
  else ok(`${label}: ${bad.rows} List rows aligned`);
}

try {
  console.log('Home');
  await go('#home');
  const cards = await page.$$eval('#home-summary .sum-box', (e) => e.length);
  cards ? ok(`summary shows ${cards} boxes`) : fail('home summary empty');
  const home = await page.evaluate(async () => {
    OH.getShipStock = async (url) =>
      /Cutlass-Black/i.test(url)
        ? { state: 'in', price: 110, packs: [] }
        : { state: 'out', price: null, packs: [] };
    state.wishlist = ['Cutlass Black', 'Pioneer'];
    renderHomePanels();
    await new Promise((r) => setTimeout(r, 600));
    const wish = document.querySelector('#home-wish').textContent;
    const glance = document.querySelector('#home-glance').textContent;
    state.wishlist = [];
    renderHomePanels();
    return {
      guide:
        !!document.querySelector('details.howto-all') &&
        !document.querySelector('details.howto-all').open,
      cards: document.querySelectorAll('.home-card').length,
      wish,
      glance,
      storeOpt: !!document.querySelector('.scan-src[value="store"]'),
    };
  });
  const menu = await page.evaluate(() => {
    document.querySelector('#scan-menu-btn').click();
    const m = document.querySelector('#scan-menu').getBoundingClientRect();
    const b = document.querySelector('#scan-menu-btn').getBoundingClientRect();
    // The element actually drawn at the menu's first option must be the menu.
    const hit = document.elementFromPoint(m.left + 20, m.top + 14);
    const res = {
      below: m.top >= b.bottom,
      inView: m.top >= 0 && m.bottom <= innerHeight,
      visible: !!hit && !!hit.closest('#scan-menu'),
    };
    document.body.click();
    return res;
  });
  await page
    .waitForFunction(() => document.querySelectorAll('#home-news .news-list li').length > 0, {
      timeout: 8000,
    })
    .catch(() => {});
  const news = await page.evaluate(() => ({
    n: document.querySelectorAll('#home-news .news-list li').length,
    first: document.querySelector('#home-news .news-title')?.textContent || '',
    link: document.querySelector('#home-news .news-list a')?.href || '',
  }));
  news.n === 6 && /This Week in Star Citizen/.test(news.first) && /comm-link/.test(news.link)
    ? ok(`home: Latest from RSI (${news.n} posts, "${news.first}")`)
    : fail(`home news: ${JSON.stringify(news)}`);
  menu.below && menu.inView && menu.visible
    ? ok('scan menu opens below the button, fully visible')
    : fail(`scan menu: ${JSON.stringify(menu)}`);
  home.guide && home.cards === 0
    ? ok('how-to guide folded into one closed dropdown; no link cards')
    : fail(`home layout: ${JSON.stringify(home)}`);
  /On Sale Now 1/.test(home.wish) && /Cutlass Black/.test(home.wish) && !/Pioneer/.test(home.wish)
    ? ok('home: wishlist ships on sale now')
    : fail(`home wishlist: ${home.wish}`);
  /Next referral reward/.test(home.glance) &&
  !/Buy-back tokens|Last scan|Melt candidates/.test(home.glance) &&
  home.storeOpt
    ? ok('home: at-a-glance (no repeats of the card); Scan has a Store (wishlist) option')
    : fail(`home glance: ${JSON.stringify(home)}`);
  const site = await page.$eval('#site-link', (e) => e.textContent).catch(() => '');
  /something big is coming/i.test(site) && !(await page.$('#site-link button'))
    ? ok('website sync shows the teaser (no connect button)')
    : fail(`site link: "${site}"`);

  // Currency: EUR converts the melt box (needs the live rates service).
  const rates = await page.evaluate(async () => {
    try {
      return JSON.stringify(await OH.getFxRates());
    } catch (e) {
      return 'ERR ' + e.message;
    }
  });
  /"EUR":/.test(rates) ? ok('exchange rates load') : fail(`exchange rates: ${rates}`);
  await page.select('#currency-select', 'EUR');
  await page
    .waitForFunction(() => /€/.test(document.querySelector('#view-home').textContent), {
      timeout: 8000,
    })
    .catch(() => {});
  const eur = await page.$eval('#view-home', (e) => /€[\d,]+\.\d\d/.test(e.textContent));
  eur ? ok('currency switch shows €') : fail(`currency switch: no € on Home`);
  await page.select('#currency-select', 'USD');
  await new Promise((r) => setTimeout(r, 300));

  console.log('Inventory');
  await go('#inventory');
  const n = await page.$$eval('#results .card', (e) => e.length);
  // A broken RSI image falls back to the ship-art lookup by name.
  await page
    .waitForSelector('#results .card[data-resolve] img.thumb', { timeout: 15000 })
    .catch(() => {});
  const broken = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#results .card')].find(
      (c) => c.querySelector('img.thumb') && c.dataset.resolve,
    );
    if (!card) return null;
    card.querySelector('img.thumb').src =
      'https://robertsspaceindustries.com/media/open-hangar-missing/broken.jpg';
    return card.dataset.id;
  });
  if (broken) {
    await page
      .waitForFunction(
        (id) => {
          const img = document.querySelector(`#results .card[data-id="${id}"] img.thumb`);
          return (
            img && !/open-hangar-missing/.test(img.src) && img.complete && img.naturalWidth > 0
          );
        },
        { timeout: 15000 },
        broken,
      )
      .then(() => ok('broken RSI image falls back to ship art'))
      .catch(() => fail('broken RSI image did not fall back'));
  }
  n >= 10 ? ok(`${n} cards`) : fail(`only ${n} inventory cards`);
  await page.click('.card[data-id]');
  (await page.$eval('#item-modal', (m) => !m.hidden && getComputedStyle(m).display !== 'none'))
    ? ok('item details open')
    : fail('item details did not open');
  await page.keyboard.press('Escape');
  await page.click('#layout [data-layout="list"]');
  await checkListAlignment('Inventory', '#results');
  await page.click('#layout [data-layout="market"]');
  (await page.$('.market-table')) ? ok('Market view renders') : fail('Market view empty');
  // Tick a row without Select mode; % and price stay linked.
  await page.click('.market-table .mk-pick');
  const mk = await page.evaluate(() => {
    const row = document.querySelector('.market-table .mk-row');
    const pct = row.querySelector('.mk-pct-in');
    pct.value = '50';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      count: document.querySelector('.mk-selcount').textContent,
      bar: !document.querySelector('#select-bar').hidden,
      price: Number(row.querySelector('.mk-price').value),
      melt: Number(row.dataset.melt),
    };
  });
  /1 picked/.test(mk.count) && mk.bar
    ? ok('market rows tick without Select mode')
    : fail(`market tick: ${JSON.stringify(mk)}`);
  Math.abs(mk.price - mk.melt / 2) < 0.01
    ? ok(`50% of melt → $${mk.price}`)
    : fail(`% of melt: ${JSON.stringify(mk)}`);
  await page.evaluate(() => {
    const row = document.querySelector('.market-table .mk-row');
    const price = row.querySelector('.mk-price');
    price.value = '';
    price.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('.market-table .mk-pick');
  // Typing a % ticks the row on its own.
  const autoTick = await page.evaluate(() => {
    const row = document.querySelectorAll('.market-table .mk-row')[1];
    const pct = row.querySelector('.mk-pct-in');
    pct.value = '60';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    const ticked = row.querySelector('.mk-pick').checked;
    const store = row.querySelector('.mk-store').textContent.trim();
    pct.value = '';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    row.querySelector('.mk-pick').click();
    return { ticked, store };
  });
  autoTick.ticked ? ok('typing a % ticks the row') : fail('typing a % did not tick the row');
  /^\$\d/.test(autoTick.store)
    ? ok(`store price column (${autoTick.store})`)
    : fail(`store price: "${autoTick.store}"`);
  await page.click('#layout [data-layout="gallery"]');
  await page.click('#select-toggle');
  const [c1, c2] = await page.$$('#results .card');
  await c1.click();
  await c2.click();
  const sel = await page.$eval('#sb-count', (e) => e.textContent);
  /2 selected/.test(sel) ? ok('select mode picks items') : fail(`select mode: "${sel}"`);
  await page.click('[data-sb="done"]');

  console.log('Broken thumbnails');
  await go('#inventory');
  const thumb = await page.evaluate(async () => {
    const img = document.querySelector('#results .card img.thumb');
    const card = img.closest('.card');
    img.src = `${location.origin}/missing-${Date.now()}.jpg`; // 404
    await new Promise((r) => setTimeout(r, 800));
    const retried = img.dataset.retried === '1' && img.isConnected; // waiting to retry
    await new Promise((r) => setTimeout(r, 2500));
    return { retried, placeholder: !!card.querySelector('.thumb.placeholder, img.thumb') };
  });
  thumb.retried && thumb.placeholder
    ? ok('a failed picture is retried once before falling back')
    : fail(`thumbnail retry: ${JSON.stringify(thumb)}`);

  const hi = await page.evaluate(() => [
    hiResCandidates('https://robertsspaceindustries.com/media/abc123/store_hub_small/Pioneer.jpg'),
    hiResCandidates('https://media.robertsspaceindustries.com/abc123/store_small.jpg'),
    hiResCandidates('https://robertsspaceindustries.com/media/abc123/source/Pioneer.jpg'),
  ]);
  hi[0][0] === 'https://robertsspaceindustries.com/media/abc123/slideshow_wide/Pioneer.jpg' &&
  hi[1][0] === 'https://media.robertsspaceindustries.com/abc123/slideshow_wide.jpg' &&
  hi[2].length === 0
    ? ok('sharp pictures for both RSI image forms (buy-backs included)')
    : fail(`hi-res candidates: ${JSON.stringify(hi)}`);

  console.log('Search and ship details');
  await go('#home');
  await page
    .waitForFunction(() => window.state && state.catalog && state.catalog.length, {
      timeout: 15000,
    })
    .catch(() => {});
  const gs = await page.evaluate(async () => {
    const box = document.querySelector('#gsearch');
    box.value = 'cutlass';
    box.dispatchEvent(new Event('input'));
    const out = document.querySelector('#gsearch-results');
    const groups = [...out.querySelectorAll('.gs-title')].map((t) => t.textContent);
    const ship = out.querySelector('.gs-row[data-ship]');
    const shipName = ship && ship.dataset.ship;
    ship?.click();
    await new Promise((r) => setTimeout(r, 300));
    const modal = document.querySelector('#modal-body');
    return {
      groups,
      shipName,
      closed: out.hidden,
      title: modal.querySelector('.modal-name')?.textContent,
      inHangar: /In Your Hangar \(\d+\)/.test(modal.textContent),
      links: modal.querySelectorAll('.mr-v a').length,
    };
  });
  await page.evaluate(() => document.querySelector('#modal-close').click());
  gs.groups.includes('Ships') && gs.groups.includes('Your Hangar') && gs.closed
    ? ok(`search "cutlass": ${gs.groups.join(', ')}`)
    : fail(`global search: ${JSON.stringify(gs)}`);
  gs.title && gs.inHangar && gs.links >= 3
    ? ok(`ship window for ${gs.title}: specs, pledges, links`)
    : fail(`ship window: ${JSON.stringify(gs)}`);
  const loan = await page.evaluate(() => {
    const m = OH.parseLoanerMatrix(
      '<table><tr><td>Carrack</td><td>C8 Pisces, URSA Rover</td></tr></table>',
    );
    return OH.loanersFor('Carrack', m);
  });
  loan && loan.loaners.length === 2
    ? ok('loaner lookup works in the page')
    : fail(`loaners: ${JSON.stringify(loan)}`);
  const flyable = await page.evaluate(() => {
    loanerMatrix = OH.parseLoanerMatrix(
      '<table><tr><td>Carrack</td><td>C8 Pisces</td></tr><tr><td>Pioneer</td><td>Caterpillar, Nomad</td></tr></table>',
    );
    includedVessels = OH.parseLoanerMatrix(
      '<table><tr><td>Carrack</td><td>C8 Pisces, URSA Rover</td></tr></table>',
    );
    return {
      carrack: loanersOf('Carrack'),
      pioneer: loanersOf('Pioneer'),
      inc: includedOf('Carrack'),
    };
  });
  !flyable.carrack &&
  flyable.pioneer &&
  flyable.pioneer.loaners.length === 2 &&
  flyable.inc &&
  flyable.inc.length === 2
    ? ok('loaners only for unflyable ships; Carrack shows its included vessels instead')
    : fail(`flight-ready filter: ${JSON.stringify(flyable)}`);

  console.log('Item types');
  const types = await page.evaluate(() => {
    const p = (name) => ({ name, containsShip: false, isCCU: false });
    const kind = (label) => contentKind({ kind: '', label });
    return {
      hangar: isHangar(p('Add-Ons - VFG Industrial Hangar')),
      notHangar: isHangar(p('Hangarbay Poster')),
      claim: isLandClaim(p('Geotack Planetary Beacon')) && isLandClaim(p('Geotack-X')),
      section: marketSectionOf(p('Geotack-X Planetary Beacon')).label,
      gear: kind("Quirinus Tech Artimex 'Akuma' Core"),
      notGear: kind('Score Poster'),
      claimKind: kind('Geotack Planetary Beacon'),
    };
  });
  types.hangar && !types.notHangar && types.claim && types.section === 'Land Claims'
    ? ok('hangars and land claims (Geotack) grouped')
    : fail(`item grouping: ${JSON.stringify(types)}`);
  types.gear === 'Gear' && types.notGear === '—' && types.claimKind === 'Land Claim'
    ? ok('unlabelled contents: Gear / Land Claim, no false matches')
    : fail(`content kinds: ${JSON.stringify(types)}`);

  console.log('Buy-Backs');
  await go('#buybacks');
  const tok = await page.$eval('.bb-tokens', (e) => e.textContent).catch(() => '');
  /have 2 buy-back tokens/.test(tok) ? ok('buy-back tokens shown') : fail(`tokens: "${tok}"`);
  await page.select('#bb-sort', 'price-desc');
  const bbPrices = await page.$$eval('#buybacks-body .card .val', (v) =>
    v.map((e) => Number(e.textContent.replace(/[$,]/g, ''))),
  );
  bbPrices.length && bbPrices.every((x, i) => i === 0 || bbPrices[i - 1] >= x)
    ? ok(`buy-backs sort by price (${bbPrices.length} priced)`)
    : fail(`buy-back price sort: ${JSON.stringify(bbPrices)}`);
  await page.select('#bb-sort', 'date-desc');
  await page.click('#bb-layout [data-layout="market"]');
  const bbm = await page.evaluate(() => ({
    rows: document.querySelectorAll('#buybacks-body .market-table tbody tr').length,
    cards: window.state ? null : null,
    reclaim: [...document.querySelectorAll('#buybacks-body .market-table tbody tr')].every((r) =>
      /Reclaim/.test(r.textContent),
    ),
    ins: !!document.querySelector('#buybacks-body .market-table .mk-ins'),
  }));
  const bbTotal = await page.$eval('#buybacks-body .result-count', (e) =>
    Number((e.textContent.match(/of (\d+)/) || [])[1]),
  );
  bbm.rows === bbTotal && bbm.reclaim && bbm.ins
    ? ok(`buy-back market: ${bbm.rows} rows, one each, Reclaim + Insurance`)
    : fail(`buy-back market: ${JSON.stringify(bbm)} vs ${bbTotal}`);
  // Market tools: pricing a row ticks it; picked rows are totalled.
  const bbTools = await page.evaluate(() => {
    const row = document.querySelector('#buybacks-body .market-table tbody tr');
    const pct = row.querySelector('.mk-pct-in');
    pct.value = '50';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      picked: row.querySelector('.mk-pick').checked,
      price: row.querySelector('.mk-price').value,
      sel: document.querySelector('#buybacks-body .mk-selcount').textContent,
      exports:
        !!document.querySelector('.bb-export-csv') && !!document.querySelector('.bb-export-img'),
      store: !!document.querySelector('#buybacks-body .mk-store'),
    };
  });
  bbTools.picked &&
  bbTools.price &&
  /1 picked/.test(bbTools.sel) &&
  bbTools.exports &&
  bbTools.store
    ? ok(`buy-back market tools: pick, % → price, total ("${bbTools.sel.trim()}"), exports`)
    : fail(`buy-back market tools: ${JSON.stringify(bbTools)}`);
  await page.evaluate(() => {
    const box = document.querySelector('#buybacks-body .mk-pick');
    box.click(); // untick so later checks start clean
    const row = box.closest('tr');
    const price = row.querySelector('.mk-price');
    price.value = '';
    price.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Click a name: the details window reads the buy-back's own page.
  await page.click('#buybacks-body .bb-open');
  await page
    .waitForFunction(
      () => /Also Contains/.test(document.querySelector('#modal-body').textContent),
      {
        timeout: 8000,
      },
    )
    .catch(() => {});
  const bbModal = await page.$eval('#modal-body', (e) => e.textContent);
  /Also Contains/.test(bbModal) && /Lifetime Insurance/.test(bbModal) && /LTI/.test(bbModal)
    ? ok('buy-back details: ships, insurance, also contains')
    : fail(`buy-back details: "${bbModal.slice(0, 160)}"`);
  await page.keyboard.press('Escape');
  await page.click('#bb-layout [data-layout="gallery"]');
  await page.click('#bb-layout [data-layout="list"]');
  await checkListAlignment('Buy-Backs', '#buybacks-body');

  console.log('Stats');
  await go('#stats');
  for (const tab of ['overview', 'value', 'fleet', 'history']) {
    // the tab row re-renders on every click, so click via the DOM
    await page.$eval(`[data-stats-tab="${tab}"]`, (b) => b.click());
    await new Promise((r) => setTimeout(r, 200));
    const text = await page.$eval('#stats-body', (e) => e.textContent.trim().length);
    text > 40 ? ok(`${tab} tab renders`) : fail(`${tab} tab is empty`);
  }

  for (const [tab, sel] of [
    ['collection', '#stats-body .bar-row'],
    ['buybacks', '#stats-body .stat-box'],
    ['top', '#stats-body .row.clickable'],
  ]) {
    await page.evaluate((t) => document.querySelector(`[data-stats-tab="${t}"]`).click(), tab);
    await page.waitForSelector(sel, { timeout: 8000 }).catch(() => {});
    (await page.$(sel)) ? ok(`${tab} tab renders`) : fail(`${tab} tab empty`);
  }
  await page.click('#stats-body .row.clickable');
  (await page.$eval('#item-modal', (m) => !m.hidden))
    ? ok('top list row opens the pledge')
    : fail('top list row did not open');
  await page.keyboard.press('Escape');

  console.log('Org Fleet');
  await go('#org');
  await page.click('#org-mine');
  const buddy = path.join(os.tmpdir(), 'open-hangar-htf-Buddy-2026-01-01.json');
  fs.writeFileSync(
    buddy,
    JSON.stringify([
      { name: 'Carrack', entity_type: 'ship', lti: true },
      { name: 'Cutlass Black', entity_type: 'ship', lti: false },
    ]),
  );
  const input = await page.$('#org-file');
  await input.uploadFile(buddy);
  await page
    .waitForFunction(() => document.querySelectorAll('.org-member').length >= 2, { timeout: 15000 })
    .catch(() => {});
  await page
    .waitForFunction(() => document.querySelector('.org-table tbody tr'), { timeout: 20000 })
    .catch(() => {});
  const org = await page.evaluate(() => ({
    members: document.querySelectorAll('.org-member').length,
    rows: document.querySelectorAll('.org-table tbody tr').length,
  }));
  org.members === 2 && org.rows > 0
    ? ok(`org fleet: ${org.members} members, ${org.rows} ship types`)
    : fail(`org fleet: ${JSON.stringify(org)}`);
  const roleChips = await page.$$eval('.role-chip', (c) => c.length);
  const memberRows = await page.$$eval('.org-table', (t) => t.length);
  roleChips === 16 && memberRows >= 3
    ? ok(`org roles (${roleChips}) + biggest ships + members`)
    : fail(`org extras: ${roleChips} role chips, ${memberRows} tables`);
  await page.click('.role-chip.missing');
  (await page.$('.org-panel'))
    ? ok('missing role opens suggestions')
    : fail('role click opened nothing');
  await page.click('.org-mrow');
  (await page.$('.pair-row')) ? ok('member opens vs-org charts') : fail('member panel missing');
  const names = await page.$$eval('.org-cmp[data-side="a"] option', (o) =>
    o.map((x) => x.value).filter(Boolean),
  );
  await page.select('.org-cmp[data-side="a"]', names[0]);
  await page.select('.org-cmp[data-side="b"]', names[1]);
  (await page.$('.cmp-cols')) ? ok('compare two members') : fail('compare panel missing');

  console.log('Store');
  await go('#store');
  await page
    .waitForFunction(() => document.querySelectorAll('#price-table tbody tr').length > 50, {
      timeout: 20000,
    })
    .catch(() => {});
  const prices = await page.$$eval('#price-table tbody tr', (r) => r.length);
  prices > 50 ? ok(`price list: ${prices} ships`) : fail(`price list only ${prices} rows`);
  const st = await page.evaluate(async () => {
    const rows = () => document.querySelectorAll('#price-table tbody tr').length;
    const flying = rows(); // default tab: Flight Ready
    document.querySelector('[data-price-tab="all"]').click();
    const all = rows();
    document.querySelector('[data-price-tab="in-concept"]').click();
    const concept = rows();
    const ccus = document.querySelectorAll('#ccu-owned tbody tr').length;
    // "In store now" comes from each ship's own store page (stubbed here):
    // Cutlass Black sold on its own, Carrack only in a pack.
    OH.getShipStock = async (url) =>
      /Cutlass-Black/i.test(url)
        ? { state: 'in', price: 110, packs: [] }
        : { state: 'pack', price: null, packs: [{ name: 'Ultimate Explorer Pack', price: 1150 }] };
    // Wishlist a ship with buy-backs; its row opens the list of them.
    state.wishlist = ['Cutlass Black', 'Carrack'];
    // A pack buy-back whose loaded details include the Carrack counts for it.
    state.buybacks.push({
      id: '999001',
      kind: 'pack',
      name: 'Packs - Origin Complete Pack 2951',
      contains: '400i and 9 other items',
    });
    state.bbDetails['999001'] = { ships: [{ name: 'Carrack' }], also: [] };
    renderStore();
    const packRow = [...document.querySelectorAll('#wishlist tbody tr')].find((r) =>
      /^Carrack/.test(r.textContent.trim()),
    );
    const packSummary = packRow ? packRow.textContent : '';
    state.buybacks.pop();
    delete state.bbDetails['999001'];
    renderStore();
    await new Promise((r) => setTimeout(r, 300));
    const stock = [...document.querySelectorAll('#wishlist .sale')].map((e) => e.textContent);
    document.querySelector('[data-wish-bbs]')?.click();
    const sub = document.querySelector('.wish-bbs');
    const res = {
      flying,
      all,
      concept,
      ccus,
      stock,
      priceStock: document.querySelectorAll('#price-table .sale').length,
      tabs: [...document.querySelectorAll('[data-price-tab]')].map((b) => b.textContent),
      bbRows: sub && !sub.hidden ? sub.querySelectorAll('table.inner > tbody > tr').length : 0,
      bbTypes: sub ? [...sub.querySelectorAll('tbody .badge')].map((b) => b.textContent) : [],
      pack: /1 pack/.test(packSummary) && !/buy-back|to it/.test(packSummary),
      reclaim: sub ? /Reclaim/.test(sub.textContent) : false,
      panels: document.querySelectorAll('#view-store .store-panel').length,
      ccugame: /ccugame/i.test(document.querySelector('#view-store').textContent),
    };
    state.wishlist = [];
    state.priceTab = 'flight-ready';
    return res;
  });
  st.panels === 3 &&
  st.all > st.flying &&
  st.concept > 0 &&
  !st.ccugame &&
  !st.tabs.includes('For Sale Now') &&
  st.tabs.join('|') === 'Flight Ready|In Concept|All' &&
  st.priceStock === 0
    ? ok(`store panels: ${st.flying} flight ready, ${st.all} in all, ${st.concept} in concept`)
    : fail(`store page: ${JSON.stringify(st)}`);
  st.stock.join('|') === 'Only in a pack|In stock ($110)' &&
  st.ccus > 0 &&
  st.bbRows > 0 &&
  st.reclaim &&
  st.bbTypes.length === st.bbRows &&
  st.pack &&
  st.bbTypes.join() === [...st.bbTypes].sort((a, b) => (a === 'CCU') - (b === 'CCU')).join()
    ? ok(
        `wishlist stock from ship pages (${st.stock.join(', ')}), buy-backs (${st.bbTypes.join(', ')})`,
      )
    : fail(`store details: ${JSON.stringify(st)}`);

  const ws = await page.evaluate(async () => {
    OH.getShipStock = async (url) =>
      /Cutlass-Black/i.test(url)
        ? { state: 'in', price: 110, packs: [] }
        : /Carrack/i.test(url)
          ? { state: 'pack', price: null, packs: [{ name: 'Some Pack' }] }
          : { state: 'out', price: null, packs: [] };
    state.wishlist = ['Pioneer', 'Cutlass Black', 'Carrack'];
    const order = () =>
      [...document.querySelectorAll('#wishlist .wishlist > tbody > tr:not(.wish-bbs)')].map(
        (r) => r.querySelector('.ship-link').textContent,
      );
    const pick = async (v) => {
      const sel = document.querySelector('#wish-sort');
      sel.value = v;
      sel.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 300));
      return order().join(',');
    };
    const res = {
      name: await pick('name'),
      high: await pick('price-desc'),
      low: await pick('price-asc'),
      stock: await pick('stock'),
      mineBefore: await pick('mine'),
      grips: document.querySelectorAll('#wishlist .wish-grip').length,
    };
    moveWishlist('Carrack', 'Pioneer');
    res.mineAfter = order().join(',');
    state.wishlist = [];
    state.wishSort = 'name';
    chrome.storage.local.set({ uiWishSort: 'name', wishlist: [] });
    return res;
  });
  ws.name === 'Carrack,Cutlass Black,Pioneer' &&
  ws.high === 'Pioneer,Carrack,Cutlass Black' &&
  ws.low === 'Cutlass Black,Carrack,Pioneer' &&
  ws.stock === 'Cutlass Black,Carrack,Pioneer' &&
  ws.mineBefore === 'Pioneer,Cutlass Black,Carrack' &&
  ws.grips === 3 &&
  ws.mineAfter === 'Carrack,Pioneer,Cutlass Black'
    ? ok('wishlist sorts (name, price both ways, in stock first) and drag order')
    : fail(`wishlist sort: ${JSON.stringify(ws)}`);

  // A real mouse drag in "My order": the last row dragged to the top.
  const rowsBox = await page.evaluate(async () => {
    state.wishlist = ['Pioneer', 'Cutlass Black', 'Carrack'];
    state.wishSort = 'mine';
    renderStore();
    await new Promise((r) => setTimeout(r, 200));
    const rows = [...document.querySelectorAll('#wishlist tr[data-wish-name]')];
    rows[rows.length - 1].scrollIntoView({ block: 'center' });
    return rows.map((r) => {
      const b = r.querySelector('.wish-grip').getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
  });
  await page.mouse.move(rowsBox[2].x, rowsBox[2].y);
  await page.mouse.down();
  let lifted = false;
  for (let k = 1; k <= 12; k++) {
    await page.mouse.move(
      rowsBox[2].x,
      rowsBox[2].y + ((rowsBox[0].y - 20 - rowsBox[2].y) * k) / 12,
    );
    if (k === 6)
      lifted = await page.evaluate(() => !!document.querySelector('#wishlist tr.lifted'));
  }
  await page.mouse.up();
  const dragged = await page.evaluate(() => {
    const out = state.wishlist.join(',');
    state.wishlist = [];
    state.wishSort = 'name';
    chrome.storage.local.set({ uiWishSort: 'name', wishlist: [] });
    renderStore();
    return out;
  });
  lifted && dragged === 'Carrack,Pioneer,Cutlass Black'
    ? ok('mouse drag lifts the row and reorders the wishlist')
    : fail(`live drag: lifted=${lifted} order=${dragged}`);

  // Panel searches: counts in the placeholder, "N of M" while typing, no CCU
  // search for a handful of CCUs.
  const sm = await page.evaluate(async () => {
    const box = document.querySelector('#price-search');
    const placeholder = box.placeholder;
    box.value = 'cutlass';
    box.dispatchEvent(new Event('input'));
    const count = document.querySelector('#price-search-count').textContent;
    box.value = '';
    box.dispatchEvent(new Event('input'));
    return {
      placeholder,
      count,
      cleared: document.querySelector('#price-search-count').textContent,
      ccuHidden: document.querySelector('#ccu-search').hidden,
    };
  });
  /^Search \d+ ships…$/.test(sm.placeholder) &&
  /^\d+ of \d+$/.test(sm.count) &&
  !sm.cleared &&
  sm.ccuHidden
    ? ok(`panel search: "${sm.placeholder}", "${sm.count}", CCU search hidden for a few CCUs`)
    : fail(`panel search: ${JSON.stringify(sm)}`);

  console.log('Updates');
  await go('#updates');
  await page.waitForSelector('#updates-body .release', { timeout: 5000 }).catch(() => {});
  const rel = await page.$$eval('#updates-body .release', (r) => r.length);
  const tags = await page.$$eval('.release-tag', (t) => t.map((e) => e.textContent).join('|'));
  rel >= 3 ? ok(`${rel} releases listed`) : fail(`only ${rel} releases listed`);
  /Your version/.test(tags) ? ok('current version tagged') : fail('current version not tagged');
  const chk = await page.evaluate(async () => {
    const btn = document.querySelector('#update-check-btn');
    const out = () => document.querySelector('#update-check-status').textContent;
    btn.click(); // no update API in the demo = Firefox
    const firefox = out();
    chrome.runtime.requestUpdateCheck = async () => ({
      status: 'update_available',
      version: '9.9.9',
    });
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const chrome1 = out();
    delete chrome.runtime.requestUpdateCheck;
    return { cur: document.querySelector('#update-cur').textContent, firefox, chrome1 };
  });
  chk.cur && /about:addons/.test(chk.firefox) && /9\.9\.9 is downloading/.test(chk.chrome1)
    ? ok('Check for updates: store check (Chrome) and directions (Firefox)')
    : fail(`check for updates: ${JSON.stringify(chk)}`);

  console.log('Saved accounts');
  await go('#developers');
  const prof = await page.$$eval('#profiles .profile-row', (r) => r.map((e) => e.textContent));
  prof.length && /signed in/.test(prof[0])
    ? ok(`${prof.length} saved account(s) listed`)
    : fail('saved accounts list empty');

  console.log('Referrals');
  await go('#referrals');
  const refUi = await page.evaluate(() => ({
    hero: document.querySelector('.ref-hero-n')?.textContent.trim(),
    next: document.querySelector('.ref-hero-next')?.textContent.trim(),
    dots: document.querySelectorAll('.rt-step').length,
    lit: document.querySelectorAll('.rt-step.on').length,
    gallery: document.querySelectorAll('.ref-gcard').length,
    timeline: document.querySelectorAll('.ref-timeline li').length,
    ageBars: document.querySelectorAll('.ref-charts .bar-row').length,
    banner: !!document.querySelector('.ref-event-banner'),
  }));
  /^14 recruits/.test(refUi.hero) && /more to/.test(refUi.next)
    ? ok(`progress hero: "${refUi.hero}", "${refUi.next.slice(0, 50)}…"`)
    : fail(`referral hero: ${JSON.stringify(refUi)}`);
  refUi.dots > 19 && refUi.lit >= 10
    ? ok(`ladder tracks: ${refUi.lit} of ${refUi.dots} tiers lit`)
    : fail(`ladder tracks: ${JSON.stringify(refUi)}`);
  // Hovering a ladder dot pops up that tier's reward picture with a caption.
  await page.waitForSelector('.rt-step[data-image]', { timeout: 15000 }).catch(() => {});
  const dotBox = await page.evaluate(() => {
    const d = document.querySelector('.rt-step[data-image]');
    if (!d) return null;
    d.scrollIntoView({ block: 'center' });
    const b = d.querySelector('.rt-dot').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, tip: d.dataset.tip };
  });
  let dotPop = null;
  if (dotBox) {
    await page.mouse.move(dotBox.x, dotBox.y);
    await new Promise((r) => setTimeout(r, 300));
    dotPop = await page.evaluate(() => {
      const p = document.querySelector('#item-preview');
      return {
        shown: p.classList.contains('show'),
        cap: p.querySelector('.ip-cap').textContent,
        img: !!p.querySelector('img').getAttribute('src'),
      };
    });
    await page.mouse.move(5, 5);
  }
  dotPop && dotPop.shown && dotPop.img && dotPop.cap === dotBox.tip
    ? ok(`ladder dot hover: picture + "${dotPop.cap.slice(0, 40)}…"`)
    : fail(`ladder dot hover: ${JSON.stringify({ dotBox, dotPop })}`);
  refUi.gallery >= 10 && refUi.timeline >= 10 && refUi.ageBars >= 5 && refUi.banner
    ? ok(
        `gallery ${refUi.gallery} rewards, ${refUi.timeline} milestones, prospect ages, event banner`,
      )
    : fail(`referral sections: ${JSON.stringify(refUi)}`);
  // jsQR (dev-only) reads the QR back out of the finished image.
  await page.addScriptTag({ path: 'node_modules/jsqr/dist/jsQR.js' });
  const share = await page.evaluate(async () => {
    let types = null;
    window.downloadBlob = (blob, name) => {
      types = [blob.type, name];
    };
    document.querySelector('#ref-share-code').checked = true;
    const c = await referralShareCanvas({ withCode: true });
    document.querySelector('#ref-share').click();
    await new Promise((r) => setTimeout(r, 1500));
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const qr = window.jsQR(px.data, c.width, c.height);
    return {
      w: c.width,
      h: c.height,
      qr: qr && qr.data,
      types,
      status: document.querySelector('#ref-share-status').textContent,
    };
  });
  share.w > 1000 &&
  share.types &&
  share.types[0] === 'image/png' &&
  /\.png$/.test(share.types[1]) &&
  share.qr === 'https://robertsspaceindustries.com/enlist?referral=STAR-DEMO-0000'
    ? ok(`share image ${share.w}×${share.h}, QR scans to the referral link, "${share.status}"`)
    : fail(`share image: ${JSON.stringify(share)}`);

  console.log('Wishlist, spending, events');
  const wse = await page.evaluate(async () => {
    openShipModal('Carrack');
    const btn = document.querySelector('[data-wish-toggle]');
    const before = btn.textContent;
    btn.click();
    const after = btn.textContent;
    document.querySelector('#modal-close').click();
    location.hash = '#store';
    await new Promise((r) => setTimeout(r, 400));
    const wish = document.querySelector('#wishlist').textContent;
    document.querySelector('[data-wish-remove]')?.click();
    const undoBar = document.querySelector('#wish-undo');
    const undoShown = !undoBar.hidden && /Removed Carrack/.test(undoBar.textContent);
    undoBar.querySelector('[data-wish-undo]').click();
    const restored = state.wishlist.length === 1 && undoBar.hidden;
    document.querySelector('[data-wish-remove]')?.click();
    const cleared = !state.wishlist.length && undoShown && restored;
    setStatsTab('spending');
    location.hash = '#stats';
    await new Promise((r) => setTimeout(r, 400));
    const spend = document.querySelector('#stats-body').textContent;
    const bars = document.querySelectorAll('#stats-body .bar-row').length;
    // A bonus event running today shows the Home banner.
    const today = new Date().toISOString().slice(0, 10);
    referralEvents = [
      ...referralEvents,
      { start: today, end: today, name: 'Test Expo', reward: 'Drake Dragonfly with LTI' },
    ];
    location.hash = '#home';
    await new Promise((r) => setTimeout(r, 400));
    const banner = document.querySelector('#event-banner');
    return {
      before,
      after,
      wish: /Carrack/.test(wish),
      cleared,
      spend: /pledged in total/.test(spend),
      bars,
      banner: !banner.hidden && /Test Expo/.test(banner.textContent),
    };
  });
  wse.before === 'Add to Wishlist' &&
  wse.after === 'Remove from Wishlist' &&
  wse.wish &&
  wse.cleared
    ? ok('wishlist: add from the ship window, listed on Store, remove with Undo')
    : fail(`wishlist: ${JSON.stringify(wse)}`);
  wse.spend && wse.bars >= 3
    ? ok(`spending tab: ${wse.bars} years`)
    : fail(`spending: ${JSON.stringify(wse)}`);
  wse.banner
    ? ok('home banner while a bonus event runs')
    : fail(`event banner: ${JSON.stringify(wse)}`);

  for (const view of ['referrals', 'developers']) {
    console.log(view[0].toUpperCase() + view.slice(1));
    await go('#' + view);
    const len = await page.$eval(`#view-${view}`, (e) => e.textContent.trim().length);
    len > 100 ? ok('renders') : fail(`${view} view looks empty`);
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.log(`\n${failures.length} UI check(s) failed.`);
  process.exit(1);
}
console.log('\nAll UI checks passed.');
