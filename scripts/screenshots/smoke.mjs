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
  // The Svelte Home (ui/home) mounts under the Citizen Card.
  await page.waitForSelector('#oh-home .big', { timeout: 8000 }).catch(() => {});
  const val = await page.evaluate(() => ({
    big: document.querySelector('#oh-home .big')?.textContent || '',
    counts: [...document.querySelectorAll('#oh-home .counts a')].map((a) => a.textContent.trim()),
    font: getComputedStyle(document.querySelector('#oh-home h3')).fontFamily,
  }));
  val.big && val.counts.some((c) => /ships?$/.test(c)) && /Manrope/.test(val.font)
    ? ok(`value card: ${val.big}, ${val.counts.join(' · ')} (bundled Manrope)`)
    : fail(`home value card: ${JSON.stringify(val)}`);
  const clicks = await page.evaluate(async () => {
    [...document.querySelectorAll('#oh-home .counts a')]
      .find((a) => /LTI/.test(a.textContent))
      .click();
    await new Promise((r) => setTimeout(r, 200));
    const lti = location.hash === '#inventory' && state.traits.get('lti') === 'yes';
    state.traits = new Map();
    location.hash = '#home';
    await new Promise((r) => setTimeout(r, 300));
    const rows = document.querySelectorAll('#oh-home .li').length;
    document.querySelector('#oh-home .li')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const modal = !document.querySelector('#item-modal').hidden;
    document.querySelector('#item-modal').hidden = true;
    return { lti, rows, modal };
  });
  clicks.lti && clicks.rows === 5 && clicks.modal
    ? ok('home: LTI count filters Inventory; 5 latest acquisitions, a row opens details')
    : fail(`home clicks: ${JSON.stringify(clicks)}`);
  await page
    .waitForFunction(() => /LIVE/.test(document.querySelector('#oh-home')?.textContent || ''), {
      timeout: 8000,
    })
    .catch(() => {});
  const cards = await page.evaluate(() => {
    const txt = document.querySelector('#oh-status').textContent;
    return {
      events: /Next Buy-Back Token/.test(txt),
      stale: /Last event: Pirate Week/.test(txt) || !/Pirate Week/.test(txt),
      wave: /4\.10\.2[\s\S]{0,40}Wave 3/.test(txt) && /Released [A-Z][a-z]{2} \d+ · /.test(txt),
      news: document.querySelectorAll('#oh-home .nl').length,
      lead: document.querySelector('#oh-home .lead .p')?.textContent || '',
    };
  });
  cards.events &&
  cards.stale &&
  cards.wave &&
  cards.news >= 1 &&
  /^Last week was a busy one/.test(cards.lead)
    ? ok(
        `Game Status beside the card: waves, events (ended not shown as live), next token; news lead + ${cards.news} items`,
      )
    : fail(`home cards: ${JSON.stringify(cards)}`);
  // Hangar Alerts live in the top bar's bell: a wishlist sale shows with a count, and ×
  // ignores it. The Citizen Card has the whole row on Home.
  const home = await page.evaluate(async () => {
    OH.getShipStock = async (url) =>
      /Cutlass-Black/i.test(url)
        ? { state: 'in', price: 110, packs: [] }
        : { state: 'out', price: null, packs: [] };
    await chrome.storage.local.set({ homeIgnored: [] });
    state.wishlist = ['Cutlass Black', 'Pioneer'];
    document.dispatchEvent(new CustomEvent('oh:home'));
    await new Promise((r) => setTimeout(r, 800));
    const bell = document.querySelector('#bell-menu');
    const wish = bell.textContent;
    const count = document.querySelector('#bell-n').textContent;
    const card = document.querySelector('.citizen-card').getBoundingClientRect();
    // Citizen Card at three quarters, Game Status beside it.
    const side = document.querySelector('#oh-status').getBoundingClientRect();
    const full =
      side.left > card.right && Math.abs(side.width / (card.width + side.width) - 0.25) < 0.06;
    const x = [...bell.querySelectorAll('.bm-row')]
      .find((r) => /Cutlass Black/.test(r.textContent))
      ?.querySelector('.bm-x');
    x?.click();
    await new Promise((r) => setTimeout(r, 150));
    const hidden = !/Cutlass Black is on sale/.test(bell.textContent);
    state.wishlist = [];
    document.dispatchEvent(new CustomEvent('oh:home'));
    await chrome.storage.local.set({ homeIgnored: [] });
    return {
      wish,
      count,
      full,
      hidden,
      guide:
        !document.querySelector('#view-home .howto') &&
        !!document.querySelector('#view-guide .howto-page details') &&
        !!document.querySelector('#settings-menu a[href="#guide"]'),
      cards: document.querySelectorAll('.home-card').length,
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
  // Citizen Card: short balances, settings menu, the Home search, header currency.
  const card = await page.evaluate(async () => {
    const a = await OH.getAccount();
    const real = OH.getAccount;
    OH.getAccount = async () => ({
      ...a,
      credits: { store: { value: 123456 }, uec: { value: 1234567 }, rec: { value: 90000 } },
    });
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    const bal = document.querySelector('#home-balances');
    const uec = bal.querySelector('.bal.uec');
    const strip = bal.getBoundingClientRect();
    const tops = new Set([...bal.children].map((c) => Math.round(c.getBoundingClientRect().top)));
    OH.getAccount = real;
    document.querySelector('#settings-btn').click();
    const menu = document.querySelector('#settings-menu');
    const res = {
      uec: uec.querySelector('b').textContent,
      uecTitle: uec.title,
      rec: bal.querySelector('.bal.rec b').textContent,
      compact: tops.size <= 2 && strip.height < 140,
      settingsOpen:
        !menu.hidden &&
        !!menu.querySelector('#remind-toggle') &&
        !!menu.querySelector('#streamer-toggle') &&
        /Log Out of RSI/.test(menu.textContent),
      currencyInMenu: !!menu.querySelector('#currency-select'),
      scanInHeader: !!document.querySelector('header #scan-home'),
      searchOnHome: !!document.querySelector('#view-home .gsearch-home #gsearch'),
      placeholder: document.querySelector('#gsearch').placeholder,
    };
    document.body.click();
    res.settingsClosed = menu.hidden;
    return res;
  });
  card.uec === '¤ 1.2M' &&
  card.uecTitle === '¤ 1,234,567' &&
  card.rec === '¤ 90K' &&
  card.compact &&
  card.settingsOpen &&
  card.settingsClosed &&
  card.currencyInMenu &&
  card.scanInHeader &&
  card.searchOnHome &&
  card.placeholder === 'Global Hangar Search'
    ? ok(
        'citizen card: ¤ 1.2M / ¤ 90K, wallet four across (two by two when narrow), Scan in the top bar, gear menu (currency, Streamer Mode, Log Out of RSI), search on Home',
      )
    : fail(`citizen card: ${JSON.stringify(card)}`);

  const colors = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const bal = document.querySelector('#home-balances .bal.uec b');
    return {
      key: document.querySelectorAll('.color-key li').length,
      tokens: ['--good', '--warn', '--bad', '--t-ship', '--t-pack', '--t-ccu'].every((n) =>
        cs.getPropertyValue(n).trim(),
      ),
      // Balances stay neutral white: body text or the heading white (Clean Pro's
      // numbers), never a meaning colour.
      whiteBal:
        bal &&
        [getComputedStyle(document.body).color, 'rgb(255, 255, 255)'].includes(
          getComputedStyle(bal).color,
        ),
      pal: palette().good === cs.getPropertyValue('--good').trim(),
    };
  });
  colors.key === 13 && colors.tokens && colors.whiteBal && colors.pal
    ? ok('colors: tokens, Color Key (12), white balances, exports share the palette')
    : fail(`colors: ${JSON.stringify(colors)}`);

  const tweaks = await page.evaluate(async () => {
    const a = await OH.getAccount();
    const real = OH.getAccount;
    const long =
      'The Extraordinarily Long Named Interstellar Merchant and Exploration Consortium of Stanton';
    OH.getAccount = async () => ({ ...a, org: { name: long, rank: 'Petty Officer', sid: 'X' } });
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    const nm = document.querySelector('#cc-org .cc-org-name');
    const lh = parseFloat(getComputedStyle(nm).lineHeight) || 16;
    // Measured now: the renders below replace the element.
    const twoLines = nm.getBoundingClientRect().height <= lh * 2 + 2;
    const title = nm.closest('a')?.title === `Open ${long} on RSI`;
    // No org: no org line, no watermark, no placeholder text.
    OH.getAccount = async () => ({ ...a, org: null });
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    const noOrg =
      document.querySelector('#cc-org').hidden &&
      document.querySelector('#cc-water').hidden &&
      !/affiliat/i.test(document.querySelector('.citizen-card').textContent);
    // Streamer Mode: money turns to dots.
    streamer.on = true;
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    const masked = document.querySelector('#home-balances .bal.store b').textContent === '••••';
    streamer.on = false;
    OH.getAccount = real;
    renderAccount();
    return {
      noOrg,
      masked,
      twoLines,
      title,
      cardClean: !document.querySelector('.citizen-card #versions'),
      footer: /Open Hangar v\d/.test(document.querySelector('#footer').textContent),
    };
  });
  tweaks.twoLines &&
  tweaks.title &&
  tweaks.cardClean &&
  tweaks.footer &&
  tweaks.noOrg &&
  tweaks.masked
    ? ok(
        'citizen card: long org name wraps, links to the org; no org shows nothing; Streamer Mode hides money; versions in the footer',
      )
    : fail(`card tweaks: ${JSON.stringify(tweaks)}`);

  // Phone width: nothing scrolls sideways.
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 200));
  // Every page, not just Home (Stats' tab row once ran 142px off a phone).
  const phone = await page.evaluate(async () => {
    const out = {};
    for (const v of [
      'home',
      'inventory',
      'buybacks',
      'stats',
      'store',
      'org',
      'referrals',
      'updates',
      'developers',
    ]) {
      location.hash = '#' + v;
      await new Promise((r) => setTimeout(r, 500));
      const over = document.documentElement.scrollWidth - innerWidth;
      if (over > 0) out[v] = over;
    }
    location.hash = '#home';
    await new Promise((r) => setTimeout(r, 300));
    return out;
  });
  Object.keys(phone).length === 0
    ? ok('every page fits a 390px phone')
    : fail(`pages overflow at 390px: ${JSON.stringify(phone)}`);
  await page.setViewport({ width: 1280, height: 900 });

  menu.below && menu.inView && menu.visible
    ? ok('scan menu opens below the button, fully visible')
    : fail(`scan menu: ${JSON.stringify(menu)}`);
  home.guide && home.cards === 0
    ? ok('how-to guide on its own page (gear menu → How to Use), off Home')
    : fail(`home layout: ${JSON.stringify(home)}`);
  /Cutlass Black is on sale/.test(home.wish) &&
  !/Pioneer/.test(home.wish) &&
  home.count === '1' &&
  home.full
    ? ok(
        'Hangar Alerts in the bell: wishlist sale with a count; Game Status a quarter beside the card',
      )
    : fail(`For You: ${JSON.stringify(home)}`);
  home.hidden && home.storeOpt
    ? ok('bell: × ignores an alert; Scan has a Store option')
    : fail(`For You ignore: ${JSON.stringify(home)}`);
  const site = await page.$eval('#site-link', (e) => e.textContent).catch(() => '');
  !site.trim() && !(await page.$('#site-link button'))
    ? ok('website sync hidden until the site is live (no teaser, no connect button)')
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
    const hangarRow = !!out.querySelector('.gs-row[data-open-item]');
    const storeRow = !!out.querySelector('.gs-row[data-ship]');
    // A ship you don't own isn't in your hangar: nothing to show.
    box.value = 'Idris';
    box.dispatchEvent(new Event('input'));
    const notOwned = /Nothing in your hangar/.test(out.textContent);
    box.value = '';
    box.dispatchEvent(new Event('input'));
    const shipName = ownedShips().find((s) => /cutlass/i.test(s.label))?.label;
    openShipModal(shipName);
    await new Promise((r) => setTimeout(r, 300));
    const modal = document.querySelector('#modal-body');
    return {
      groups,
      hangarRow,
      storeRow,
      notOwned,
      shipName,
      closed: out.hidden,
      title: modal.querySelector('.modal-name')?.textContent,
      inHangar: /In Your Hangar \(\d+\)/.test(modal.textContent),
      links: modal.querySelectorAll('.mr-v a').length,
    };
  });
  await page.evaluate(() => document.querySelector('#modal-close').click());
  !gs.groups.includes('Ships') && gs.hangarRow && !gs.storeRow && gs.notOwned && gs.closed
    ? ok(`hangar search "cutlass": ${gs.groups.join(', ')}; "Idris" (not owned) finds nothing`)
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

  const types2 = await page.evaluate(() => {
    const ship = { kind: 'Ship', label: 'Aurora MR' };
    const t = (p) => pledgeType({ contents: [], containsShip: true, kind: 'ship', ...p });
    const color = (cls) => {
      const el = document.createElement('span');
      el.className = `badge ${cls}`;
      document.body.appendChild(el);
      const c = getComputedStyle(el).borderColor;
      el.remove();
      return c;
    };
    return {
      ship: t({ name: 'Standalone Ship - Cutlass Black', contents: [ship] }),
      pack: t({ name: 'Nine Tails Pack', contents: [ship, { kind: 'Ship', label: 'Cyclone' }] }),
      pkg: t({
        name: 'Package - Aurora MR Starter',
        contents: [ship, { kind: 'Game', label: 'Star Citizen Digital Download' }],
      }),
      ccu: t({ isCCU: true, containsShip: false }),
      distinct: new Set(['ship', 'pack', 'package', 'ccu', 'paint', 'addon', 'coupon'].map(color))
        .size,
    };
  });
  types2.ship === 'ship' &&
  types2.pack === 'pack' &&
  types2.pkg === 'package' &&
  types2.ccu === 'ccu' &&
  types2.distinct === 7
    ? ok('type badges: ship / pack / package / CCU, 7 distinct colors')
    : fail(`type colors: ${JSON.stringify(types2)}`);

  const packPrice = await page.evaluate(() => {
    const pack = {
      id: '999002',
      kind: 'pack',
      name: 'Packs - Test Explorer Pack',
      contains: 'Carrack and 5 other items',
    };
    const noDetails = buybackStorePrice(pack);
    state.bbDetails['999002'] = { ships: [{ name: 'Carrack' }, { name: 'Pioneer' }], also: [] };
    const withDetails = buybackStorePrice(pack);
    delete state.bbDetails['999002'];
    const carrack = state.priceOf('Carrack').msrp;
    const pioneer = state.priceOf('Pioneer').msrp;
    return { noDetails, withDetails, expect: carrack + pioneer };
  });
  packPrice.noDetails === null && packPrice.withDetails === packPrice.expect
    ? ok(
        `pack buy-back store price: every ship (${packPrice.withDetails}), none before Load details`,
      )
    : fail(`pack store price: ${JSON.stringify(packPrice)}`);

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

  console.log('Inventory and top bar pass');
  await go('#inventory');
  const inv = await page.evaluate(async () => {
    const r = {};
    r.sum = /Pledges\s*\d+/i.test(document.querySelector('#inv-sum').textContent);
    const all = computeShown().length;
    document.querySelector('[data-switch="inv-hide"]').click();
    r.hid = computeShown().length < all;
    document.querySelector('[data-switch="inv-hide"]').click();
    // Saved view (no prompt in the test: push one directly, then apply it).
    state.savedViews.push({
      name: 'Ships',
      f: { shown: ['ship'], traits: [], query: '', hideSmall: false },
    });
    renderInventory();
    document.querySelector('[data-view-apply="0"]').click();
    r.view = computeShown().every((p) => p.kind === 'ship') && state.shown.has('ship');
    state.savedViews = [];
    state.shown = new Set();
    renderInventory();
    // Melt planner: pick two meltable pledges with a wishlist ship.
    const keepWish = state.wishlist;
    state.wishlist = ['Cutlass Black'];
    setSelecting(true);
    state.items
      .filter(isMeltable)
      .slice(0, 2)
      .forEach((p) => state.selected.add(p.id));
    renderInventory();
    r.planner = document.querySelector('#sb-melt').textContent;
    state.selected.clear();
    setSelecting(false);
    state.wishlist = keepWish;
    // Top bar: counts, bell, search.
    r.counts =
      document.querySelector('#nav-n-inventory').textContent === String(state.items.length);
    r.bell = !!document.querySelector('#bell-btn') && !!document.querySelector('#bell-menu');
    const top = document.querySelector('#gsearch-top');
    top.value = 'cutlass';
    top.dispatchEvent(new Event('input'));
    r.search = !!document.querySelector('#gsearch-top-results .gs-row');
    top.value = '';
    document.querySelector('#gsearch-top-results').hidden = true;
    return r;
  });
  inv.sum && inv.hid && inv.view && /from your wishlist|wishlist/.test(inv.planner)
    ? ok('inventory: summary strip, Hide small stuff, saved views, melt planner')
    : fail(`inventory pass: ${JSON.stringify(inv)}`);
  inv.counts && inv.bell && inv.search
    ? ok('top bar: counts, alerts bell, search on every page')
    : fail(`top bar: ${JSON.stringify(inv)}`);

  console.log('Buy-Backs');
  await go('#buybacks');
  const tok = await page.$eval('#bb-sum', (e) => e.textContent).catch(() => '');
  /Tokens\s*2\s*next/i.test(tok)
    ? ok('buy-back tokens in the summary strip')
    : fail(`tokens: "${tok}"`);
  // Buy-Backs pass: Hide small stuff on by default; Stack identical off by default
  // and stacks copies when on.
  const bbPass = await page.evaluate(async () => {
    const rows = () => document.querySelectorAll('#buybacks-body .card').length;
    const hideOn = state.bbHideSmall;
    const stackOff = !state.bbStack;
    const saved = state.buybacks;
    state.buybacks = saved.concat(saved.slice(0, 2).map((x) => ({ ...x, id: x.id + '-copy' })));
    renderBuybacks();
    const flat = rows();
    document.querySelector('[data-switch="bb-stack"]').click();
    const stacked = rows();
    const badges = document.querySelectorAll('#buybacks-body .stack-n').length;
    document.querySelector('[data-switch="bb-stack"]').click();
    state.buybacks = saved;
    renderBuybacks();
    return { hideOn, stackOff, flat, stacked, badges };
  });
  bbPass.hideOn && bbPass.stackOff && bbPass.stacked === bbPass.flat - 2 && bbPass.badges === 2
    ? ok('buy-backs: small stuff hidden by default; Stack identical is opt-in and stacks copies')
    : fail(`buy-backs pass: ${JSON.stringify(bbPass)}`);
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
  const acct = await page.evaluate(() => {
    const last = state.history[state.history.length - 1];
    return {
      title: [...document.querySelectorAll('#stats-body h3')].map((h) => h.textContent).join('|'),
      store: snapshotStore(last),
      now: hangarValue().store,
      tip: document.querySelector('.hist-chart circle:last-of-type title')?.textContent || '',
    };
  });
  /Account Value Over Time/.test(acct.title) &&
  acct.store > 0 &&
  Math.abs(acct.store - acct.now) < 1
    ? ok(`history charts account value (latest ${acct.tip})`)
    : fail(`account value: ${JSON.stringify(acct)}`);

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
  const roleCount = await page.evaluate(() => OH.ORG_ROLES.length);
  roleChips === roleCount && memberRows >= 3
    ? ok(`org roles (${roleChips}) + biggest ships + members`)
    : fail(`org extras: ${roleChips} role chips, ${memberRows} tables`);
  await page.click('.role-chip.missing');
  (await page.$('.org-panel'))
    ? ok('missing role opens suggestions')
    : fail('role click opened nothing');
  await page.click('.org-mrow');
  (await page.$('.pair-row')) ? ok('member opens vs-org charts') : fail('member panel missing');
  // Your entry follows your latest scan, and a concept-only role is amber, not missing.
  const live = await page.evaluate(async () => {
    const mine = orgMembers.find((m) => m.mine);
    const before = mine.ships.length;
    state.items = [
      ...state.items,
      {
        id: 'pio-1',
        name: 'Pioneer',
        kind: 'ship',
        containsShip: true,
        insurance: 'LTI',
        contents: [{ kind: 'Ship', label: 'Pioneer' }],
      },
    ];
    await renderOrg();
    const chip = document.querySelector('.role-chip[data-role="construction"]');
    const res = {
      grew: mine.ships.length === before + 1,
      chip: chip && chip.className,
      intro: /Only in-concept ships for: Construction/.test(
        document.querySelector('#org-body').textContent,
      ),
    };
    state.items = state.items.filter((p) => p.id !== 'pio-1');
    await renderOrg();
    return res;
  });
  live.grew && /\bconcept\b/.test(live.chip || '') && live.intro
    ? ok('org: your fleet follows your scan; Pioneer-only Construction shows as in concept')
    : fail(`org live/concept: ${JSON.stringify(live)}`);
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
  const grp = await page.evaluate(() => ({
    labels: [
      ...new Set([...document.querySelectorAll('.release-group')].map((e) => e.textContent)),
    ],
    leaked: [...document.querySelectorAll('#updates-body li')].filter((li) =>
      /^(New|Improved|Changed|Fixed)\b\s*:/i.test(li.textContent),
    ).length,
  }));
  ['New', 'Improved', 'Fixed'].every((l) => grp.labels.includes(l)) && !grp.leaked
    ? ok('releases split into New / Improved / Fixed, prefixes stripped')
    : fail(`release groups: ${JSON.stringify(grp)}`);
  const chk = await page.evaluate(async () => {
    const btn = document.querySelector('#update-check-btn');
    const out = () => document.querySelector('#update-check-status').textContent;
    const wait = () => new Promise((r) => setTimeout(r, 200));
    // No update API in the demo = Firefox, which asks AMO for the latest version.
    const realFetch = window.fetch;
    const amo = (v) => async () =>
      new Response(JSON.stringify({ current_version: { version: v } }));
    window.fetch = amo('9.9.9');
    btn.click();
    await wait();
    const firefoxNew = out();
    window.fetch = amo(document.querySelector('#update-cur').textContent);
    btn.click();
    await wait();
    const firefoxSame = out();
    window.fetch = realFetch;
    const firefox = `${firefoxNew} | ${firefoxSame}`;
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
  chk.cur &&
  /9\.9\.9 is out.*\| You're on the latest version/.test(chk.firefox) &&
  /9\.9\.9 is downloading/.test(chk.chrome1)
    ? ok('Check for updates: store check (Chrome) and AMO version check (Firefox)')
    : fail(`check for updates: ${JSON.stringify(chk)}`);

  // Kill switch notice: shown from the cached status file, as text (never HTML).
  const notice = await page.evaluate(async () => {
    const el = document.querySelector('#site-notice');
    const show = async (banner) => {
      await chrome.storage.local.set({ remoteStatus: { at: Date.now(), data: { banner } } });
      await renderSiteNotice();
      return {
        hidden: el.hidden,
        text: el.textContent,
        html: el.innerHTML,
        info: el.classList.contains('info'),
      };
    };
    const warn = await show({ message: '<b>RSI</b> changed their site.' });
    const info = await show({ message: 'All good again.', level: 'info' });
    const off = await show(null);
    return { warn, info, off };
  });
  !notice.warn.hidden &&
  notice.warn.text === '<b>RSI</b> changed their site.' &&
  !notice.warn.html.includes('<b>') &&
  notice.info.info &&
  notice.off.hidden
    ? ok('status notice: warn and info shown as plain text, hidden when cleared')
    : fail(`status notice: ${JSON.stringify(notice)}`);

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
    // Drawing loads the reward pictures first, so wait for the download, not a fixed time.
    for (let t = 0; !types && t < 100; t++) await new Promise((r) => setTimeout(r, 100));
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
    // Local date, like the page uses (toISOString is UTC: wrong in the evening).
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    referralEvents = [
      ...referralEvents,
      { start: today, end: today, name: 'Test Expo', reward: 'Drake Dragonfly with LTI' },
    ];
    location.hash = '#home';
    await new Promise((r) => setTimeout(r, 400));
    const banner = document.querySelector('#oh-status');
    return {
      before,
      after,
      wish: /Carrack/.test(wish),
      cleared,
      spend: /pledged in total/.test(spend),
      bars,
      banner: /Referral bonus: Drake Dragonfly/.test(banner.textContent),
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
    ? ok('Events card shows a running referral bonus event')
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
