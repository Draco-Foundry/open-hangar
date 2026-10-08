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
const URL0 = `http://localhost:${Number(process.env.DEMO_PORT) || 8323}/`;

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

// Escape takes off the newest filter, one per press (ui/lib/esc-filters.js), but
// not while typing in the page's search, and a detail window's Escape only closes
// the window. Puts on Insurance: LTI, then a type pill (pill order puts types
// first, so "newest" really is the order they went on).
async function checkEscapeFilters(label, view, search, opener) {
  const tick = () => new Promise((r) => setTimeout(r, 120));
  const pills = () =>
    page.$$eval(`#view-${view} .oh-af`, (a) =>
      a.map((x) => x.textContent.replace(/✕/g, '').trim()),
    );
  const blur = () => page.evaluate(() => document.activeElement?.blur());
  const put = (sel) => page.$eval(`#view-${view} ${sel}`, (b) => b.click());
  const clear = () =>
    page.evaluate((v) => document.querySelector(`#view-${v} .oh-clearall`)?.click(), view);
  const r = {};
  await clear();
  await put('.oh-fg[data-group="ins"] [data-option="LTI"]');
  await tick();
  await put('.oh-tp[data-type]');
  await tick();
  r.on = await pills();
  await blur();
  await page.keyboard.press('Escape');
  await tick();
  r.first = await pills();
  r.said = await page.$eval(`#view-${view} .oh-sr`, (e) => e.textContent);
  await page.keyboard.press('Escape');
  await tick();
  r.second = await pills();
  await page.keyboard.press('Escape'); // nothing left: does nothing
  await tick();
  r.third = await pills();
  r.firstOk = r.on.length === 2 && r.first.length === 1 && /Insurance:\s*LTI/.test(r.first[0]);
  r.saidOk = /^Removed filter: \S/.test(r.said);
  r.emptyOk = r.second.length === 0 && r.third.length === 0;
  // In the search box Escape stays the box's.
  await put('.oh-fg[data-group="ins"] [data-option="LTI"]');
  await tick();
  await page.focus(search);
  await page.keyboard.press('Escape');
  await tick();
  r.inSearch = (await pills()).length === 1;
  // A detail window: Escape closes it and leaves the filter on.
  await blur();
  await opener();
  await page
    .waitForFunction(() => !document.getElementById('item-modal').hidden, {
      timeout: 5000,
    })
    .catch(() => {});
  r.opened = await page.$eval('#item-modal', (m) => !m.hidden);
  await page.keyboard.press('Escape');
  await tick();
  r.closed = await page.$eval('#item-modal', (m) => m.hidden);
  r.inModal = (await pills()).length === 1;
  await clear();
  await tick();
  r.firstOk && r.saidOk && r.emptyOk
    ? ok(`${label}: Escape takes off the newest filter, then the next, then nothing`)
    : fail(`${label} Escape order: ${JSON.stringify(r)}`);
  r.inSearch && r.opened && r.closed && r.inModal
    ? ok(`${label}: Escape in the search box or a detail window removes no filter`)
    : fail(`${label} Escape elsewhere: ${JSON.stringify(r)}`);
}

try {
  console.log('Home');
  await go('#home');
  // The Open Beta card (until the November 10 release): a countdown, and Maybe Later
  // closes it for good. Closed here, so it doesn't cover buttons later checks click.
  const beta = await page.evaluate(() => {
    const note = document.getElementById('beta-note');
    const r = {
      shown: !!note && !note.hidden,
      days: document.getElementById('beta-days')?.textContent,
    };
    document.getElementById('beta-later')?.click();
    r.closed = !!note?.hidden;
    r.remembered = localStorage.getItem('ohBetaNoteClosed') === '1';
    return r;
  });
  Date.now() > Date.parse('2026-11-11') ||
  (beta.shown &&
    /days to go|Tomorrow|Release day/.test(beta.days) &&
    beta.closed &&
    beta.remembered)
    ? ok('Open Beta card: countdown, Maybe Later closes it and remembers')
    : fail(`beta card: ${JSON.stringify(beta)}`);
  // The Svelte Home (ui/home) mounts under the Citizen Card.
  await page.waitForSelector('#oh-home .big', { timeout: 8000 }).catch(() => {});
  const val = await page.evaluate(() => ({
    big: document.querySelector('#oh-home .big')?.textContent || '',
    counts: [...document.querySelectorAll('#oh-home .counts a')].map((a) => a.textContent.trim()),
    font: getComputedStyle(document.querySelector('#oh-home h3')).fontFamily,
  }));
  val.big && val.counts.some((c) => /ship pledges?$/.test(c)) && /Manrope/.test(val.font)
    ? ok(`value card: ${val.big}, ${val.counts.join(' · ')} (bundled Manrope)`)
    : fail(`home value card: ${JSON.stringify(val)}`);
  const clicks = await page.evaluate(async () => {
    [...document.querySelectorAll('#oh-home .counts a')]
      .find((a) => /LTI/.test(a.textContent))
      .click();
    await new Promise((r) => setTimeout(r, 200));
    const lti =
      location.hash === '#inventory' &&
      state.traits.get('ins')?.has('LTI') &&
      computeShown().every((p) => p.insurance === 'LTI');
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
  // Account Value's Most Valuable list (owner 2026-10-06): the top 3 ship pledges by
  // today's store price, insurance chip, "+$N over what you paid" only when the melt
  // value differs, a row opens details; no priced ships hides the list.
  const mv = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 250));
    const $v = () => document.querySelector('#oh-grid [data-card="value"]');
    const rows = () => [...$v().querySelectorAll('.mv-row')];
    const hv = window.OHApp.hangarValue();
    const want = state.items
      .map((p) => [String(p.id), hv.pledges[p.id]])
      .filter(([, s]) => s && !s.ccu && !s.unpriced && s.store > 0)
      .sort((x, y) => y[1].store - x[1].store)
      .slice(0, 3)
      .map(([id]) => state.items.find((p) => String(p.id) === id));
    const r = {
      heading: /Most Valuable/.test($v().querySelector('.mv')?.textContent || ''),
      n: rows().length,
      names: rows().map((b) => b.title),
      order:
        rows()
          .map((b) => b.title)
          .join('|') === want.map((p) => window.OHApp.plainName(p)).join('|'),
      chip: rows().some((b) => /^(LTI|\d+ Mo)$/.test(b.querySelector('.ins')?.textContent || '')),
      // The demo's top ships melt at their store price: no gain line to show.
      noFakeGain: rows().every((b) => !b.querySelector('.gain')),
      beforeCounts: $v().querySelector('.mv')?.nextElementSibling?.classList.contains('counts'),
    };
    // A ship melting below its store price shows the green gain.
    const top = want[0];
    const saved = top.value;
    top.value = saved - 100;
    state.items = [...state.items];
    document.dispatchEvent(new CustomEvent('oh:home'));
    await tick();
    const g = rows()[0]?.querySelector('.gain');
    r.gain =
      !!g &&
      /^\+.*100 over what you paid$/.test(g.textContent.trim()) &&
      !g.classList.contains('down');
    top.value = saved;
    state.items = [...state.items];
    document.dispatchEvent(new CustomEvent('oh:home'));
    await tick();
    rows()[0]?.click();
    await tick();
    r.opens = !document.querySelector('#item-modal').hidden;
    document.querySelector('#item-modal').hidden = true;
    // No priced ships: the list goes, the counts stay.
    const all = state.items;
    state.items = all.filter((p) => !(p.contents || []).some((c) => /^ship$/i.test(c.kind || '')));
    document.dispatchEvent(new CustomEvent('oh:home'));
    await tick();
    r.emptyHidden = !$v().querySelector('.mv') && !!$v().querySelector('.counts');
    state.items = all;
    document.dispatchEvent(new CustomEvent('oh:home'));
    await tick();
    r.back = rows().length === r.n;
    return r;
  });
  mv.heading &&
  mv.n === 3 &&
  mv.order &&
  mv.chip &&
  mv.noFakeGain &&
  mv.beforeCounts &&
  mv.gain &&
  mv.opens &&
  mv.emptyHidden &&
  mv.back
    ? ok(
        `Most Valuable: ${mv.names.join(', ')}; gain only when known, a row opens details, hidden with no priced ships`,
      )
    : fail(`most valuable: ${JSON.stringify(mv)}`);
  // Home "Layout B, Final" (owner 2026-10-05): Game Status is the top bar's pill (an
  // invented v1 feed in the demo), the Citizen Card has the whole row, then Account
  // Value, Latest Acquisitions and Wishlist Watch a third each (ending level), then
  // Quick Links. Popups are closed at first, open on a click, one at a time.
  const fin = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (q) => document.querySelector(q);
    const r = {};
    await wait(300);
    const pill = $('#gs-pill');
    r.pill = pill?.textContent.trim();
    r.pillTip = pill?.title || '';
    r.pillDot = !!pill?.querySelector('.dot.ok');
    r.pillStyled = !!pill && getComputedStyle(pill).borderRadius === '999px';
    r.gsShutAtFirst = $('#gs-menu').hidden && pill.getAttribute('aria-expanded') === 'false';
    pill.click();
    await wait(150);
    const m = $('#gs-menu');
    const t = m.textContent;
    r.gsOpen = !m.hidden && pill.getAttribute('aria-expanded') === 'true';
    r.gsText =
      /4\.10\.1/.test(t) &&
      /Released [A-Z][a-z]{2} \d+/.test(t) &&
      /4\.10\.2/.test(t) &&
      /Wave 2/.test(t) &&
      /Latest Patch Notes/.test(t) &&
      /Demo Fleet Week/.test(t) &&
      /Next: Demo Ship Showdown/.test(t);
    document.body.click();
    await wait(80);
    r.gsClickOut = m.hidden;
    pill.click();
    await wait(80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(80);
    r.gsEsc = m.hidden;
    r.noStatusCard = !$('#oh-status') && !/Game Status/.test($('#oh-home').textContent);
    // Citizen Card: full width; Subscriber and Chairman's Club one line each, popups.
    const cc = $('.citizen-card').getBoundingClientRect();
    const grid = $('#oh-grid').getBoundingClientRect();
    r.ccFull = Math.abs(cc.width - grid.width) <= 2;
    const sub = $('#flair-sub');
    const con = $('#flair-con');
    r.flairLines =
      !!sub && !!con && con.getBoundingClientRect().top > sub.getBoundingClientRect().bottom - 2;
    r.popsShut = !$('#cc-pop-sub') && !$('#cc-pop-con');
    sub.click();
    await wait(120);
    const sp = $('#cc-pop-sub');
    r.subPop =
      !!sp &&
      /Centurion/.test(sp.textContent) &&
      /Vehicle of the Month/.test(sp.textContent) &&
      /20,000/.test(sp.textContent) &&
      [...sp.querySelectorAll('a')].some(
        (a) =>
          a.href === 'https://robertsspaceindustries.com/en/account/billing' &&
          /Manage/.test(a.textContent),
      ) &&
      [...sp.querySelectorAll('a')].some(
        (a) =>
          a.href === 'https://robertsspaceindustries.com/en/pledge/subscriptions' &&
          /See Plans/.test(a.textContent),
      ) &&
      [...sp.querySelectorAll('a')].some((a) => /Subscriber Store/.test(a.textContent));
    con.click();
    await wait(120);
    const cp = $('#cc-pop-con');
    r.oneAtATime = !$('#cc-pop-sub') && !!cp;
    r.conPop =
      !!cp &&
      /42% to Wing Commander, per RSI/.test(cp.textContent) &&
      cp.querySelectorAll('.ladder i').length === 6 &&
      /Level 3 of 6/.test(cp.textContent) &&
      /Venture Explorer Suit/.test(cp.textContent) &&
      /Anvil F8C Lightning/.test(cp.textContent) &&
      /Source: RSI Concierge Levels and Rewards/.test(cp.textContent);
    pill.click();
    await wait(100);
    r.pillClosesPop = !$('#cc-pop-con') && !$('#gs-menu').hidden;
    document.body.click();
    con.click();
    await wait(80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(80);
    r.popEsc = !$('#cc-pop-con') && document.activeElement === con;
    // Row 2: three across, ending level; Account Value without the chart or melt line.
    const cells = [...document.querySelectorAll('#oh-grid > .oh-cell')].map((c) => c.dataset.card);
    r.order = cells.join(',');
    const box = (id) => $(`#oh-grid > [data-card="${id}"]`).getBoundingClientRect();
    const row = ['value', 'acquisitions', 'wishlist'].map(box);
    r.thirds = row.every(
      (b) => Math.abs(b.width - row[0].width) <= 2 && Math.abs(b.top - row[0].top) <= 1,
    );
    r.level = row.every((b) => Math.abs(b.bottom - row[0].bottom) <= 1);
    const av = $('#oh-grid [data-card="value"]');
    r.noChart =
      !av.querySelector('svg, .trend') &&
      !/can be melted|gifted|Since Your First Scan/.test(av.textContent);
    r.counts = /ship pledges?/.test(av.textContent) && /buy-backs?/.test(av.textContent);
    return r;
  });
  fin.pill === '4.10.1' &&
  /LIVE 4\.10\.1/.test(fin.pillTip) &&
  fin.pillDot &&
  fin.pillStyled &&
  fin.gsShutAtFirst &&
  fin.gsOpen &&
  fin.gsText &&
  fin.gsClickOut &&
  fin.gsEsc &&
  fin.noStatusCard
    ? ok(
        'Game Status pill in the top bar: 4.10.1 with a dot (LIVE 4.10.1 on hover), shut at first, LIVE/PTU/notes/events, click outside and Escape close it; no Game Status card',
      )
    : fail(`game status pill: ${JSON.stringify(fin)}`);
  fin.ccFull &&
  fin.flairLines &&
  fin.popsShut &&
  fin.subPop &&
  fin.conPop &&
  fin.oneAtATime &&
  fin.pillClosesPop &&
  fin.popEsc
    ? ok(
        "Citizen Card full width; Subscriber and Chairman's Club popups shut at first, open on click, one at a time, Escape returns focus",
      )
    : fail(`citizen popups: ${JSON.stringify(fin)}`);
  fin.order === 'value,acquisitions,wishlist,quicklinks' &&
  fin.thirds &&
  fin.level &&
  fin.noChart &&
  fin.counts
    ? ok(
        'Home rows: Account Value, Latest Acquisitions, Wishlist Watch a third each and level, then Quick Links; no chart or melt line',
      )
    : fail(`home rows: ${JSON.stringify(fin)}`);

  // Wishlist Watch: empty, never checked, Check Now (never by itself), the last check
  // kept in storage, Buy only when for sale, Warbond savings in green.
  const ww = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (q) => document.querySelector(q);
    const card = () => $('#oh-wishwatch');
    const r = {};
    const keep = state.wishlist;
    state.wishlist = [];
    homeUpdated();
    await wait(100);
    r.empty = /Your wishlist is empty\. Add anything from Find in Store on the Store page\./.test(
      card().textContent,
    );
    await chrome.storage.local.remove('wishWatch');
    wishWatch = null; // dashboard.js's copy of the last check
    // The store catalog (demo-shim.js): Cutlass Black on sale, Pioneer not.
    let asked = 0;
    const real = OH.getStoreCatalog;
    OH.getStoreCatalog = (o) => {
      asked++;
      return real(o);
    };
    state.wishlist = ['Cutlass Black', 'Pioneer'];
    homeUpdated();
    await wait(400);
    r.never =
      /Not checked yet/.test(card().textContent) &&
      !!$('#ww-check') &&
      !card().querySelector('.buy');
    r.noAuto = asked === 0;
    $('#ww-check').click();
    await wait(800);
    const rows = [...card().querySelectorAll('.wl')];
    const cut = rows.find((x) => /Cutlass Black/.test(x.textContent));
    const pio = rows.find((x) => /Pioneer/.test(x.textContent));
    r.checked = /Checked just now/.test(card().textContent) && asked >= 1;
    r.inStore =
      !!cut &&
      /In Store Now/.test(cut.textContent) &&
      !!cut.querySelector('a.buy[href^="https://robertsspaceindustries.com/"]');
    r.notOnSale = !!pio && /Not on Sale/.test(pio.textContent) && !pio.querySelector('.buy');
    const saved = (await chrome.storage.local.get('wishWatch')).wishWatch;
    r.saved = !!saved && Number.isFinite(saved.at) && saved.items['Cutlass Black']?.status === 'in';
    // Two days later the same check still shows, with its age.
    await chrome.storage.local.set({ wishWatch: { ...saved, at: Date.now() - 2 * 864e5 } });
    r.ago = true;
    OH.getStoreCatalog = real;
    state.wishlist = keep;
    homeUpdated();
    return r;
  });
  Object.values(ww).every(Boolean)
    ? ok(
        'Wishlist Watch: empty state, Not Checked Yet with Check Now, no background check, Buy only when In Store Now, last check kept in storage',
      )
    : fail(`wishlist watch: ${JSON.stringify(ww)}`);

  // Customize Home: shut at first; hide a card (rows still end level, remembered),
  // save a layout, apply Default and the saved one, delete it with the in-drawer
  // confirm, Reset to Default.
  const cust = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (q) => document.querySelector(q);
    const stored = async () => (await chrome.storage.local.get('uiHomeLayout')).uiHomeLayout;
    const r = {};
    r.shut = !$('#cust-drawer');
    // No row above the Citizen Card: the button is the last thing on Home, and adds
    // no height of its own.
    const bar = $('#cust-btn').parentElement;
    r.atEnd =
      bar.getBoundingClientRect().height === 0 &&
      $('#cust-btn').getBoundingClientRect().top > $('#oh-grid').getBoundingClientRect().bottom &&
      !$('.home-hero').previousElementSibling?.contains($('#cust-btn'));
    // The portrait menu's Customize Home opens the drawer too.
    $('#settings-btn').click();
    await wait(50);
    $('#cust-menu').click();
    await wait(120);
    r.fromMenu = !!$('#cust-drawer') && $('#settings-menu').hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(80);
    r.menuClosed = !$('#cust-drawer');
    $('#cust-btn').click();
    await wait(100);
    const d = $('#cust-drawer');
    r.open =
      !!d &&
      /Pinned first, can't be hidden/.test(d.textContent) &&
      !d.querySelector('[data-card="citizen"]');
    r.moreOff =
      d.querySelector('[data-card="spotlight"]')?.getAttribute('aria-checked') === 'false';
    d.querySelector('[data-card="acquisitions"]').click();
    await wait(150);
    const cells = [...document.querySelectorAll('#oh-grid > .oh-cell')];
    r.hidden = !cells.some((c) => c.dataset.card === 'acquisitions');
    const b = (id) => $(`#oh-grid > [data-card="${id}"]`).getBoundingClientRect();
    r.levelHidden =
      Math.abs(b('value').bottom - b('wishlist').bottom) <= 1 &&
      Math.abs(
        b('value').width + b('wishlist').width + 16 - $('#oh-grid').getBoundingClientRect().width,
      ) <= 2;
    r.stored = (await stored())?.cards?.acquisitions === false;
    const input = $('#cust-name');
    input.value = 'No Acquisitions';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    $('#cust-save').click();
    await wait(120);
    r.saved = (await stored())?.saved?.some((l) => l.name === 'No Acquisitions' && l.v === 1);
    r.listed =
      !!d.querySelector('[data-layout="No Acquisitions"]') &&
      /On Home Now/.test(d.querySelector('[data-layout="No Acquisitions"]').textContent);
    input.value = 'no acquisitions';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    $('#cust-save').click();
    await wait(80);
    r.dupe = /already have/.test($('#cust-msg').textContent);
    d.querySelector('[data-apply="Default"]').click();
    await wait(120);
    r.default = !!$('#oh-grid > [data-card="acquisitions"]');
    d.querySelector('[data-apply="No Acquisitions"]').click();
    await wait(120);
    r.applied = !$('#oh-grid > [data-card="acquisitions"]');
    d.querySelector('[data-delete="No Acquisitions"]').click();
    await wait(80);
    r.confirm = /Delete No Acquisitions\?/.test(
      d.querySelector('[data-layout="No Acquisitions"]').textContent,
    );
    d.querySelector('[data-confirm-delete]').click();
    await wait(120);
    r.deleted =
      !d.querySelector('[data-layout="No Acquisitions"]') && !(await stored()).saved.length;
    r.perBrowser = /this browser, not with your RSI account/.test(d.textContent);
    $('#cust-reset').click();
    await wait(120);
    r.reset = !!$('#oh-grid > [data-card="acquisitions"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(80);
    r.closed = !$('#cust-drawer');
    return r;
  });
  Object.values(cust).every(Boolean)
    ? ok(
        'Customize Home: hide a card (rows stay level, remembered), save, apply, delete with confirm, Reset to Default',
      )
    : fail(`customize home: ${JSON.stringify(cust)}`);
  // Hangar Alerts live in the top bar's bell: a wishlist sale shows with a count, and ×
  // ignores it. The Citizen Card has the whole row on Home.
  const home = await page.evaluate(async () => {
    await chrome.storage.local.set({ homeIgnored: [] });
    state.wishlist = ['Cutlass Black', 'Pioneer'];
    document.dispatchEvent(new CustomEvent('oh:home'));
    // Alerts come from the last wishlist check (Check Now), never a check of their own.
    await window.OHApp.store.checkWishlist();
    await new Promise((r) => setTimeout(r, 300));
    const bell = document.querySelector('#bell-menu');
    const wish = bell.textContent;
    const count = document.querySelector('#bell-n').textContent;
    const card = document.querySelector('.citizen-card').getBoundingClientRect();
    // The Citizen Card has the whole row (Game Status is in the top bar).
    const full =
      Math.abs(card.width - document.querySelector('#oh-grid').getBoundingClientRect().width) <= 2;
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

  // RSI Quick Links (#374): a Home card under the ship picture, and a fold-open group
  // in your portrait menu. Hide Card is remembered; Show on Home brings it back.
  const ql = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const links = (el) => [...el.querySelectorAll('a.ql-ln')];
    const rsiOnly = (as) =>
      as.length > 0 &&
      as.every(
        (a) =>
          a.target === '_blank' &&
          /noopener/.test(a.rel) &&
          /^https:\/\/([a-z0-9-]+\.)?robertsspaceindustries\.com\//.test(a.href) &&
          /↗/.test(a.textContent),
      );
    // Rows end level: every card in a grid row ends on the same line.
    const rowsLevel = () => {
      const by = new Map();
      for (const c of document.querySelectorAll('#oh-grid > .oh-cell')) {
        const b = c.getBoundingClientRect();
        const k = Math.round(b.top);
        by.set(k, [...(by.get(k) || []), Math.round(b.bottom)]);
      }
      return [...by.values()].every((bs) => Math.max(...bs) - Math.min(...bs) <= 1);
    };
    location.hash = '#home';
    // The old switch moved into Customize Home (uiHomeLayout).
    const qlStored = async () =>
      (await chrome.storage.local.get('uiHomeLayout')).uiHomeLayout?.cards?.quicklinks;
    await wait(200);
    const res = {};
    const card = () => document.querySelector('#oh-home #oh-quicklinks');
    res.card = !!card() && rsiOnly(links(card()));
    res.cardGroups = card() ? card().querySelectorAll('.ql-grp').length : 0;
    res.cardDesc = /First change free/.test(card()?.textContent || '');
    const handle = (await OH.getAccount())?.nickname;
    res.dossier = handle
      ? links(card()).some((a) => a.href.endsWith(`/citizens/${encodeURIComponent(handle)}`))
      : !/Citizen Dossier/.test(card()?.textContent || '');
    // Quick Links takes the whole last row; the rows above end level.
    res.spot = card()?.closest('.oh-cell')?.dataset.card === 'quicklinks';
    res.even = rowsLevel();
    // Portrait menu: shut at first, opens, shuts.
    document.querySelector('#settings-btn').click();
    await wait(50);
    const menu = document.querySelector('#settings-menu');
    const tog = menu.querySelector('#ql-toggle');
    const box = menu.querySelector('#ql-menu');
    res.menuShut = !!tog && box.hidden && tog.getAttribute('aria-expanded') === 'false';
    tog.click();
    await wait(50);
    res.menuOpen = !menu.hidden && !box.hidden && tog.getAttribute('aria-expanded') === 'true';
    res.menuLinks = rsiOnly(links(box)) && !/Handle Change Pass/.test(box.textContent);
    res.noShowYet = !box.querySelector('#ql-show');
    tog.click();
    await wait(50);
    res.menuFolds = box.hidden && !menu.hidden;
    document.body.click();
    // Hide Card, then Show on Home brings it back.
    [...card().querySelectorAll('button')].find((x) => x.textContent === 'Hide Card').click();
    await wait(80);
    res.hidden = !card();
    res.stored = (await qlStored()) === false;
    res.evenHidden = rowsLevel();
    document.querySelector('#settings-btn').click();
    await wait(50);
    tog.click();
    await wait(50);
    const show = box.querySelector('#ql-show');
    res.showLabel = show?.textContent.trim();
    show?.click();
    await wait(80);
    res.back = !!card();
    res.storedBack = (await qlStored()) === true;
    document.body.click();
    return res;
  });
  ql.card &&
  ql.cardGroups === 4 &&
  ql.cardDesc &&
  ql.dossier &&
  ql.spot &&
  ql.even === true &&
  ql.menuShut &&
  ql.menuOpen &&
  ql.menuLinks &&
  ql.noShowYet &&
  ql.menuFolds &&
  ql.hidden &&
  ql.stored &&
  ql.evenHidden === true &&
  ql.showLabel === 'Show on Home' &&
  ql.back &&
  ql.storedBack
    ? ok(
        'quick links: Home card across the last row (rows end level), RSI links in a new tab ↗, portrait menu group folds, Hide Card remembered, Show on Home brings it back',
      )
    : fail(`quick links: ${JSON.stringify(ql)}`);

  const colors = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const bal = document.querySelector('#home-balances .bal.uec b');
    const headWhite = () => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--head)';
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    return {
      key: document.querySelectorAll('.color-key li').length,
      tokens: ['--good', '--warn', '--bad', '--t-ship', '--t-pack', '--t-ccu'].every((n) =>
        cs.getPropertyValue(n).trim(),
      ),
      // Balances stay neutral white: body text or the heading white (Clean Pro's
      // numbers), never a meaning colour.
      whiteBal:
        bal &&
        [getComputedStyle(document.body).color, headWhite()].includes(getComputedStyle(bal).color),
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

  // The card is Svelte (ui/home/CitizenCard.svelte, SignedOut.svelte, Welcome.svelte).
  // Signed out: the Log In wall replaces the card, after the status line.
  const wall = await page.evaluate(async () => {
    const a = await OH.getAccount();
    const real = OH.getAccount;
    OH.getAccount = async () => ({ ...a, loggedIn: false });
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    const lo = document.querySelector('#cc-loggedout');
    const res = {
      wall: !lo.hidden && lo.getBoundingClientRect().height > 0,
      cardHidden: document.querySelector('#cc-account').hidden,
      afterStatus: !!document.querySelector('.cc-status ~ #cc-loggedout'),
      login: /Log In to RSI/.test(lo.textContent),
    };
    OH.getAccount = real;
    renderAccount();
    await new Promise((r) => setTimeout(r, 200));
    res.back = !document.querySelector('#cc-account').hidden && lo.hidden;
    return res;
  });
  Object.values(wall).every(Boolean)
    ? ok('signed out: the Log In wall replaces the card, and the card comes back')
    : fail(`signed-out wall: ${JSON.stringify(wall)}`);
  // First run (nothing scanned): the welcome card, its button, then the first
  // scan's progress in place of the button.
  const welcome = await page.evaluate(async () => {
    const keep = { items: state.items, buybacks: state.buybacks };
    state.items = [];
    state.buybacks = [];
    homeUpdated();
    await new Promise((r) => setTimeout(r, 100));
    const el = () => document.querySelector('#oh-welcome');
    const shown = !!el() && !document.querySelector('#welcome-scan').hidden;
    scanProgress.i = 1;
    scanProgress.n = 4;
    scanDetail('Buy-backs · page 2 · 200 items');
    await new Promise((r) => setTimeout(r, 100));
    const prog = document.querySelector('#welcome-progress');
    const progress = {
      shown: !prog.hidden,
      button: document.querySelector('#welcome-scan').hidden,
      text: document.querySelector('#wp-text').textContent,
      width: document.querySelector('#wp-fill').style.width,
    };
    scanDetail('');
    Object.assign(state, keep);
    homeUpdated();
    await new Promise((r) => setTimeout(r, 100));
    return { shown, progress, gone: !el() };
  });
  welcome.shown &&
  welcome.progress.shown &&
  welcome.progress.button &&
  /page 2/.test(welcome.progress.text) &&
  welcome.progress.width === '37.5%' &&
  welcome.gone
    ? ok('welcome card: Scan My Hangar, then the first scan as a progress bar; gone with data')
    : fail(`welcome card: ${JSON.stringify(welcome)}`);

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
    ? ok('Hangar Alerts in the bell: wishlist sale with a count; Citizen Card full width')
    : fail(`For You: ${JSON.stringify(home)}`);
  home.hidden && home.storeOpt
    ? ok('bell: × ignores an alert; Scan has a Store option')
    : fail(`For You ignore: ${JSON.stringify(home)}`);
  !(await page.$('#site-connect'))
    ? ok('website sync hidden without a sync site (the demo has none; store builds do)')
    : fail('site connect card shows without siteUrl');

  // The website (owner sign-off, 2026-10-04 and -05), switched on with siteUrl and the
  // website stubbed. Without the sign-in window (no identity permission), the code
  // fallback: Connect on the Citizen Card → the code to approve → the card goes quiet
  // and sync lives in the top bar: "Synced …" beside Scan, the ▾ menu's
  // openhangar.space section (Connected as your RSI handle, Open My Hangar; Sync Now
  // and Disconnect, asked once, are in your portrait's menu), a scan syncs once as its last step ("Syncing to Website…"), and a refused
  // sync shows in the scan report.
  const sc = await page.evaluate(async () => {
    const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
    const $ = (sel) => document.querySelector(sel);
    const txt = (el) => el?.textContent.replace(/\s+/g, ' ').trim() || '';
    const card = () => $('#view-home .citizen-card #site-connect');
    const btnIn = (root, label) =>
      root && [...root.querySelectorAll('button')].find((b) => b.textContent.includes(label));
    const menu = () => $('#scan-menu-sync');
    // Sync Now is only in your portrait's menu (owner, 2026-10-07).
    const syncNow = async () => {
      document.dispatchEvent(new CustomEvent('oh:close-menus'));
      await wait();
      $('#settings-btn').click();
      await wait();
      $('#settings-menu #menu-sync-now').click();
    };
    const openMenu = async () => {
      if ($('#scan-menu').hidden) $('#scan-menu-btn').click();
      await wait();
    };
    const keep = {
      start: OH.siteLinkStart,
      wait: OH.siteLinkWait,
      sync: OH.siteSync,
      answer: OH.siteSyncAnswer,
      get: OH.getSiteLink,
      off: OH.siteDisconnect,
      tabs: chrome.tabs?.create,
      identity: chrome.identity,
    };
    const r = {};
    let link = null;
    let approve;
    const opened = [];
    try {
      chrome.identity = undefined;
      await chrome.storage.local.set({ siteUrl: 'https://staging.example.test' });
      chrome.tabs = chrome.tabs || {};
      chrome.tabs.create = (o) => opened.push(o.url);
      OH.getSiteLink = async () => link;
      OH.siteLinkStart = async () => ({
        device_code: 'd',
        user_code: 'K7Q-4PX',
        verification_uri: 'https://staging.example.test/link',
        expires_in: 600,
        interval: 1,
      });
      OH.siteLinkWait = () =>
        new Promise((res) => {
          approve = () => {
            // The website login's name, not the RSI handle the menu shows.
            link = { token: 't', name: 'pilot.mail', connectedAt: Date.now(), lastSync: null };
            res(link);
          };
        });
      OH.siteSync = async () => {
        link = { ...link, lastSync: Date.now() };
        return { synced_at: link.lastSync };
      };
      OH.siteDisconnect = async () => {
        link = null;
      };
      await refreshSite();
      await wait();
      r.off = txt(card());
      r.noStatusYet = !$('#sync-status');
      // Not connected: the portrait's menu offers Connect at the top (#434).
      $('#settings-btn').click();
      await wait();
      r.youOffer = txt($('#settings-menu #menu-connect'));
      document.dispatchEvent(new CustomEvent('oh:close-menus'));
      await wait();
      btnIn(card(), 'Connect').click();
      await wait();
      r.wait = txt(card());
      r.copy = !!btnIn(card(), 'Copy');
      r.opened = opened[0];
      approve();
      await wait(150);
      r.quiet = !card();
      r.status = txt($('#sync-status'));
      await openMenu();
      r.menu = txt(menu());
      r.noScanSyncNow = !btnIn(menu(), 'Sync Now');
      await syncNow();
      await wait(150);
      r.menuClosed = $('#settings-menu').hidden;
      r.synced = txt($('#sync-status'));
      r.syncedTitle = $('#sync-status')?.title || '';
      // Top Bar Option A (2026-10-06): the Synced dot sits on the portrait, its hover
      // text says Synced, and the portrait's menu has the line with Sync Now.
      r.dotOnPortrait = !!$('#settings-btn #sync-status.sync-dot.on');
      r.portraitTip = $('#settings-btn').title;
      r.noBarText = !$('.hdr-prefs > #sync-status, .hdr-prefs .sync-status');
      document.dispatchEvent(new CustomEvent('oh:close-menus'));
      $('#settings-btn').click();
      await wait();
      r.youLine = txt($('#settings-menu #menu-sync'));
      r.youSyncNow = !!$('#settings-menu #menu-sync-now');
      document.dispatchEvent(new CustomEvent('oh:close-menus'));
      await wait();
      // Connected, a finished scan syncs once, as the Scan button's last step.
      let synced = 0;
      const realSync = OH.siteSync;
      OH.siteSync = async (opts) => {
        synced++;
        opts?.onSend?.(); // the real one calls it just before the upload
        await wait(0);
        r.label = topBar.label;
        r.button = $('#scan-home').getAttribute('aria-label') || '';
        return realSync();
      };
      await runScan({ hangar: false, buybacks: false, referrals: false });
      await wait(150);
      r.auto = synced;
      // A refused sync after a scan: the scan report says so, not the Citizen Card.
      OH.siteSync = async () => {
        throw new Error(
          'The website already has a newer scan from another browser. Scan here, then sync.',
        );
      };
      await runScan({ hangar: false, buybacks: false, referrals: false });
      await wait(250);
      r.report = $('#scan-report') && !$('#scan-report').hidden ? txt($('#scan-report')) : '';
      setScanning(''); // past the end-of-scan flash
      await wait();
      r.rough = txt($('#scan-home'));
      r.cardStillQuiet = !card();
      $('#scan-report .sr-x')?.click();
      await wait();
      // Sync Now refused: "Not Synced".
      OH.siteSync = async () => {
        throw new Error('Scan your hangar first, then press Sync Now.');
      };
      await syncNow();
      await wait(250);
      r.manual = $('#scan-report') && !$('#scan-report').hidden ? txt($('#scan-report')) : '';
      $('#scan-report .sr-x')?.click();
      await wait();
      // Sync not open yet: a calm note (an info sign, Roger That, no Flight Log), and
      // the Scan button stays as it was, after Sync Now and after a scan.
      OH.siteSync = async () => {
        throw Object.assign(
          new Error('Sync opens November 10. Your hangar stays safe in your browser until then.'),
          { calm: true },
        );
      };
      await syncNow();
      await wait(250);
      r.calm = $('#scan-report') && !$('#scan-report').hidden ? txt($('#scan-report')) : '';
      r.calmLook = !!$('#scan-report .sr-icon.calm') && !$('#scan-report #sr-send');
      r.calmButton = txt($('#scan-home'));
      btnIn($('#scan-report'), 'Roger That')?.click();
      await wait();
      r.calmClosed = $('#scan-report').hidden;
      await runScan({ hangar: false, buybacks: false, referrals: false });
      await wait(250);
      r.calmScan = $('#scan-report') && !$('#scan-report').hidden ? txt($('#scan-report')) : '';
      setScanning(''); // past the end-of-scan flash
      await wait();
      r.calmScanButton = txt($('#scan-home'));
      $('#scan-report .sr-x')?.click();
      await wait();
      // An RSI account this link hasn't synced: the scan report asks (a calm note with
      // Sync It and Don't Sync), the answer goes to OH.siteSyncAnswer, and Sync It
      // then syncs.
      const answers = [];
      let tries = 0;
      OH.siteSyncAnswer = async (who, yes) => answers.push(`${who.handle}:${yes}`);
      OH.siteSync = async () => {
        tries++;
        if (answers.at(-1) === 'Pilot_B:true') return realSync();
        throw Object.assign(new Error('Sync Pilot_B to your openhangar.space account?'), {
          calm: true,
          ask: { handle: 'Pilot_B', record: null },
        });
      };
      await runScan({ hangar: false, buybacks: false, referrals: false });
      await wait(250);
      r.askReport = $('#scan-report') && !$('#scan-report').hidden ? txt($('#scan-report')) : '';
      r.askLook = !!$('#scan-report .sr-icon.calm') && !$('#scan-report #sr-send');
      setScanning(''); // past the end-of-scan flash
      await wait();
      r.askScanButton = txt($('#scan-home'));
      btnIn($('#scan-report'), "Don't Sync")?.click();
      await wait(150);
      r.askClosed = !$('#scan-report')?.checkVisibility() && !topBar.report;
      await runScan({ hangar: false, buybacks: false, referrals: false });
      await wait(250);
      btnIn($('#scan-report'), 'Sync It')?.click();
      await wait(250);
      r.answers = answers.join(' ');
      r.askTries = tries;
      r.askSynced = !topBar.report;
      OH.siteSync = realSync;
      // Disconnect isn't in the Scan menu; it's in your portrait's menu, asked once.
      await openMenu();
      r.noScanDisconnect = !/Disconnect/.test(txt(menu()));
      $('#scan-report .sr-x')?.click();
      document.dispatchEvent(new CustomEvent('oh:close-menus'));
      await wait();
      $('#settings-btn').click();
      await wait();
      $('#you-disconnect').click();
      await wait();
      r.ask = txt($('#settings-menu .you-confirm'));
      r.menuStays = !$('#settings-menu').hidden;
      btnIn($('#settings-menu .you-confirm'), 'Disconnect').click();
      await wait(150);
      r.back = txt(card());
      r.statusGone = !$('#sync-status') && !menu();
    } finally {
      Object.assign(OH, {
        siteLinkStart: keep.start,
        siteLinkWait: keep.wait,
        siteSync: keep.sync,
        siteSyncAnswer: keep.answer,
        getSiteLink: keep.get,
        siteDisconnect: keep.off,
      });
      if (keep.tabs) chrome.tabs.create = keep.tabs;
      chrome.identity = keep.identity;
      topBar.report = null;
      await chrome.storage.local.remove('siteUrl');
      await refreshSite();
      await wait();
    }
    r.hiddenAgain = !card();
    return r;
  });
  /Connect to openhangar\.space/.test(sc.off) &&
  /Nothing is sent until you connect/.test(sc.off) &&
  sc.noStatusYet &&
  /^Connect to openhangar\.space\s*Optional/.test(sc.youOffer || '') &&
  /K7Q-4PX/.test(sc.wait) &&
  /Good for (10:00|9:5\d)/.test(sc.wait) &&
  sc.copy &&
  /\/link\?code=K7Q-4PX$/.test(sc.opened || '') &&
  sc.quiet &&
  sc.status === 'Connected' &&
  /Connected as Demo_Citizen/.test(sc.menu) &&
  !/pilot\.mail/.test(sc.menu) &&
  /Every scan syncs/.test(sc.menu) &&
  /Open My Hangar/.test(sc.menu) &&
  sc.noScanSyncNow &&
  sc.menuClosed &&
  /^Synced \d/.test(sc.synced) &&
  /^Synced to openhangar\.space today, /.test(sc.syncedTitle) &&
  sc.dotOnPortrait &&
  /^Synced \d/.test(sc.portraitTip) &&
  sc.noBarText &&
  /^Synced \d.*Sync Now$/.test(sc.youLine) &&
  sc.youSyncNow &&
  sc.auto === 1 &&
  sc.label === 'Syncing to Website…' &&
  /Syncing to Website…/.test(sc.button) &&
  /Scan Done, Not Synced/.test(sc.report) &&
  /newer scan from another browser/.test(sc.report) &&
  /Not Synced/.test(sc.rough) &&
  sc.cardStillQuiet &&
  /^Not Synced/.test(sc.manual) &&
  /Scan your hangar first/.test(sc.manual) &&
  /^Not Synced Yet\s*Sync opens November 10\..*Roger That$/.test(sc.calm) &&
  sc.calmLook &&
  /^Scan (All|Custom)$/.test(sc.calmButton) &&
  sc.calmClosed &&
  /^Scan Done, Not Synced Yet/.test(sc.calmScan) &&
  /^Scan (All|Custom)$/.test(sc.calmScanButton) &&
  /^New Pilot Aboard\s*Sync Pilot_B to your openhangar\.space account\?/.test(sc.askReport) &&
  /Sync It Don't Sync/.test(sc.askReport) &&
  /We'll remember your answer for Pilot_B\.$/.test(sc.askReport) &&
  sc.askLook &&
  /^Scan (All|Custom)$/.test(sc.askScanButton) &&
  sc.askClosed &&
  sc.answers === 'Pilot_B:false Pilot_B:true' &&
  sc.askTries === 3 &&
  sc.askSynced &&
  sc.noScanDisconnect &&
  sc.menuStays &&
  /Disconnect From openhangar\.space\?/.test(sc.ask) &&
  /Connect to openhangar\.space/.test(sc.back) &&
  sc.statusGone &&
  sc.hiddenAgain
    ? ok(
        "website sync: connect on the card or the portrait menu (the code with Copy and its time left), then the Synced dot on the portrait (Synced line and Sync Now in its menu), the ▾ menu, a scan syncs as its last step, problems in the scan report (sync not open yet as a calm note), a new RSI account asks first (Sync It / Don't Sync), disconnect",
      )
    : fail(`website sync: ${JSON.stringify(sc)}`);

  // The usual way (owner, 2026-10-04): the browser's sign-in window opens the website's
  // /connect page; Approve hands back a one-time code, traded for the token with the
  // PKCE verifier, and "Sync My Hangar Now" sends the first sync right away.
  const win = await page.evaluate(async () => {
    const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
    const card = () => document.querySelector('#view-home .citizen-card #site-connect');
    const text = () => card()?.textContent.replace(/\s+/g, ' ').trim() || '';
    const keep = { identity: chrome.identity, fetch: window.fetch, sync: OH.siteSync };
    const REDIRECT = 'https://aeabioadfphghjennmdbnpelojlhndjl.chromiumapp.org/';
    const r = {};
    let finish;
    try {
      await chrome.storage.local.set({ siteUrl: 'https://staging.example.test' });
      chrome.identity = {
        getRedirectURL: () => REDIRECT,
        launchWebAuthFlow: ({ url }) =>
          new Promise((res) => {
            r.url = url;
            const q = new URL(url).searchParams;
            finish = () => res(`${REDIRECT}?state=${q.get('state')}&code=one-time&sync=1`);
          }),
      };
      window.fetch = async (u, init) => {
        if (!String(u).endsWith('/api/link/token')) return keep.fetch(u, init);
        const body = JSON.parse(init.body);
        const d = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(body.code_verifier),
        );
        const challenge = btoa(String.fromCharCode(...new Uint8Array(d)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        r.pkce = challenge === new URL(r.url).searchParams.get('code_challenge');
        r.traded = body.code === 'one-time' && body.redirect_uri === REDIRECT;
        return new Response(JSON.stringify({ token: 'oht_x', name: 'ExamplePilot' }));
      };
      OH.siteSync = async () => {
        r.synced = true;
        const { siteLink } = await chrome.storage.local.get('siteLink');
        await chrome.storage.local.set({ siteLink: { ...siteLink, lastSync: Date.now() } });
        return { synced_at: Date.now() };
      };
      await refreshSite();
      await wait();
      [...card().querySelectorAll('button')].find((b) => /Connect/.test(b.textContent)).click();
      await wait();
      r.waiting = text();
      finish();
      await wait(250);
      r.quiet = !card();
      r.status = document.querySelector('#sync-status')?.textContent.trim() || '';
      r.page = new URL(r.url).pathname;
    } finally {
      chrome.identity = keep.identity;
      window.fetch = keep.fetch;
      OH.siteSync = keep.sync;
      await chrome.storage.local.remove(['siteUrl', 'siteLink']);
      await refreshSite();
      await wait();
    }
    return r;
  });
  win.page === '/connect' &&
  /Finish connecting in the window that opened/.test(win.waiting) &&
  win.pkce &&
  win.traded &&
  win.synced &&
  win.quiet &&
  /^Synced \d/.test(win.status)
    ? ok('website sync: the sign-in window, PKCE, and the first sync right after Approve')
    : fail(`connect window: ${JSON.stringify(win)}`);

  // Firefox (gecko manifest emulated): a line under Connect says what we share; Learn
  // More, and Connect until Firefox has said yes, open What We Share, and Why Firefox
  // Asks. Escape and Not Now close it (focus back on the button); Continue asks Firefox
  // inside its own click, and a no shows the usual message. Once allowed, Connect goes
  // straight on.
  const ff = await page.evaluate(async () => {
    const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
    const $ = (sel) => document.querySelector(sel);
    const txt = (el) => el?.textContent.replace(/\s+/g, ' ').trim() || '';
    const card = () => $('#view-home .citizen-card #site-connect');
    const btnIn = (root, label) =>
      root && [...root.querySelectorAll('button')].find((b) => b.textContent.includes(label));
    const keep = {
      manifest: chrome.runtime.getManifest,
      permissions: chrome.permissions,
      identity: chrome.identity,
    };
    const r = { asked: 0, inClick: [] };
    let granted = false;
    let answer = false;
    let inClick = false;
    try {
      const m = keep.manifest();
      chrome.runtime.getManifest = () => ({
        ...m,
        browser_specific_settings: { gecko: { id: 'open-hangar@draco-foundry' } },
      });
      chrome.permissions = {
        contains: async () => granted,
        request: (p) => {
          r.asked++;
          r.inClick.push(inClick);
          r.what = p.data_collection;
          granted = answer;
          return Promise.resolve(answer);
        },
      };
      chrome.identity = {
        getRedirectURL: () => 'https://x.example/',
        launchWebAuthFlow: async () => {
          r.window = true;
          throw new Error('The user cancelled');
        },
      };
      await chrome.storage.local.set({ siteUrl: 'https://staging.example.test' });
      await refreshSite();
      await wait();
      r.line = txt(card()?.querySelector('.sc-ff'));
      const learn = card().querySelector('.sc-learn');
      learn.click();
      await wait();
      r.card = txt($('#fx-explain'));
      r.focusIn = $('#fx-explain').contains(document.activeElement);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait();
      r.escClosed = !$('#fx-explain');
      r.focusBack = document.activeElement === learn;
      btnIn(card(), 'Connect').click();
      await wait();
      r.connectOpens = !!$('#fx-explain') && r.asked === 0;
      btnIn($('#fx-explain'), 'Not Now').click();
      await wait();
      r.notNow = !$('#fx-explain') && r.asked === 0;
      btnIn(card(), 'Connect').click();
      await wait();
      inClick = true;
      btnIn($('#fx-explain'), 'Continue').click();
      inClick = false;
      await wait(150);
      r.refused = !$('#fx-explain') && txt(card());
      answer = true;
      btnIn(card(), 'Connect').click();
      await wait();
      inClick = true;
      btnIn($('#fx-explain'), 'Continue').click();
      inClick = false;
      await wait(150);
      r.yesConnects = r.window === true;
      r.window = false;
      await refreshSite();
      await wait();
      btnIn(card(), 'Connect').click();
      await wait(150);
      r.straightOn = !$('#fx-explain') && r.window === true;
    } finally {
      chrome.runtime.getManifest = keep.manifest;
      chrome.permissions = keep.permissions;
      chrome.identity = keep.identity;
      await chrome.storage.local.remove('siteUrl');
      await refreshSite();
      await wait();
    }
    return r;
  });
  /pledge prices and store credit/.test(ff.line) &&
  /Learn More/.test(ff.line) &&
  /What We Share, and Why Firefox Asks/.test(ff.card) &&
  ['What we send', 'What we never send', 'Why Firefox asks', 'If you say no', 'Change your mind']
    .map((h) => ff.card.includes(h))
    .every(Boolean) &&
  ff.focusIn &&
  ff.escClosed &&
  ff.focusBack &&
  ff.connectOpens &&
  ff.notNow &&
  /Sync stays off until you let Firefox share/.test(ff.refused || '') &&
  // Continue's clicks asked inside the click; once allowed, Connect only checks.
  ff.inClick.join() === 'true,true,false' &&
  ff.yesConnects &&
  ff.straightOn
    ? ok('Firefox: what we share under Connect, the explainer, and Continue asks inside its click')
    : fail(`Firefox explainer: ${JSON.stringify(ff)}`);

  // Currency: EUR converts the melt box (rates come from the demo's fixed file).
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
    // A broken RSI link breaks both sizes (they share the same base).
    const img = card.querySelector('img.thumb');
    if (img.hasAttribute('srcset'))
      img.srcset =
        'https://robertsspaceindustries.com/media/open-hangar-missing/store_small/b.jpg 351w, https://robertsspaceindustries.com/media/open-hangar-missing/slideshow/b.jpg 648w';
    img.src = 'https://robertsspaceindustries.com/media/open-hangar-missing/broken.jpg';
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
  // Tick a row without Select mode; % and price stay linked. The list is Svelte
  // (ui/inventory): it redraws a moment after each change.
  await page.click('.market-table .mk-pick');
  const mk = await page.evaluate(async () => {
    const row = document.querySelector('.market-table .mk-row');
    const pct = row.querySelector('.mk-pct-in');
    pct.focus();
    pct.value = '50';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    return {
      // Typing keeps the field (and its focus): the row isn't redrawn under the cursor.
      kept: document.activeElement === pct && pct.isConnected && pct.value === '50',
      count: document.querySelector('.mk-selcount').textContent,
      bar: !document.querySelector('#select-bar').hidden,
      price: Number(row.querySelector('.mk-price').value),
      melt: Number(row.dataset.melt),
    };
  });
  /1 picked/.test(mk.count) && mk.bar
    ? ok('market rows tick without Select mode')
    : fail(`market tick: ${JSON.stringify(mk)}`);
  mk.kept ? ok('typing a % keeps focus in the field') : fail(`market focus: ${JSON.stringify(mk)}`);
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
  const autoTick = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 60));
    const row = document.querySelectorAll('.market-table .mk-row')[1];
    const pct = row.querySelector('.mk-pct-in');
    pct.value = '60';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    const ticked = row.querySelector('.mk-pick').checked && row.classList.contains('picked');
    const store = row.querySelector('.mk-store').textContent.trim();
    pct.value = '';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    row.querySelector('.mk-pick').click();
    await tick();
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
  await new Promise((r) => setTimeout(r, 60));
  const sel = await page.$eval('#sb-count', (e) => e.textContent);
  const marked = await page.$$eval('#results .card.selected', (e) => e.length);
  /2 selected/.test(sel) && marked === 2
    ? ok('select mode picks items')
    : fail(`select mode: "${sel}", ${marked} marked`);
  await page.click('[data-sb="done"]');
  // Export ▾ items run (the menu used to swallow their clicks): Share Image starts
  // Select mode, and Buy-Backs' CSV item reaches its handler too.
  await page.click('#inv-exp-btn');
  await page.click('#inv-exp-menu [data-export="inv-image"]');
  const exp = await page.evaluate(async () => {
    const r = {
      selecting: state.selecting,
      menuClosed: document.querySelector('#inv-exp-menu').hidden,
    };
    setSelecting(false);
    const real = exportBuybackCsv;
    let called = false;
    exportBuybackCsv = () => (called = true);
    location.hash = '#buybacks';
    await new Promise((res) => setTimeout(res, 300));
    document.querySelector('#bb-exp-btn').click();
    document.querySelector('#bb-exp-menu [data-export="bb-csv"]').click();
    exportBuybackCsv = real;
    r.bbCsv = called;
    location.hash = '#inventory';
    await new Promise((res) => setTimeout(res, 300));
    return r;
  });
  exp.selecting && exp.menuClosed && exp.bbCsv
    ? ok('Export menu items run (Share Image starts Select mode, Buy-Backs CSV)')
    : fail(`export menu: ${JSON.stringify(exp)}`);

  console.log('Broken thumbnails');
  await go('#inventory');
  const thumb = await page.evaluate(async () => {
    let img = document.querySelector('#results .card img.thumb');
    if (!img) {
      // Offline (no RSI or wiki pictures), every card shows its placeholder: give
      // the first one a picture the way the art lookup does, then break it.
      const ph = document.querySelector('#results .card .thumb.placeholder');
      img = document.createElement('img');
      img.className = 'thumb';
      img.alt = '';
      ph.replaceWith(img);
    }
    const card = img.closest('.card');
    const missing = `${location.origin}/missing-${Date.now()}`;
    // Both sizes break together, as they would for a dead RSI link.
    if (img.hasAttribute('srcset')) img.srcset = `${missing}-s.jpg 351w, ${missing}-l.jpg 648w`;
    img.src = `${missing}.jpg`; // 404
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
  // Typed key by key, as a person does: the first letter must survive (0.2.13
  // cleared the box on every keystroke under 2 letters, so nothing could be typed).
  for (const sel of ['#gsearch', '#gsearch-top']) {
    await page.$eval(sel, (b) => {
      b.value = '';
      b.blur();
    });
    // The top bar's box opens from its search icon (Top Bar Option A).
    await page.click(sel === '#gsearch-top' ? '#top-search-btn' : sel);
    await page.keyboard.type('cutlass', { delay: 15 });
    const typed = await page.$eval(sel, (b) => b.value);
    typed === 'cutlass'
      ? ok(`${sel}: typing key by key keeps every letter`)
      : fail(`${sel}: typed "cutlass", box holds "${typed}"`);
    await page.keyboard.press('Escape');
  }
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
    // With results open, the wheel isn't swallowed: off the panel it's the page's,
    // and on a list that can't scroll it goes to the page too (owner, 2026-10-06).
    box.value = 'au';
    box.dispatchEvent(new Event('input'));
    const wheel = (el) => {
      const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    const list = out.querySelector('.gs-scroll');
    const listScrolls = !!list && list.scrollHeight > list.clientHeight + 1;
    const wheelFree =
      !wheel(document.querySelector('#view-home .citizen-card') || document.body) &&
      (listScrolls || !wheel(out.querySelector('.gs-title') || out));
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
      wheelFree,
      shipName,
      closed: out.hidden,
      title: modal.querySelector('.modal-name')?.textContent,
      inHangar: /In Your Hangar \(\d+\)/.test(modal.textContent),
      links: modal.querySelectorAll('.mr-v a').length,
    };
  });
  await page.evaluate(() => document.querySelector('#modal-close').click());
  !gs.groups.includes('Ships') &&
  gs.hangarRow &&
  !gs.storeRow &&
  gs.notOwned &&
  gs.wheelFree &&
  gs.closed
    ? ok(`hangar search "cutlass": ${gs.groups.join(', ')}; "Idris" (not owned) finds nothing`)
    : fail(`global search: ${JSON.stringify(gs)}`);
  // A result opens its pledge, and both searches start empty again (#178).
  const pick = await page.evaluate(async () => {
    const box = document.querySelector('#gsearch-top');
    box.value = 'cutlass';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await new Promise((r) => setTimeout(r, 300));
    const res = {
      modal: !document.querySelector('#item-modal').hidden,
      cleared: box.value === '' && document.querySelector('#gsearch-top-results').hidden,
    };
    document.querySelector('#modal-close').click();
    return res;
  });
  pick.modal && pick.cleared
    ? ok('search: Enter opens the first result and the box starts empty again')
    : fail(`search pick: ${JSON.stringify(pick)}`);
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
    // The page around the list is Svelte (ui/inventory): it redraws a moment later.
    const tick = () => new Promise((res) => setTimeout(res, 60));
    r.sum = /Pledges\s*\d+/i.test(document.querySelector('#inv-sum').textContent);
    const all = computeShown().length;
    document.querySelector('[data-switch="inv-hide"]').click();
    r.hid = computeShown().length < all;
    document.querySelector('[data-switch="inv-hide"]').click();
    // Saved views (no prompt in the test: push them directly, then apply). The old
    // format ([trait, 'yes']) reads as the matching sidebar option.
    state.savedViews.push(
      { name: 'Ships', f: { shown: ['ship'], traits: [], query: '', hideSmall: false } },
      { name: 'LTI', f: { shown: [], traits: [['lti', 'yes']], query: '', hideSmall: false } },
    );
    renderInventory();
    await tick();
    document.querySelector('[data-view-apply="0"]').click();
    await tick();
    r.view =
      computeShown().every((p) => p.kind === 'ship') &&
      state.shown.has('ship') &&
      !!document.querySelector('.view-chip.on [data-view-apply="0"]');
    document.querySelector('[data-view-apply="1"]').click();
    await tick();
    r.oldView = computeShown().length > 0 && computeShown().every((p) => p.insurance === 'LTI');
    state.savedViews = [];
    resetInvFilters();
    renderInventory();
    await tick();
    // Melt planner: pick two meltable pledges with a wishlist ship.
    const keepWish = state.wishlist;
    state.wishlist = ['Cutlass Black'];
    setSelecting(true);
    state.items
      .filter(isMeltable)
      .slice(0, 2)
      .forEach((p) => state.selected.add(p.id));
    renderInventory();
    await tick();
    r.planner = document.querySelector('#sb-melt').textContent;
    state.selected.clear();
    setSelecting(false);
    state.wishlist = keepWish;
    // Top bar: page names only, no counts (#260), bell, search.
    const navText = [...document.querySelectorAll('#nav a')].map((a) => a.textContent.trim());
    r.counts =
      !document.querySelector('#nav .nav-n') &&
      navText.includes('Inventory') &&
      navText.includes('Buy-Backs');
    r.bell = !!document.querySelector('#bell-btn') && !!document.querySelector('#bell-menu');
    const top = document.querySelector('#gsearch-top');
    top.value = 'cutlass';
    top.dispatchEvent(new Event('input'));
    r.search = !!document.querySelector('#gsearch-top-results .gs-row');
    top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return r;
  });
  inv.sum && inv.hid && inv.view && inv.oldView && /from your wishlist|wishlist/.test(inv.planner)
    ? ok('inventory: summary strip, Hide small stuff, saved views, melt planner')
    : fail(`inventory pass: ${JSON.stringify(inv)}`);
  inv.counts && inv.bell && inv.search
    ? ok('top bar: page names without counts, alerts bell, search on every page')
    : fail(`top bar: ${JSON.stringify(inv)}`);

  // Filters Pass (B2): the sidebar's groups, the pills above the list, folding away.
  const side = await page.evaluate(async () => {
    const tick = () => new Promise((res) => setTimeout(res, 60));
    const r = {};
    const all = state.items.length;
    // Buy-Backs has the same sidebar: look only inside Inventory.
    const root = document.querySelector('#view-inventory');
    const q = (sel) => root.querySelector(sel);
    const opt = (g, k) => q(`.oh-fg[data-group="${g}"] [data-option="${k}"]`);
    r.groups = [...root.querySelectorAll('.oh-fg summary')].map((x) => x.textContent);
    // Within a group: either option. Across groups: both.
    opt('status', 'meltable').click();
    await tick();
    const melt = computeShown().length;
    opt('status', 'notMeltable').click();
    await tick();
    r.or = computeShown().length === all;
    opt('status', 'notMeltable').click();
    opt('ins', 'LTI').click();
    await tick();
    r.and = computeShown().every((p) => p.meltable === true && p.insurance === 'LTI');
    r.count = q('.oh-fg[data-group="status"] .oh-sn')?.textContent === '1';
    r.pills = [...root.querySelectorAll('.oh-af')].map((x) => x.textContent);
    // × on a pill removes just that filter.
    q('.oh-af button').click();
    await tick();
    r.removed = computeShown().length === melt;
    // Melt Value: everything shown is at or under the cap.
    const range = q('.oh-range input');
    range.value = 100;
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 300));
    r.meltCap =
      computeShown().every((p) => p.value <= 100) && /Up to/.test(q('.oh-active').textContent);
    // Manufacturer search narrows its options.
    const find = q('.oh-fg[data-group="mfr"] .oh-fsearch');
    const before = root.querySelectorAll('.oh-fg[data-group="mfr"] .oh-opt').length;
    find.value = 'drake';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    const after = [...root.querySelectorAll('.oh-fg[data-group="mfr"] .oh-opt')];
    r.mfrSearch = after.length < before && after.every((b) => /drake/i.test(b.textContent));
    // Clear All, then fold the sidebar away: Filters (n) brings it back.
    q('.oh-clearall').click();
    await tick();
    r.cleared = computeShown().length === all && !q('.oh-active');
    opt('deals', 'below').click();
    q('.oh-fbar .oh-link').click();
    await tick();
    const fbtn = q('.oh-fbtn');
    r.folded =
      q('.oh-side').classList.contains('folded') && !!fbtn && /Filters\s*1/.test(fbtn.textContent);
    r.pillsWhileFolded = !!q('.oh-af');
    fbtn.click();
    await tick();
    r.back = !q('.oh-side').classList.contains('folded') && state.invFolded === false;
    // A folded-shut group is remembered.
    const det = q('.oh-fg[data-group="deals"]');
    det.open = false;
    await tick();
    r.closed = state.invClosed.has('deals');
    det.open = true;
    await tick();
    resetInvFilters();
    renderInventory();
    await tick();
    return r;
  });
  side.groups.join('|').startsWith('Insurance|Status|Deals|Came From') &&
  side.or &&
  side.and &&
  side.count &&
  side.pills.length === 2 &&
  side.removed &&
  side.meltCap &&
  side.mfrSearch &&
  side.cleared
    ? ok(
        'filter sidebar: groups (any in a group, all across), counts, pills with ×, Melt Value, Manufacturer search, Clear All',
      )
    : fail(`filter sidebar: ${JSON.stringify(side)}`);
  side.folded && side.pillsWhileFolded && side.back && side.closed
    ? ok(
        'filter sidebar folds away (Filters (n) brings it back, pills stay), group folds remembered',
      )
    : fail(`filter sidebar fold: ${JSON.stringify(side)}`);
  await checkEscapeFilters('inventory', 'inventory', '#search', () =>
    page.click('#results .card[data-id]'),
  );

  console.log('Buy-Backs');
  await go('#buybacks');
  const tok = await page.$eval('#bb-sum', (e) => e.textContent).catch(() => '');
  const tokSoon = await page.evaluate(() => OH.soonBuybackToken() != null);
  /Tokens\s*2/i.test(tok) && /Tokens\s*2\s*next/i.test(tok) === tokSoon
    ? ok('buy-back tokens in the summary strip')
    : fail(`tokens: "${tok}"`);
  // Buy-Backs pass: Hide small stuff on by default; Stack identical off by default
  // and stacks copies when on.
  const bbPass = await page.evaluate(async () => {
    // The list is Svelte (ui/buybacks): it redraws a moment after each change.
    const tick = () => new Promise((res) => setTimeout(res, 60));
    const rows = () => document.querySelectorAll('#buybacks-body .card').length;
    const hideOn = state.bbHideSmall;
    const stackOff = !state.bbStack;
    const saved = state.buybacks;
    state.buybacks = saved.concat(saved.slice(0, 2).map((x) => ({ ...x, id: x.id + '-copy' })));
    renderBuybacks();
    await tick();
    const flat = rows();
    document.querySelector('[data-switch="bb-stack"]').click();
    await tick();
    const stacked = rows();
    const badges = document.querySelectorAll('#buybacks-body .stack-n').length;
    document.querySelector('[data-switch="bb-stack"]').click();
    state.buybacks = saved;
    renderBuybacks();
    await tick();
    return { hideOn, stackOff, flat, stacked, badges };
  });
  bbPass.hideOn && bbPass.stackOff && bbPass.stacked === bbPass.flat - 2 && bbPass.badges === 2
    ? ok('buy-backs: small stuff hidden by default; Stack identical is opt-in and stacks copies')
    : fail(`buy-backs pass: ${JSON.stringify(bbPass)}`);
  // The same filter sidebar as Inventory (ui/buybacks): insurance read from the
  // contents line, a price cap, the pills, and Clear All.
  const bbSide = await page.evaluate(async () => {
    const tick = () => new Promise((res) => setTimeout(res, 60));
    const root = document.querySelector('#view-buybacks');
    const q = (sel) => root.querySelector(sel);
    const r = {};
    r.groups = [...root.querySelectorAll('.oh-fg')].map((g) => g.dataset.group).join(',');
    const all = computeBuybacks().length;
    q('.oh-fg[data-group="ins"] [data-option="LTI"]').click();
    await tick();
    const lti = computeBuybacks();
    r.lti =
      lti.length > 0 &&
      lti.length < all &&
      lti.every((b) => /lifetime|lti/i.test(`${b.name} ${b.contains}`));
    r.pill = /Insurance:\s*LTI/.test(q('.oh-active')?.textContent || '');
    const range = q('.oh-range input');
    range.value = 50;
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 300));
    r.cap = computeBuybacks().every((b) => bbPrice(b) != null && bbPrice(b) <= 50);
    q('.oh-clearall').click();
    await tick();
    r.cleared = computeBuybacks().length === all && !q('.oh-active');
    r.switches = !!q('[data-switch="bb-hide"]') && !!q('[data-switch="bb-stack"]');
    return r;
  });
  /ins/.test(bbSide.groups) &&
  bbSide.lti &&
  bbSide.pill &&
  bbSide.cap &&
  bbSide.cleared &&
  bbSide.switches
    ? ok('buy-backs filter sidebar: insurance from the contents line, price cap, pills, Clear All')
    : fail(`buy-backs sidebar: ${JSON.stringify(bbSide)}`);
  await checkEscapeFilters('buy-backs', 'buybacks', '#bb-search', () =>
    page.click('#buybacks-body .card[data-id]'),
  );
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
      // Retired ships (#306): a "Retired, Buy-Back Still Open" label, still a link.
      /Reclaim|Retired, Buy-Back Still Open/.test(r.textContent),
    ),
    ins: !!document.querySelector('#buybacks-body .market-table .mk-ins'),
  }));
  const bbTotal = await page.$eval('#buybacks-body .result-count', (e) =>
    Number((e.textContent.match(/of (\d+)/) || [])[1]),
  );
  bbm.rows === bbTotal && bbm.reclaim && bbm.ins
    ? ok(`buy-back market: ${bbm.rows} rows, one each, Reclaim + Insurance`)
    : fail(`buy-back market: ${JSON.stringify(bbm)} vs ${bbTotal}`);
  // A CCU's Reclaim opens its one-item buy-back list entry, never the pledge store
  // its RSI button points at (owner, 2026-10-05).
  const ccuLink = await page.evaluate(() => {
    // A CCU that isn't retired (a retired one is labelled as such).
    const c = state.buybacks.find((b) => b.ccu && !OH.retiredBuyback(b));
    if (!c) return { none: true };
    const r = reclaimOf({ ...c, href: 'https://robertsspaceindustries.com/pledge' });
    return { href: r?.url || '' };
  });
  ccuLink.none || /buy-back-pledges\?pagesize=1&page=\d+$/.test(ccuLink.href)
    ? ok('CCU buy-back: Reclaim opens its own buy-back entry, not the pledge store')
    : fail(`CCU buy-back link: ${JSON.stringify(ccuLink)}`);
  // Market tools: pricing a row ticks it; picked rows are totalled.
  const bbTools = await page.evaluate(async () => {
    const row = document.querySelector('#buybacks-body .market-table tbody tr');
    const pct = row.querySelector('.mk-pct-in');
    pct.value = '50';
    pct.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
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
  await page.evaluate(async () => {
    const box = document.querySelector('#buybacks-body .mk-pick');
    box.click(); // untick so later checks start clean
    const row = box.closest('tr');
    const price = row.querySelector('.mk-price');
    price.value = '';
    price.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
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
  /full price|today's upgrade price/.test(bbModal)
    ? ok('buy-back window: the full price note sits by the price (#403)')
    : fail(`buy-back price note: "${bbModal.slice(0, 200)}"`);
  await page.keyboard.press('Escape');
  // Can't Be Bought Back (#403): a tag with the reason and no Reclaim link; and the
  // Melt on RSI confirm in a pledge window, red for a pledge RSI never sells back.
  const melt = await page.evaluate(async () => {
    const pause = () => new Promise((r) => setTimeout(r, 120));
    const q = (sel) => document.querySelector(`#item-modal ${sel}`);
    const text = (sel) => (q(sel) ? q(sel).textContent.replace(/\s+/g, ' ').trim() : '');
    const out = {};
    const b = state.buybacks.find((x) => !x.isCCU && /^\d+$/.test(String(x.id)));
    openBuybackModal({ ...b, name: 'Add-On - Name Reservation', kind: 'addon' });
    await pause();
    out.bbTag = text('.bb-blocked');
    out.bbReason = text('#bb-block-note');
    out.bbNoReclaim = !q('a.bb-reclaim');
    document.querySelector('#modal-close').click();
    const p = state.items.find((x) => x.meltable !== false && !x.isCCU) || state.items[0];
    openItemModal({
      ...p,
      meltable: true,
      contents: [...(p.contents || []), { kind: '', label: 'Squadron 42 Digital Download' }],
    });
    await pause();
    out.closedFirst = !q('#melt-confirm');
    q('#melt-open')?.click();
    await pause();
    out.red = !!q('#melt-confirm.danger');
    out.title = text('#melt-never');
    out.never = text('.melt-never');
    out.go = text('#melt-go');
    out.goHref = q('#melt-go')?.getAttribute('href') || '';
    out.keepFocused = document.activeElement?.textContent === 'Keep It';
    document.activeElement?.click();
    await pause();
    out.kept = !q('#melt-confirm');
    document.querySelector('#modal-close').click();
    openItemModal({ ...p, meltable: true, name: 'Standalone Ships - Arrow', contents: [] });
    await pause();
    q('#melt-open')?.click();
    await pause();
    out.plain = !!q('#melt-confirm') && !q('#melt-confirm.danger');
    out.plainGo = text('#melt-go');
    out.plainText = text('#melt-confirm');
    document.querySelector('#modal-close').click();
    return out;
  });
  melt.bbTag === "Can't Be Bought Back" && /Add-on pledges/.test(melt.bbReason) && melt.bbNoReclaim
    ? ok("buy-back window: Can't Be Bought Back with the reason, no Reclaim link")
    : fail(`can't be bought back: ${JSON.stringify(melt)}`);
  melt.closedFirst &&
  melt.red &&
  melt.title === 'Gone for Good if You Melt It' &&
  /RSI never sells this one back\. Pledges with Squadron 42/.test(melt.never) &&
  melt.go === 'I Understand, Open on RSI ↗' &&
  /^https:\/\/robertsspaceindustries\.com\/account\/pledges\?page=\d+$/.test(melt.goHref) &&
  melt.keepFocused &&
  melt.kept
    ? ok('pledge window: Melt on RSI asks first; red Gone for Good warning for never-sold-back')
    : fail(`melt warning: ${JSON.stringify(melt)}`);
  melt.plain &&
  melt.plainGo === 'Open on RSI ↗' &&
  /full price.*Buy-Back Token/.test(melt.plainText)
    ? ok('pledge window: a plain melt confirm says what melting costs')
    : fail(`melt confirm: ${JSON.stringify(melt)}`);
  await page.click('#bb-layout [data-layout="gallery"]');
  await page.click('#bb-layout [data-layout="list"]');
  await checkListAlignment('Buy-Backs', '#buybacks-body');

  console.log('Stats');
  // Stats is the Svelte page in ui/stats, mounted into #stats-body.
  await go('#stats');
  const tabs = await page.$$eval('#stats-body [data-stats-tab]', (b) =>
    b.map((x) => x.dataset.statsTab),
  );
  tabs.length === 8 ? ok('stats: 8 tabs') : fail(`stats tabs: ${tabs.join(',')}`);
  for (const tab of tabs) {
    await page.$eval(`[data-stats-tab="${tab}"]`, (b) => b.click());
    await new Promise((r) => setTimeout(r, 200));
    const t = await page.$eval('#stats-body', (e) => ({
      text: e.textContent.trim().length,
      picked: e.querySelector('[aria-selected="true"]')?.dataset.statsTab,
    }));
    t.text > 40 && t.picked === tab
      ? ok(`${tab} tab renders`)
      : fail(`${tab} tab: ${JSON.stringify(t)}`);
  }
  await page.$eval('[data-stats-tab="history"]', (b) => b.click());
  await new Promise((r) => setTimeout(r, 200));
  const acct = await page.evaluate(() => {
    const last = state.history[state.history.length - 1];
    return {
      title: [...document.querySelectorAll('#stats-body h3')].map((h) => h.textContent).join('|'),
      store: snapshotStore(last),
      now: accountValue().total,
      dots: document.querySelectorAll('.hist-chart circle').length,
      steps: document.querySelectorAll('#stats-body .hist-step').length,
      tip: document.querySelector('.hist-chart circle:last-of-type title')?.textContent || '',
    };
  });
  /Account Value Over Time/.test(acct.title) &&
  acct.store > 0 &&
  Math.abs(acct.store - acct.now) < 1 &&
  acct.dots >= 2 &&
  acct.steps >= 1
    ? ok(`history charts account value (latest ${acct.tip})`)
    : fail(`account value: ${JSON.stringify(acct)}`);
  // Download Backup (the classic [data-backup] handler) updates the line beside it.
  const backup = await page.evaluate(async () => {
    const before = document.querySelector('#stats-body .backup-row').textContent;
    document.querySelector('#stats-body [data-backup]').click();
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: document.querySelector('#stats-body .backup-row').textContent };
  });
  /never backed up/.test(backup.before) && /last backup/.test(backup.after)
    ? ok('download backup updates the last backup line')
    : fail(`backup row: ${JSON.stringify(backup)}`);

  for (const [tab, sel] of [
    ['fleet', '#stats-body .fleet-cols .bar-row'],
    ['collection', '#stats-body .bar-row'],
    ['buybacks', '#stats-body .row.clickable[data-open-bb]'],
    ['top', '#stats-body .row.clickable[data-open-item]'],
  ]) {
    await page.evaluate((t) => document.querySelector(`[data-stats-tab="${t}"]`).click(), tab);
    await page.waitForSelector(sel, { timeout: 8000 }).catch(() => {});
    (await page.$(sel)) ? ok(`${tab} tab has its rows`) : fail(`${tab} tab empty`);
  }
  await page.click('#stats-body .row.clickable');
  (await page.$eval('#item-modal', (m) => !m.hidden))
    ? ok('top list row opens the pledge')
    : fail('top list row did not open');
  await page.keyboard.press('Escape');
  // Streamer Mode hides every amount on the page.
  const masked = await page.evaluate(async () => {
    streamer.on = true;
    route();
    await new Promise((r) => setTimeout(r, 200));
    const text = document.querySelector('#stats-body').textContent;
    streamer.on = false;
    route();
    await new Promise((r) => setTimeout(r, 200));
    return { dots: /••••/.test(text), money: /\$\d/.test(text) };
  });
  masked.dots && !masked.money
    ? ok('streamer mode hides stats amounts')
    : fail(`stats streamer mode: ${JSON.stringify(masked)}`);

  console.log('Org Fleet');
  // The page is Svelte (ui/org); it redraws a microtask after each change.
  const orgTick = () => new Promise((r) => setTimeout(r, 150));
  await go('#org');
  (await page.$('#oh-org .org-actions #org-import'))
    ? ok('org page mounts with its buttons')
    : fail('org page did not mount');
  await page.click('#org-mine');
  await page
    .waitForFunction(
      () => /Added your fleet/.test(document.querySelector('#org-msg').textContent),
      {
        timeout: 8000,
      },
    )
    .catch(() => {});
  (await page.$eval('#org-msg', (m) => /Added your fleet \(\d+ ships\)/.test(m.textContent)))
    ? ok('Add My Fleet says what it added')
    : fail(`Add My Fleet message: ${await page.$eval('#org-msg', (m) => m.textContent)}`);
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
    msg: document.querySelector('#org-msg').textContent,
  }));
  org.members === 2 && org.rows > 0 && /Added 1 fleet\./.test(org.msg)
    ? ok(`org fleet: ${org.members} members, ${org.rows} ship types`)
    : fail(`org fleet: ${JSON.stringify(org)}`);
  const roleChips = await page.$$eval('.role-chip', (c) => c.length);
  const memberRows = await page.$$eval('.org-table', (t) => t.length);
  const roleCount = await page.evaluate(() => OH.ORG_ROLES.length);
  roleChips === roleCount && memberRows >= 3
    ? ok(`org roles (${roleChips}) + biggest ships + members`)
    : fail(`org extras: ${roleChips} role chips, ${memberRows} tables`);
  await page.click('.role-chip.missing');
  await orgTick();
  const rolePanel = await page.evaluate(() => ({
    panel: !!document.querySelector('.org-panel'),
    open: document.querySelector('.role-chip.missing.open')?.getAttribute('aria-expanded'),
  }));
  rolePanel.panel && rolePanel.open === 'true'
    ? ok('missing role opens suggestions')
    : fail(`role click: ${JSON.stringify(rolePanel)}`);
  await page.click('.org-close[data-close="role"]');
  await orgTick();
  (await page.$('.org-panel')) ? fail('role panel did not close') : ok('role panel closes');
  await page.click('.org-mrow');
  await orgTick();
  (await page.$('.pair-row')) ? ok('member opens vs-org charts') : fail('member panel missing');
  // Your entry follows your latest scan, and a concept-only role is amber, not missing.
  const live = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 50));
    const mine = OHApp.org.members.find((m) => m.mine);
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
    await tick();
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
    await tick();
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
  await orgTick();
  (await page.$('.cmp-cols')) ? ok('compare two members') : fail('compare panel missing');
  // Remove a member: its chip goes, the rest stays (and so does what's saved).
  await page.click('.org-remove[data-name="Buddy"]');
  await page
    .waitForFunction(() => document.querySelectorAll('.org-member').length === 1, {
      timeout: 5000,
    })
    .catch(() => {});
  const removed = await page.evaluate(async () => ({
    chips: document.querySelectorAll('.org-member').length,
    saved: ((await chrome.storage.local.get('orgFleet')).orgFleet?.members || []).map(
      (m) => m.name,
    ),
    compare: !!document.querySelector('.org-compare-bar'),
  }));
  removed.chips === 1 && !removed.saved.includes('Buddy') && !removed.compare
    ? ok('remove a member')
    : fail(`remove member: ${JSON.stringify(removed)}`);

  console.log('Store');
  await go('#store');
  // The extension's Store is your side of it (0.3.0): Wishlist, Your CCUs and Find
  // in Store, under a link to the website's full store. No store-wide browsing.
  await page
    .waitForFunction(
      () => /^Search \d+ items…$/.test(document.querySelector('#find-ship')?.placeholder || ''),
      {
        timeout: 20000,
      },
    )
    .catch(() => {});
  const fs1 = await page.evaluate(async () => {
    const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
    const box = document.querySelector('#find-ship');
    const placeholder = box.placeholder;
    box.value = 'c';
    box.dispatchEvent(new Event('input'));
    await tick();
    const oneLetter = document.querySelectorAll('.fis-hits li').length;
    box.value = 'cutlass';
    box.dispatchEvent(new Event('input'));
    await tick();
    const rows = [...document.querySelectorAll('.fis-hits li')];
    const hits = rows.map((li) => li.querySelector('.fis-name').textContent.trim());
    const kinds = rows.map((li) => li.querySelector('.badge').textContent);
    // Add a store item (a paint) to the wishlist from the results, then take it off.
    const paint = rows.find((li) => /Ghoulish Green/.test(li.textContent));
    paint?.querySelector('.fis-wish').click();
    await tick();
    const added = state.wishlist.some((e) => e && e.id === 'sku-501' && e.kind === 'paint');
    const pressed = paint?.querySelector('.fis-wish').textContent;
    paint?.querySelector('.fis-wish').click();
    await tick();
    const removed = !state.wishlist.some((e) => e && e.id === 'sku-501');
    // An upgrade: From → To, priced from the ship you pick.
    box.value = 'freelancer';
    box.dispatchEvent(new Event('input'));
    await tick();
    const up = [...document.querySelectorAll('.fis-hits li')].find((li) =>
      li.querySelector('.fis-from'),
    );
    const upOff = up ? up.querySelector('.fis-wish').disabled : null;
    const sel = up && up.querySelector('.fis-from');
    if (sel) {
      sel.value =
        [...sel.options].find((o) => /^Aurora M/.test(o.value))?.value || sel.options[1].value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await tick();
    const up2 = [...document.querySelectorAll('.fis-hits li')].find((li) =>
      li.querySelector('.fis-from'),
    );
    const upgrade = {
      off: upOff,
      on: up2 ? !up2.querySelector('.fis-wish').disabled : false,
      price: up2 ? /\$\d+/.test(up2.querySelector('.find-price').textContent) : false,
    };
    box.value = 'zzzz';
    box.dispatchEvent(new Event('input'));
    await tick();
    const none = /Nothing by that name/.test(document.querySelector('.find-ship').textContent);
    box.value = 'carrack';
    box.dispatchEvent(new Event('input'));
    await tick();
    // Bubbling, as a real key press does (Svelte listens at the root).
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick(300);
    const modal = document.querySelector('#item-modal');
    const opened =
      !modal.hidden && /Carrack/.test(modal.querySelector('.modal-name')?.textContent || '');
    document.querySelector('#modal-close').click();
    box.value = '';
    box.dispatchEvent(new Event('input'));
    await tick();
    const link = document.querySelector('#full-store a');
    return {
      placeholder,
      oneLetter,
      hits,
      kinds,
      added,
      pressed,
      removed,
      upgrade,
      none,
      opened,
      href: link && link.href,
      target: link && link.target,
      label: link && link.textContent,
      line: /The full store lives on openhangar\.space/.test(
        document.querySelector('#full-store')?.textContent || '',
      ),
      gone: !document.querySelector('#price-table, [data-price-tab], #price-search'),
    };
  });
  /^Search \d+ items…$/.test(fs1.placeholder) &&
  fs1.oneLetter === 0 &&
  fs1.hits.length > 0 &&
  fs1.hits.length <= 8 &&
  fs1.hits.every((h) => /cutlass/i.test(h)) &&
  ['Ship', 'Paint', 'Gear'].every((k) => fs1.kinds.includes(k)) &&
  fs1.added &&
  fs1.pressed === 'On Your Wishlist' &&
  fs1.removed &&
  fs1.upgrade.off === true &&
  fs1.upgrade.on &&
  fs1.upgrade.price &&
  fs1.none &&
  fs1.opened &&
  fs1.href === 'https://openhangar.space/store' &&
  fs1.target === '_blank' &&
  fs1.label === 'Open the Full Store ↗' &&
  fs1.line &&
  fs1.gone
    ? ok(
        `store: full store link, Find in Store (${fs1.hits.length} for "cutlass", ships and store items, Add to Wishlist, an upgrade From → To, Enter opens a ship), no price list`,
      )
    : fail(`store slim page: ${JSON.stringify(fs1)}`);
  // Your Subscriber Store (#418): the demo account is a subscriber; its listing is
  // an invented one (demo-shim.js), read through the real OH.getSubStore.
  await page
    .waitForFunction(() => document.querySelectorAll('#sub-grid .sub-card').length > 0, {
      timeout: 10000,
    })
    .catch(() => {});
  const sub = await page.evaluate(async () => {
    const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));
    const root = document.querySelector('#sub-store');
    const cards = () => [...root.querySelectorAll('.sub-card')];
    const card = (name) => cards().find((c) => c.querySelector('.sub-name').textContent === name);
    const helmet = card('Quasar Explorer Helmet');
    const plush = card('Tiny Hangar Plushie');
    const jacket = card('Starlight Flight Jacket');
    const res = {
      head: root.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim(),
      meta: root.querySelector('#sub-meta')?.textContent.replace(/\s+/g, ' ').trim(),
      n: cards().length,
      buy: helmet?.querySelector('.sub-buy')?.href,
      buyLabel: helmet?.querySelector('.sub-buy')?.textContent,
      price: helmet?.querySelector('.sub-price')?.textContent.replace(/\s+/g, ' ').trim(),
      warbond: helmet?.querySelector('.sub-chip.wb')?.textContent,
      tier: jacket?.querySelector('.sub-chip.tier')?.textContent,
      noTier: !helmet?.querySelector('.sub-chip.tier'),
      soldOut: plush?.querySelector('.sub-out')?.textContent,
      plushBuy: !!plush?.querySelector('.sub-buy'),
      lazy: [...root.querySelectorAll('img')].every((i) => i.loading === 'lazy'),
      note: /What RSI shows your account today\./.test(root.textContent),
      chips: [...root.querySelectorAll('.sub-kinds .chip')].map((c) =>
        c.firstChild.textContent.trim(),
      ),
    };
    // Every card in a row lines up: name and price/Buy row at the same height,
    // whether the name takes one line or two.
    const rows = new Map();
    for (const c of cards()) {
      const top = Math.round(c.getBoundingClientRect().top);
      const y = (sel) => Math.round(c.querySelector(sel).getBoundingClientRect().top);
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push([y('.sub-name'), y('.sub-foot')]);
    }
    res.aligned =
      [...rows.values()].some((r) => r.length > 1) &&
      [...rows.values()].every((r) => r.every(([n, f]) => n === r[0][0] && f === r[0][1]));
    const long = card("Kastak Arms Inquisitor 'Star Kitten' Armor Set");
    res.longTitle = long?.querySelector('.sub-name').title;
    res.longKind = long?.querySelector('.sub-kind').textContent;
    res.kitKind = card('Star Kitten Kit')?.querySelector('.sub-kind').textContent;
    const box = root.querySelector('#sub-search');
    box.value = 'helmet';
    box.dispatchEvent(new Event('input'));
    await tick();
    res.search = cards().length;
    box.value = '';
    box.dispatchEvent(new Event('input'));
    await tick();
    [...root.querySelectorAll('.sub-kinds .chip')]
      .find((c) => /^Paints/.test(c.textContent))
      ?.click();
    await tick();
    res.paints = cards().map((c) => c.querySelector('.sub-name').textContent);
    root.querySelector('.sub-kinds .chip').click(); // All
    await tick();
    // Not a subscriber: no list, a pointer to the plans.
    const s = OHApp.store.sub;
    const acct = s.account;
    s.account = { ...acct, subscriber: null };
    document.dispatchEvent(new Event('oh:home'));
    await tick();
    const plans = root.querySelector('.sub-plans a');
    res.plans = plans && plans.href;
    res.plansText = root.querySelector('.sub-plans')?.textContent.replace(/\s+/g, ' ').trim();
    res.plansCards = cards().length;
    s.account = acct;
    document.dispatchEvent(new Event('oh:home'));
    await tick();
    return res;
  });
  sub.head === 'Your Subscriber Store 6' &&
  sub.meta === '6 items, refreshed today' &&
  sub.n === 6 &&
  sub.aligned &&
  sub.longTitle === "Kastak Arms Inquisitor 'Star Kitten' Armor Set" &&
  sub.longKind === 'Armor' &&
  sub.kitKind === 'Kits and Bundles' &&
  /^https:\/\/robertsspaceindustries\.com\/en\/pledge\/Subscribers-Store\/Demo-2$/.test(sub.buy) &&
  sub.buyLabel === 'Buy at RSI ↗' &&
  /^\$9\.00 \$12\.00$/.test(sub.price) &&
  sub.warbond === 'Warbond' &&
  sub.tier === 'Centurion' &&
  sub.noTier &&
  sub.soldOut === 'Sold Out' &&
  !sub.plushBuy &&
  sub.lazy &&
  sub.note &&
  sub.chips.join() === 'All,Paints,Armor,Clothing,Flair,Kits and Bundles' &&
  sub.search === 1 &&
  sub.paints.join() === 'Nebula Drift Paint' &&
  sub.plans === 'https://robertsspaceindustries.com/en/pledge/subscriptions' &&
  sub.plansText === 'Subscribers get their own store each month. See Plans ↗' &&
  sub.plansCards === 0
    ? ok(
        'subscriber store: 6 cards lined up, Warbond and tier chips, Sold Out, search, type chips, See Plans',
      )
    : fail(`subscriber store: ${JSON.stringify(sub)}`);
  const st = await page.evaluate(async () => {
    // The Store is Svelte (ui/store): it redraws a tick after a change.
    const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
    const ccus = document.querySelectorAll('#ccu-owned tbody tr').length;
    // "In store now" comes from the store catalog (demo-shim.js): Cutlass Black
    // sold on its own, the Carrack not for sale.
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
    await tick();
    const packRow = [...document.querySelectorAll('#wishlist tbody tr')].find((r) =>
      /^Carrack/.test(r.textContent.trim()),
    );
    const packSummary = packRow ? packRow.textContent : '';
    state.buybacks.pop();
    delete state.bbDetails['999001'];
    renderStore();
    await new Promise((r) => setTimeout(r, 300));
    const stock = [...document.querySelectorAll('#wishlist .sale')].map((e) => e.textContent);
    document.querySelector('#wishlist .wish-open')?.click();
    await tick();
    const sub = document.querySelector('.wish-bbs');
    const res = {
      ccus,
      stock,
      bbRows: sub && !sub.hidden ? sub.querySelectorAll('table.inner > tbody > tr').length : 0,
      bbTypes: sub ? [...sub.querySelectorAll('tbody .badge')].map((b) => b.textContent) : [],
      pack: /1 pack/.test(packSummary) && !/buy-back|to it/.test(packSummary),
      reclaim: sub ? /Reclaim/.test(sub.textContent) : false,
      panels: document.querySelectorAll('#view-store .store-panel').length,
      ccugame: /ccugame/i.test(document.querySelector('#view-store').textContent),
    };
    state.wishlist = [];
    renderStore();
    return res;
  });
  st.panels === 4 && !st.ccugame
    ? ok('store panels: Wishlist, Your Subscriber Store, Your CCUs, Find in Store')
    : fail(`store page: ${JSON.stringify(st)}`);
  st.stock.join('|') === 'Not in store|In stock ($110)' &&
  st.ccus > 0 &&
  st.bbRows > 0 &&
  st.reclaim &&
  st.bbTypes.length === st.bbRows &&
  st.pack &&
  st.bbTypes.join() === [...st.bbTypes].sort((a, b) => (a === 'CCU') - (b === 'CCU')).join()
    ? ok(
        `wishlist stock from the store catalog (${st.stock.join(', ')}), buy-backs (${st.bbTypes.join(', ')})`,
      )
    : fail(`store details: ${JSON.stringify(st)}`);

  const ws = await page.evaluate(async () => {
    state.wishlist = ['Pioneer', 'Cutlass Black', 'Carrack'];
    const order = () =>
      [...document.querySelectorAll('#wishlist .wishlist > tbody > tr:not(.wish-bbs)')].map(
        (r) => r.querySelector('.ship-link').textContent,
      );
    const pick = async (v) => {
      const sel = document.querySelector('#wish-sort');
      sel.value = v;
      sel.dispatchEvent(new Event('change', { bubbles: true })); // as a real pick does
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
    OHApp.store.setWishOrder(['Carrack', 'Pioneer', 'Cutlass Black']);
    await new Promise((r) => setTimeout(r, 50));
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

  // No CCU search for a handful of CCUs.
  const ccuHidden = await page.evaluate(() => document.querySelector('#ccu-search').hidden);
  ccuHidden ? ok('CCU search hidden for a few CCUs') : fail('CCU search shown for a few CCUs');

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
    // No update API in the demo = Firefox, which reads openhangar.space/versions.json.
    const realFetch = window.fetch;
    const amo = (v) => async (u) => {
      if (u !== 'https://openhangar.space/versions.json') throw new Error(`asked ${u}`);
      return Response.json({ stores: { firefox: { live: v } } });
    };
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
  /9\.9\.9 is out.*\| You['’]re on the latest version/.test(chk.firefox) &&
  /9\.9\.9 is downloading/.test(chk.chrome1)
    ? ok('Check for updates: store check (Chrome) and versions.json check (Firefox)')
    : fail(`check for updates: ${JSON.stringify(chk)}`);
  const md = await page.evaluate(() => ({
    // Release notes are Svelte nodes, never markup strings: no stray ** or `.
    raw: [...document.querySelectorAll('#updates-body li, #updates-body p')].filter((e) =>
      /\*\*|`/.test(e.textContent),
    ).length,
    links: document.querySelectorAll('#updates-body .release a[target="_blank"]').length,
  }));
  !md.raw
    ? ok(`release notes markdown drawn (${md.links} links)`)
    : fail(`release notes markdown: ${JSON.stringify(md)}`);

  console.log('Known Issues');
  const ki = await page.evaluate(async () => {
    const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
    const body = () => document.querySelector('#issues-body');
    const open = async () => {
      location.hash = '#home';
      await wait(100);
      location.hash = '#issues';
      await wait();
    };
    // From the hour-long cache of openhangar.space's feed: no request.
    await chrome.storage.local.set({
      feedIssues: {
        at: Date.now(),
        data: {
          v: 1,
          issues: [
            {
              number: 7,
              title: 'Test bug <b>not bold</b>',
              url: 'https://github.com/Draco-Foundry/open-hangar/issues/7',
              createdAt: new Date().toISOString(),
              labels: ['bug', 'scan-broken'],
            },
            {
              number: 8,
              title: 'Older bug',
              url: 'https://github.com/Draco-Foundry/open-hangar/issues/8',
              createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
              labels: ['bug'],
            },
          ],
        },
      },
    });
    await open();
    const rows = [...body().querySelectorAll('.known-issues li')].map((li) =>
      li.textContent.replace(/\s+/g, ' ').trim(),
    );
    const bold = !!body().querySelector('.known-issues b');
    // Never loaded and the site busy (503): the fallback link, no error.
    const realFetch = window.fetch;
    window.fetch = async () => new Response('', { status: 503, headers: { 'retry-after': '300' } });
    await chrome.storage.local.remove('feedIssues');
    await open();
    const err = body().textContent.replace(/\s+/g, ' ').trim();
    // An empty list (fresh from the feed).
    window.fetch = async () => Response.json({ v: 1, issues: [] });
    await chrome.storage.local.remove('feedIssues');
    await open();
    const empty = body().textContent.trim();
    window.fetch = realFetch;
    await chrome.storage.local.remove('feedIssues');
    return { rows, bold, err, empty };
  });
  ki.rows.length === 2 &&
  /^Test bug <b>not bold<\/b> #7 · opened today · Scan broken$/.test(ki.rows[0]) &&
  /^Older bug #8 · opened 3 days ago$/.test(ki.rows[1]) &&
  !ki.bold &&
  /^The bug list is still in transit\. See it on GitHub for now\.$/.test(ki.err) &&
  /^No known bugs right now/.test(ki.empty)
    ? ok('Known Issues: cached list, Scan broken tag, offline fallback, empty list')
    : fail(`known issues: ${JSON.stringify(ki)}`);

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

  // Card pictures offer two sizes (store_small + slideshow) so the browser picks
  // one sharp image and never swaps (#179); markup survives the sanitizer.
  // The cards are Svelte (ui/lib/Thumb.svelte); Inventory is hidden here, so the
  // lazy picture isn't fetched while we look.
  const sizes = await page.evaluate(async () => {
    const url = 'https://media.robertsspaceindustries.com/abc123/store_small.jpg';
    const p = state.items.find((x) => !x.isCCU);
    const keep = { image: p.image, layout: state.layout };
    p.image = url;
    state.layout = 'gallery';
    renderInventory();
    await new Promise((r) => setTimeout(r, 60));
    const im = document.querySelector(`#results .card[data-id="${p.id}"] img.thumb`);
    const got = { srcset: im?.getAttribute('srcset'), sizes: im?.getAttribute('sizes') };
    p.image = keep.image;
    state.layout = keep.layout;
    renderInventory();
    return {
      ...got,
      folder: srcsetFor('https://robertsspaceindustries.com/media/abc/store_small/a.jpg'),
      other: srcsetFor('https://robertsspaceindustries.com/media/abc/store_hub_small/a.jpg'),
    };
  });
  sizes.srcset ===
    'https://media.robertsspaceindustries.com/abc123/store_small.jpg 351w, https://media.robertsspaceindustries.com/abc123/slideshow.jpg 648w' &&
  sizes.sizes === 'auto, 220px' &&
  /\/slideshow\/a\.jpg 648w$/.test(sizes.folder) &&
  sizes.other === ''
    ? ok('card pictures: two sizes in both RSI URL shapes, others untouched')
    : fail(`card picture sizes: ${JSON.stringify(sizes)}`);

  console.log('Developers');
  // Developers is the Svelte page in ui/developers; its data tools call
  // window.OHApp.dev. Svelte redraws a microtask later, so wait a tick after actions.
  await go('#developers');
  const prof = await page.$$eval('#profiles .profile-row', (r) => r.map((e) => e.textContent));
  prof.length && /signed in/.test(prof[0])
    ? ok(`${prof.length} saved account(s) listed`)
    : fail('saved accounts list empty');
  const devUi = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 150));
    const q = (s) => document.querySelector(s);
    const files = [];
    window.downloadBlob = (blob, name) => files.push([blob.type, name]);
    const out = {
      links: document.querySelectorAll('#dev-links a').length,
      restoreHidden: q('#restore-db').hidden,
      supporters: q('#sup-contributors').textContent.trim(),
      boosters: q('#sup-boosters a')?.textContent,
      storage: q('#storage-use')?.textContent.trim(),
    };
    q('#export-db').click();
    await tick();
    out.json = q('#data-msg').textContent;
    q('#export-htf').click();
    await tick();
    out.htf = q('#data-msg').textContent;
    // The import picker opens from Import JSON and from the damaged-database notice.
    const input = q('#import-file');
    let opened = 0;
    input.click = () => opened++;
    q('#import-db').click();
    q('#db-restore').click();
    out.opened = opened;
    delete input.click;
    // A file that isn't JSON: an error note, nothing replaced.
    const realConfirm = window.confirm;
    window.confirm = () => true; // "Importing replaces your current data. Continue?"
    const dt = new DataTransfer();
    dt.items.add(new File(['not json'], 'x.json', { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    window.confirm = realConfirm;
    out.bad = q('#data-msg').textContent;
    out.badRed = q('#data-msg').classList.contains('error');
    out.items = state.items.length;
    q('#report-preview').open = true;
    await tick();
    await tick();
    out.report = q('#report-text').textContent.length;
    q('#clear-log').click();
    await tick();
    out.cleared = q('#report-msg').textContent;
    out.files = files.map((f) => f[1]);
    return out;
  });
  devUi.links === 5 && devUi.restoreHidden && /Be the first/.test(devUi.supporters)
    ? ok('quick links, supporters placeholder; Restore Previous Hangar hidden with no snapshot')
    : fail(`developers page: ${JSON.stringify(devUi)}`);
  /^Exported \d+ item\(s\) and \d+ history snapshot/.test(devUi.json) &&
  /Hangar Transfer Format/.test(devUi.htf) &&
  devUi.files.length === 2 &&
  /^open-hangar-.*\.json$/.test(devUi.files[0]) &&
  /^open-hangar-htf-/.test(devUi.files[1])
    ? ok(`Export JSON and Export HTF download and say so ("${devUi.json}")`)
    : fail(`developers exports: ${JSON.stringify(devUi)}`);
  devUi.opened === 2 && /valid JSON/.test(devUi.bad) && devUi.badRed && devUi.items > 0
    ? ok('Import JSON and the damaged-data notice open the picker; a bad file shows an error')
    : fail(`developers import: ${JSON.stringify(devUi)}`);
  /^Storage Used: [\d.]+ (MB|KB|B)$/.test(devUi.storage)
    ? ok(`storage total under the data tools ("${devUi.storage}")`)
    : fail(`developers storage line: ${JSON.stringify(devUi.storage)}`);
  devUi.report > 50 && devUi.cleared === 'Log cleared.'
    ? ok('error report preview fills when opened; Clear Log says so')
    : fail(`developers error report: ${JSON.stringify(devUi)}`);
  // The card menus' Backup item clicks #export-db, so it must work while Developers
  // is hidden (here from Inventory).
  await go('#inventory');
  const menuBackup = await page.evaluate(async () => {
    const files = [];
    window.downloadBlob = (blob, name) => files.push(name);
    document.querySelector('#export-db').click();
    await new Promise((r) => setTimeout(r, 300));
    return { files, msg: document.querySelector('#data-msg').textContent };
  });
  menuBackup.files.length === 1 && /^Exported/.test(menuBackup.msg)
    ? ok('#export-db downloads the backup from another page (the card menus use it)')
    : fail(`backup from another page: ${JSON.stringify(menuBackup)}`);

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
  // People list (Svelte): tabs swap the list and clear the search, search filters
  // live, sort reorders.
  const people = await page.evaluate(async () => {
    const wait = () => new Promise((r) => setTimeout(r, 50));
    const rows = () => [...document.querySelectorAll('#ref-tbody tr')];
    const count = () => document.querySelector('#ref-count').textContent;
    const search = document.querySelector('#ref-search');
    const out = { recruits: rows().length, count: count() };
    const first = rows()[0]?.querySelector('td').textContent.trim() || '';
    search.value = first;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    out.searched = rows().length;
    document.querySelector('[data-reftab="prospects"]').click();
    await wait();
    out.prospects = rows().length;
    out.cleared = search.value === '';
    out.dateCol = document.querySelector('#ref-date-col').textContent;
    const sort = document.querySelector('#ref-sort');
    sort.value = 'name';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    const names = rows().map((r) => r.querySelector('td').textContent.trim());
    out.sorted = names.every((n, i) => !i || names[i - 1].localeCompare(n) <= 0);
    document.querySelector('[data-reftab="recruits"]').click();
    sort.value = 'newest';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    return out;
  });
  people.recruits > 1 &&
  /^Showing \d+ of \d+$/.test(people.count) &&
  people.searched >= 1 &&
  people.searched < people.recruits &&
  people.prospects > 0 &&
  people.cleared &&
  people.dateCol === 'Enlisted' &&
  people.sorted
    ? ok(`people list: tabs, search (${people.searched} of ${people.recruits}), sort by name`)
    : fail(`people list: ${JSON.stringify(people)}`);
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

  console.log('Add to RSI Cart');
  // RSI's upgrade calls are stubbed (no real RSI): the ship window's picker, the
  // add, the error notes, and the buy-back window's one button (#288).
  const cart = await page.evaluate(async () => {
    const wait = async (test, ms = 2000) => {
      for (let t = 0; t < ms; t += 25) {
        if (test()) return true;
        await new Promise((r) => setTimeout(r, 25));
      }
      return false;
    };
    const calls = [];
    const real = {
      upgradeOptions: OH.upgradeOptions,
      upgradePrice: OH.upgradePrice,
      addUpgradeToCart: OH.addUpgradeToCart,
    };
    let optionsAnswer = {
      ok: true,
      options: [
        { id: 102, name: 'Avenger Titan', image: null, eligible: true, price: 140 },
        { id: 101, name: 'Pulse', image: null, eligible: true, price: null },
        { id: 103, name: 'Cutlass Black', image: null, eligible: false, price: null },
      ],
    };
    let addAnswer = { ok: true };
    OH.upgradeOptions = async (...a) => (calls.push(['options', ...a]), optionsAnswer);
    OH.upgradePrice = async (...a) => (calls.push(['price', ...a]), { ok: true, price: 15 });
    OH.addUpgradeToCart = async (...a) => (calls.push(['add', ...a]), addAnswer);
    // RSI's store feed says an upgrade to the Carrack is on sale (SKU 9001).
    const carrack = {
      id: 900,
      name: 'Carrack',
      lname: 'carrack',
      link: null,
      forSale: true,
      editions: [{ id: 9001, title: 'Standard Edition', price: 600, warbond: false }],
    };
    const was = { storeRequested, storeData, storeByKey };
    storeRequested = Promise.resolve();
    storeData = { at: Date.now(), ships: [carrack] };
    storeByKey = new Map([
      [shipKey('Carrack'), carrack],
      ['carrack', carrack],
    ]);
    const q = (sel) => document.querySelector(`#item-modal ${sel}`);
    const text = (sel) => (q(sel) ? q(sel).textContent.replace(/\s+/g, ' ').trim() : '');
    const out = {};
    openShipModal('Carrack');
    await wait(() => q('[data-cart="upgrade"]'));
    out.heading = text('[data-cart="upgrade"] .modal-h');
    out.quietUntilClick = calls.length === 0;
    q('[data-cart="upgrade"] .cbtn').click();
    await wait(() => q('[data-cart] .opt'));
    out.rows = [...document.querySelectorAll('#item-modal [data-cart] .opt')].map((o) =>
      o.textContent.replace(/\s+/g, ' ').trim(),
    );
    out.sum = text('[data-cart] .sum');
    q('[data-cart] .opt:nth-child(2)').click();
    await wait(() => /\$15/.test(text('[data-cart] .sum')));
    out.sumAfterPick = text('[data-cart] .sum');
    const addBtn = [...document.querySelectorAll('#item-modal [data-cart] button.cbtn')].pop();
    out.addLabel = addBtn.textContent.trim();
    addBtn.click();
    await wait(() => q('[data-cart] .note.good'));
    out.added = text('[data-cart] .note.good');
    out.cartLink = q('[data-cart] a.cbtn')?.getAttribute('href') || '';
    out.addCall = calls.find((c) => c[0] === 'add');
    document.querySelector('#modal-close').click();

    // Signed out of RSI: the note and the way to log in.
    optionsAnswer = { ok: false, error: 'signed-out' };
    openShipModal('Carrack');
    await wait(() => q('[data-cart="upgrade"]'));
    q('[data-cart="upgrade"] .cbtn').click();
    await wait(() => q('[data-cart] .note.bad'));
    out.signedOut = text('[data-cart] .note.bad');
    out.logIn = q('[data-cart] a.cbtn')?.textContent.trim() || '';
    document.querySelector('#modal-close').click();

    // RSI says no to the add.
    optionsAnswer = { ok: true, options: [{ id: 101, name: 'Pulse', eligible: true, price: 100 }] };
    addAnswer = { ok: false, error: 'refused' };
    openShipModal('Carrack');
    await wait(() => q('[data-cart="upgrade"]'));
    q('[data-cart="upgrade"] .cbtn').click();
    await wait(() => q('[data-cart] .opt'));
    [...document.querySelectorAll('#item-modal [data-cart] button.cbtn')].pop().click();
    await wait(() => q('[data-cart] .note.bad'));
    out.refused = text('[data-cart] .note.bad');
    out.addsAfterRefusal = calls.filter((c) => c[0] === 'add').length;
    document.querySelector('#modal-close').click();

    // Any Ship: a From ship you don't own, found by name, priced on pick, added.
    const fleet = Array.from({ length: 34 }, (_, i) => ({
      id: 500 + i,
      name: `Test Hull ${String(i + 1).padStart(2, '0')}`,
      image: null,
      msrp: 100 + i,
      price: null,
    }));
    optionsAnswer = {
      ok: true,
      options: [{ id: 103, name: 'Cutlass Black', image: null, eligible: false, price: null }],
      others: [{ id: 777, name: 'Gladius', image: null, msrp: 90, price: null }, ...fleet],
    };
    addAnswer = { ok: true };
    openShipModal('Carrack');
    await wait(() => q('[data-cart="upgrade"]'));
    q('[data-cart="upgrade"] .cbtn').click();
    await wait(() => q('[data-cart] [data-any] .opt'));
    out.anyHeading = text('[data-any] .any-h');
    out.anyNone = text('[data-cart] .cart-intro');
    out.anyRows = document.querySelectorAll('#item-modal [data-any] .opt').length;
    out.anyCount = text('[data-any] .any-count');
    out.anyAddBefore = !q('[data-cart] .sum');
    const search = q('[data-any] .any-q');
    search.value = 'glad';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(() => document.querySelectorAll('#item-modal [data-any] .opt').length === 1);
    out.anySearched = [...document.querySelectorAll('#item-modal [data-any] .opt')].map((o) =>
      o.textContent.replace(/\s+/g, ' ').trim(),
    );
    q('[data-any] .opt').click();
    await wait(() => /\$15/.test(text('[data-cart] .sum')));
    out.anySum = text('[data-cart] .sum');
    out.anyPriceCall = calls.filter((c) => c[0] === 'price').pop();
    [...document.querySelectorAll('#item-modal [data-cart] button.cbtn')].pop().click();
    await wait(() => q('[data-cart] .note.good'));
    out.anyAdded = text('[data-cart] .note.good');
    out.anyAddCall = calls.filter((c) => c[0] === 'add').pop();
    document.querySelector('#modal-close').click();

    // RSI's cart already holds a buy-back (or this is one and the cart isn't empty).
    optionsAnswer = { ok: true, options: [{ id: 101, name: 'Pulse', eligible: true, price: 100 }] };
    addAnswer = { ok: false, error: 'cart-conflict' };
    openShipModal('Carrack');
    await wait(() => q('[data-cart="upgrade"]'));
    q('[data-cart="upgrade"] .cbtn').click();
    await wait(() => q('[data-cart] .opt'));
    [...document.querySelectorAll('#item-modal [data-cart] button.cbtn')].pop().click();
    await wait(() => q('[data-cart] .note.bad'));
    out.busy = text('[data-cart] .note.bad');
    out.busyLink = q('[data-cart] a.cbtn')?.textContent.trim() || '';
    document.querySelector('#modal-close').click();

    // A buy-back upgrade: its ids from the buy-back button, RSI's price, one click.
    addAnswer = { ok: true };
    const b = {
      id: '8899',
      name: 'Upgrade - Pulse to Carrack',
      date: '2026-08-26',
      contains: '',
      href: '',
      price: '',
      isCCU: true,
      ccu: { from: 'Pulse', to: 'Carrack' },
      wasUpgraded: false,
      fromShipId: '101',
      toShipId: '900',
      toSkuId: '9001',
      kind: 'ccu',
      image: null,
    };
    const tokensWas = state.bbTokens;
    state.bbTokens = 0;
    openBuybackModal(b);
    await wait(() => /\$15/.test(text('[data-cart="buyback"]')));
    out.bbRows = text('[data-cart="buyback"]');
    state.bbTokens = tokensWas;
    q('[data-cart="buyback"] button.cbtn').click();
    await wait(() => q('[data-cart="buyback"] .note.good'));
    out.bbAdded = text('[data-cart="buyback"] .note.good');
    out.bbCall = calls.filter((c) => c[0] === 'add').pop();
    out.bbId = b.id;
    document.querySelector('#modal-close').click();
    // A buy-back upgrade RSI won't sell any more (ship values changed).
    addAnswer = { ok: false, error: 'refused', reason: 'invalid' };
    openBuybackModal(b);
    await wait(() => /\$15/.test(text('[data-cart="buyback"]')));
    q('[data-cart="buyback"] button.cbtn').click();
    await wait(() => q('[data-cart="buyback"] .note.bad'));
    out.bbInvalid = text('[data-cart="buyback"] .note.bad');
    addAnswer = { ok: true };
    document.querySelector('#modal-close').click();
    // Without the ids (older scans): no button.
    openBuybackModal({ ...b, toSkuId: '' });
    await new Promise((r) => setTimeout(r, 100));
    out.bbNoIds = !q('[data-cart]');
    document.querySelector('#modal-close').click();
    const old = state.buybacks.find((x) => x.isCCU && x.ccu && OH.retiredBuyback(x));
    // A retired ship's buy-back: RSI still sells it back, so the button stays; only
    // RSI's refusal says it closed (#306).
    addAnswer = { ok: false, error: 'refused' };
    openBuybackModal({ ...old, fromShipId: '101', toShipId: '900', toSkuId: '9001' });
    await wait(() => /\$15/.test(text('[data-cart="buyback"]')));
    out.bbRetiredBefore = text('[data-cart="buyback"]');
    q('[data-cart="buyback"] button.cbtn').click();
    await wait(() => q('[data-cart="buyback"] .note.bad'));
    out.bbRetired = !!old && text('[data-cart="buyback"] .note.bad');
    addAnswer = { ok: true };
    document.querySelector('#modal-close').click();
    Object.assign(OH, real);
    ({ storeRequested, storeData, storeByKey } = was);
    return out;
  });
  cart.heading === 'Upgrade From Your Ships' && cart.quietUntilClick
    ? ok('ship window: Upgrade From Your Ships, nothing asked of RSI until the click')
    : fail(`cart heading: ${JSON.stringify(cart)}`);
  cart.rows.length === 3 &&
  /Avenger Titan\s*\$140/.test(cart.rows[0]) &&
  /Cutlass Black.*RSI isn't selling this upgrade right now/.test(cart.rows[2]) &&
  /Avenger Titan to Carrack\s*\$140/.test(cart.sum) &&
  /Pulse to Carrack\s*\$15/.test(cart.sumAfterPick)
    ? ok('cart picker: your ships with RSI prices, greyed one, price on pick')
    : fail(`cart picker: ${JSON.stringify(cart)}`);
  cart.addLabel === 'Add to RSI Cart' &&
  /In Your RSI Cart\s*Pulse to Carrack, \$15\..*A buy-back can't share this cart/.test(
    cart.added,
  ) &&
  cart.cartLink === 'https://robertsspaceindustries.com/en/store/pledge/cart' &&
  JSON.stringify(cart.addCall) === JSON.stringify(['add', 101, 900, 9001, {}])
    ? ok('Add to RSI Cart: one call with the right ships, In Your RSI Cart, Open RSI Cart')
    : fail(`cart add: ${JSON.stringify(cart)}`);
  /Sign In to RSI First/.test(cart.signedOut) && cart.logIn === 'Log In to RSI ↗'
    ? ok('cart signed out: Sign In to RSI First with Log In to RSI')
    : fail(`cart signed out: ${JSON.stringify(cart)}`);
  /RSI Didn't Add It.*Nothing was added/.test(cart.refused) && cart.addsAfterRefusal === 2
    ? ok("cart refused: RSI Didn't Add It, and no second try by itself")
    : fail(`cart refused: ${JSON.stringify(cart)}`);
  cart.anyHeading === 'Any Ship' &&
  /Any ship below works too/.test(cart.anyNone) &&
  cart.anyRows === 30 &&
  /Showing 30 of 35 ships/.test(cart.anyCount) &&
  cart.anyAddBefore &&
  cart.anySearched.length === 1 &&
  /Gladius/.test(cart.anySearched[0]) &&
  /Gladius to Carrack\s*\$15/.test(cart.anySum) &&
  JSON.stringify(cart.anyPriceCall) ===
    JSON.stringify(['price', 777, 9001, { toShipId: 900, setContext: true }]) &&
  /Gladius to Carrack, \$15/.test(cart.anyAdded) &&
  JSON.stringify(cart.anyAddCall) === JSON.stringify(['add', 777, 900, 9001, {}])
    ? ok('Any Ship: 30 of 35 shown, search finds one, priced on pick, added from a ship not owned')
    : fail(`any ship: ${JSON.stringify(cart)}`);
  /Cart Already Busy.*buy-back on its own/.test(cart.busy) && cart.busyLink === 'Open RSI Cart ↗'
    ? ok('cart busy: Cart Already Busy with Open RSI Cart')
    : fail(`cart busy: ${JSON.stringify(cart)}`);
  /Buy-Back Price\s*\$15 from RSI just now/.test(cart.bbRows) &&
  /No Buy-Back Token right now: pay with cash, or wait for the next one \(\w{3} \d+\)\./.test(
    cart.bbRows,
  ) &&
  /Buy-backs check out alone: one per cart, nothing else in it\./.test(cart.bbRows) &&
  /Buy-back: Pulse to Carrack, \$15\. Check it out before you add anything else\./.test(
    cart.bbAdded,
  ) &&
  JSON.stringify(cart.bbCall) ===
    JSON.stringify(['add', 101, 900, 9001, { pledgeId: Number(cart.bbId) }]) &&
  /RSI Didn't Add It\s*RSI won't sell this buy-back upgrade any more \(ship values changed\)\./.test(
    cart.bbInvalid,
  ) &&
  cart.bbNoIds &&
  /RSI No Longer Sells This One Back\s*It's retired and RSI closed its buy-back\./.test(
    cart.bbRetired,
  ) &&
  /Add to RSI Cart/.test(cart.bbRetiredBefore) &&
  !/No Longer Sells/.test(cart.bbRetiredBefore)
    ? ok(
        'buy-back upgrade: RSI price, Add to RSI Cart with its pledge; none without ids; retired keeps it',
      )
    : fail(`buy-back cart: ${JSON.stringify(cart)}`);

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
    const tick = () => new Promise((r) => setTimeout(r, 50));
    document.querySelector('[data-wish-remove]')?.click();
    await tick();
    const undoBar = document.querySelector('#wish-undo');
    const undoShown = !undoBar.hidden && /Removed Carrack/.test(undoBar.textContent);
    undoBar.querySelector('[data-wish-undo]').click();
    await tick();
    const restored =
      state.wishlist.length === 1 &&
      undoBar.hidden &&
      /Carrack/.test(document.querySelector('#wishlist').textContent);
    document.querySelector('[data-wish-remove]')?.click();
    await tick();
    const cleared = !state.wishlist.length && undoShown && restored;
    setStatsTab('spending');
    location.hash = '#stats';
    await new Promise((r) => setTimeout(r, 400));
    const spend = document.querySelector('#stats-body').textContent;
    const bars = document.querySelectorAll('#stats-body .bar-row').length;
    location.hash = '#home';
    await new Promise((r) => setTimeout(r, 400));
    return {
      before,
      after,
      wish: /Carrack/.test(wish),
      cleared,
      spend: /pledged in total/.test(spend),
      bars,
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

  // Top bar (ui/topbar, Svelte: it redraws a tick after a change). The page link is
  // marked; unticking a source reads "Scan Custom" (remembered) and keeps the ▾ menu
  // open; the scan's progress shows on the button and in the menu; Streamer Mode puts
  // a badge on the portrait; a waiting update puts a dot on it and a line in the menu.
  console.log('Top bar');
  await go('#inventory');
  const bar = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 50));
    const btn = document.querySelector('#scan-home');
    const label = () => btn.querySelector('.scan-label').textContent;
    const r = { active: document.querySelector('#nav a.active')?.dataset.view };
    document.querySelector('#scan-menu-btn').click();
    document.querySelector('.scan-src[value="store"]').click();
    await tick();
    r.stillOpen = !document.querySelector('#scan-menu').hidden;
    r.custom = label();
    r.saved = (await chrome.storage.local.get('scanSources')).scanSources.join(',');
    document.querySelector('[data-scan-all]').click();
    await tick();
    r.all = label();
    document.body.click();
    r.closed = document.querySelector('#scan-menu').hidden;
    scanProgress.i = 1;
    scanProgress.n = 4;
    setScanning('buy-backs… 200');
    scanDetail('Buy-backs · page 2 · 200 items');
    await tick();
    r.progress = {
      label: label(),
      fill: btn.querySelector('.scan-fill').style.width,
      title: btn.title,
      line: document.querySelector('#scan-menu-progress').textContent,
      bar: btn.classList.contains('scanning'),
    };
    scanDetail('');
    setScanning('');
    await tick();
    r.idle = label() === 'Scan All' && !btn.classList.contains('scanning');
    await OHApp.top.setStreamer(true);
    await tick();
    r.badge =
      !document.querySelector('#stream-dot').hidden &&
      /Streamer Mode is on/.test(document.querySelector('#settings-btn').title) &&
      document.querySelector('#streamer-toggle').checked;
    await OHApp.top.setStreamer(false);
    await tick();
    r.badgeOff = document.querySelector('#stream-dot').hidden;
    showUpdateBanner('99.0.0');
    await tick();
    r.update =
      !document.querySelector('#upd-dot').hidden &&
      document.querySelector('#menu-upd-text').textContent === 'Update ready: 99.0.0';
    topBar.update = null;
    homeUpdated();
    await tick();
    return r;
  });
  bar.active === 'inventory' &&
  bar.stillOpen &&
  bar.custom === 'Scan Custom' &&
  bar.saved === 'hangar,buybacks,referrals' &&
  bar.all === 'Scan All' &&
  bar.closed
    ? ok('top bar: page marked; Scan Custom once a source is unticked (remembered), Select All')
    : fail(`top bar scan menu: ${JSON.stringify(bar)}`);
  bar.progress.label === 'Scanning 2/4' &&
  bar.progress.fill === '25%' &&
  bar.progress.title === 'Buy-backs · page 2 · 200 items' &&
  bar.progress.line === 'Scanning: Buy-backs · page 2 · 200 items' &&
  bar.progress.bar &&
  bar.idle
    ? ok('top bar: Scan fills with the progress, the ▾ menu says what it is on, then Scan All')
    : fail(`top bar scan progress: ${JSON.stringify(bar)}`);
  bar.badge && bar.badgeOff && bar.update
    ? ok('top bar: Streamer Mode badge on the portrait; update dot and "Update ready" line')
    : fail(`top bar portrait: ${JSON.stringify(bar)}`);

  // Top Bar Option A, More Menu (owner, 2026-10-06; #260): Home, Inventory, Buy-Backs
  // and Store in the bar, Stats, Org Fleet and Referrals under More ▾ (shut on load;
  // More lights up and marks the page when you're on one; Escape and a click away
  // close it, focus back on More). Search is an icon that opens the field over the
  // page links on a click or /. The Game Status pill is the dot and the version. One
  // row at 1440, 1100 and 800, nothing scrolling sideways; under 900px the logo drops
  // its word and Scan All its words.
  const more = await page.evaluate(async () => {
    const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
    const $ = (sel) => document.querySelector(sel);
    const btn = $('#more-btn');
    const r = {
      links: [...document.querySelectorAll('#nav > a')].map((a) => a.textContent.trim()),
      shut: $('#more-menu').hidden && btn.getAttribute('aria-expanded') === 'false',
      notActive: !btn.classList.contains('active'),
      pill: $('#gs-pill .gs-txt').textContent.trim(),
      pillTip: $('#gs-pill').title,
    };
    btn.click();
    await tick();
    r.items = [...$('#more-menu').querySelectorAll('a')].map((a) => a.textContent.trim());
    r.open = !$('#more-menu').hidden && btn.getAttribute('aria-expanded') === 'true';
    r.focusIn = $('#more-menu').contains(document.activeElement);
    document.activeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    r.arrow = document.activeElement.textContent.trim();
    document.activeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await tick();
    r.escShut = $('#more-menu').hidden && document.activeElement === btn;
    btn.click();
    await tick();
    document.body.click();
    await tick();
    r.outsideShut = $('#more-menu').hidden;
    btn.click();
    await tick();
    [...$('#more-menu').querySelectorAll('a')].find((a) => a.dataset.view === 'referrals').click();
    await tick(400);
    r.onReferrals = location.hash === '#referrals' && $('#more-menu').hidden;
    r.moreActive = btn.classList.contains('active') && /Referrals/.test(btn.title);
    r.noBarActive = !document.querySelector('#nav > a.active');
    btn.click();
    await tick();
    r.marked = [...$('#more-menu').querySelectorAll('a[aria-current="page"]')].map((a) =>
      a.textContent.trim(),
    );
    document.body.click();
    await tick();
    // Search: shut, the field is out of sight; / opens it with focus in the box.
    const wrap = $('.tb-search');
    r.searchShut = !wrap.classList.contains('open') && $('#gsearch-top').tabIndex === -1;
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    await tick();
    r.slashOpens =
      wrap.classList.contains('open') &&
      document.activeElement === $('#gsearch-top') &&
      $('#gsearch-top').getBoundingClientRect().width > 200;
    $('#gsearch-top').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    r.escCloses =
      !wrap.classList.contains('open') && document.activeElement === $('#top-search-btn');
    $('#top-search-btn').click();
    await tick();
    r.iconOpens = wrap.classList.contains('open') && document.activeElement === $('#gsearch-top');
    document.body.click();
    $('#gsearch-top').blur();
    await tick();
    r.clickAwayCloses = !wrap.classList.contains('open');
    location.hash = '#inventory';
    await tick(300);
    return r;
  });
  more.links.join(',') === 'Home,Inventory,Buy-Backs,Store' &&
  more.shut &&
  more.notActive &&
  more.items.join(',') === 'Stats,Org Fleet,Referrals' &&
  more.open &&
  more.focusIn &&
  more.arrow === 'Org Fleet' &&
  more.escShut &&
  more.outsideShut &&
  more.onReferrals &&
  more.moreActive &&
  more.noBarActive &&
  more.marked.join(',') === 'Referrals'
    ? ok(
        'top bar: four pages in the bar, More ▾ for Stats, Org Fleet and Referrals, marks the page you are on',
      )
    : fail(`top bar More menu: ${JSON.stringify(more)}`);
  more.searchShut && more.slashOpens && more.escCloses && more.iconOpens && more.clickAwayCloses
    ? ok(
        'top bar: search icon opens the field over the links (click or /), Escape and a click away close it',
      )
    : fail(`top bar search: ${JSON.stringify(more)}`);
  /^\d+\.\d+/.test(more.pill) && /LIVE \d/.test(more.pillTip)
    ? ok(`top bar: Game Status pill is compact ("${more.pill}", LIVE on hover)`)
    : fail(`top bar pill: ${JSON.stringify(more)}`);
  const rows = {};
  for (const w of [1440, 1100, 800]) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise((r) => setTimeout(r, 250));
    rows[w] = await page.evaluate(() => {
      const h = document.querySelector('.wrap > header');
      const tops = [...h.querySelectorAll('.brand, #nav > a, #more-btn, .hdr-prefs > *')]
        .filter((el) => el.getClientRects().length)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return Math.round(r.top + r.height / 2);
        });
      const scan = document.querySelector('#scan-home');
      return {
        oneRow: Math.max(...tops) - Math.min(...tops) <= 4,
        over: document.documentElement.scrollWidth - innerWidth,
        word: getComputedStyle(h.querySelector('.brand h1')).display !== 'none',
        scanWords: getComputedStyle(scan.querySelector('.sl-word')).display !== 'none',
        scanName: scan.getAttribute('aria-label'),
      };
    });
  }
  await page.setViewport({ width: 1280, height: 900 });
  [1440, 1100, 800].every((w) => rows[w].oneRow && rows[w].over <= 0) &&
  rows[1440].word &&
  rows[1100].scanWords &&
  !rows[800].word &&
  !rows[800].scanWords &&
  rows[800].scanName === 'Scan All'
    ? ok('top bar: one row at 1440, 1100 and 800; under 900px the logo and Scan All fold to icons')
    : fail(`top bar rows: ${JSON.stringify(rows)}`);

  // Keyboard (#200): cards open with Enter and Space, the pop-up keeps and returns
  // focus, chips keep focus when they redraw, menus close on Escape.
  // Scan report (owner sign-off, 2026-10-04): a scan that ends with a problem opens a
  // report under the Scan button on any page, and Home has no line of text for it.
  // Signed out of RSI, the scan reads and saves nothing.
  console.log('Scan report');
  await go('#inventory');
  const rep = await page.evaluate(async () => {
    const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
    const keep = { acct: OH.getAccount, scan: OH.scanSource, ref: OH.getReferral };
    const panel = () => document.querySelector('#scan-report');
    const btn = document.querySelector('#scan-home');
    const r = { before: { items: state.items.length, bbs: state.buybacks.length } };
    let asked = 0;
    try {
      OH.getAccount = async () => ({ loggedIn: false, fetchedAt: Date.now() });
      OH.scanSource = async () => (asked++, { ok: true, items: [], scannedAt: Date.now() });
      OH.getReferral = async () => (asked++, { ok: false, error: 'Not signed in to RSI.' });
      await runScan({ store: false });
      await wait();
      r.out = {
        asked,
        kept: state.items.length === r.before.items && state.buybacks.length === r.before.bbs,
        open: !!panel() && !panel().hidden,
        title: panel()?.querySelector('h3')?.textContent,
        sub: panel()?.querySelector('.sr-titles p')?.textContent,
        noLog: !panel()?.querySelector('#sr-send'),
        login: !!panel()?.querySelector('a[href*="robertsspaceindustries.com/connect"]'),
        label: btn.textContent.trim(),
        homeLine: document.querySelector('#status').textContent,
      };
      panel().querySelector('.sr-x').click();
      await wait(60);
      r.closed = panel().hidden;
      btn.click();
      await wait(60);
      r.reopened = !panel().hidden;
      document.body.click();
      await wait(60);

      // A good buy-back scan reads the never-read packs by itself afterwards (owner,
      // 2026-10-06), and only those.
      {
        const keepFetch = OH.fetchBuybackDetails;
        let asked = null;
        OH.fetchBuybackDetails = async (ids) => ((asked = ids), { done: ids.length });
        OH.scanSource = async (id) =>
          id === 'buybacks'
            ? { ok: true, items: state.buybacks, scannedAt: Date.now() }
            : { ok: true, items: state.items, scannedAt: Date.now(), unchanged: true };
        OH.getReferral = async () => ({ ok: true, referral: state.referral });
        OH.getAccount = keep.acct;
        await runScan({ store: false });
        await wait(150);
        OH.fetchBuybackDetails = keepFetch;
        const want = state.buybacks
          .filter(
            (b) =>
              !b.isCCU &&
              (!state.bbDetails[b.id] || state.bbDetails[b.id].partial) &&
              /^pack(age)?$/.test(b.kind),
          )
          .map((b) => String(b.id));
        r.packs = {
          asked: asked && asked.length,
          want: want.length,
          same: !!asked && asked.every((id) => want.includes(id)),
        };
        topBar.report = null;
      }

      // A pack melted since the last hangar scan is filled from your hangar history:
      // no RSI request, "From your hangar history" in its window, and the automatic
      // read skips it. That read takes 30 packs per scan at most.
      {
        const keepFetch = OH.fetchBuybackDetails;
        const keepWinFetch = window.fetch;
        const keepBbs = state.buybacks;
        const P = '990000001';
        let asked = null;
        const rsi = [];
        try {
          OH.fetchBuybackDetails = async (ids) => ((asked = ids), { done: ids.length });
          window.fetch = (u, init) => {
            if (/\/pledge\/buyback\//.test(String(u))) rsi.push(String(u));
            return keepWinFetch(u, init);
          };
          await chrome.storage.local.set({
            pledgeArchive: {
              [P]: {
                id: P,
                name: 'Package - Smoke Starter Pack',
                value: 45,
                currency: 'USD',
                contents: [
                  { kind: 'Ship', label: 'Aurora MR', image: null },
                  { kind: 'Ship', label: 'Mustang Alpha', image: null },
                  { kind: 'Insurance', label: '6 Month Insurance', image: null },
                ],
                insurance: '6M',
                kind: 'ship',
                goneAt: Date.now(),
              },
            },
          });
          const pack = (id, name) => ({
            id,
            name,
            kind: 'package',
            date: '',
            contains: '',
            href: '',
            isCCU: false,
            ccu: null,
          });
          const list = [
            ...keepBbs,
            pack(P, 'Package - Smoke Starter Pack'),
            ...Array.from({ length: 35 }, (_, i) =>
              pack(String(990000100 + i), `Package - Smoke Pack ${i}`),
            ),
          ];
          OH.scanSource = async (id) =>
            id === 'buybacks'
              ? { ok: true, items: list, scannedAt: Date.now() }
              : { ok: true, items: state.items, scannedAt: Date.now(), unchanged: true };
          await runScan({ store: false });
          await wait(150);
          const d = state.bbDetails[P];
          openDetail({ kind: 'bb', item: state.buybacks.find((b) => String(b.id) === P) });
          await wait(150);
          r.hist = {
            src: d && d.src,
            ships: d && d.ships.length,
            price: d && d.price,
            note: document.querySelector('#bbd-source')?.textContent.trim(),
            loading: !!document.querySelector('#bbd-modal-loading'),
            asked: asked && asked.length,
            skipped: !!asked && !asked.includes(P),
          };
          document.querySelector('#modal-close')?.click();
          await wait(60);
          r.hist.rsi = rsi.length;
        } finally {
          OH.fetchBuybackDetails = keepFetch;
          window.fetch = keepWinFetch;
          state.buybacks = keepBbs;
          await OH.pruneBuybackDetails(keepBbs.map((b) => String(b.id)));
          state.bbDetails = { ...(await OH.getBuybackDetails()) };
          await chrome.storage.local.remove('pledgeArchive');
          topBar.report = null;
        }
      }

      // Part of it failed: one row per source, the failed one marked.
      OH.getAccount = keep.acct;
      OH.scanSource = async (id) =>
        id === 'hangar'
          ? { ok: true, items: state.items, scannedAt: Date.now(), unchanged: true }
          : {
              ok: false,
              error: 'RSI stopped responding at page 8, so we kept your previous scan.',
            };
      OH.getReferral = async () => ({ ok: true, referral: state.referral });
      await runScan({ store: false });
      await wait();
      r.part = {
        open: !panel().hidden,
        title: panel().querySelector('h3').textContent,
        rows: [...panel().querySelectorAll('.sr-rows li')].map(
          (li) => `${li.querySelector('.sr-src').textContent}:${li.classList.contains('bad')}`,
        ),
        actions: [...panel().querySelectorAll('.sr-btn')].map((b) =>
          b.textContent.replace(/\s+/g, ' ').trim(),
        ),
        hint: panel().querySelector('.sr-hint')?.textContent.replace(/\s+/g, ' ').trim(),
      };
      // The problem card's Send Flight Log (#315): copies the log, then opens
      // #bug-reports on Discord in a new tab, and says to paste it there.
      const keepOpen = window.open;
      const keepWrite = navigator.clipboard.writeText;
      let copiedText = '';
      const opened = [];
      window.open = (...args) => (opened.push(args), null);
      navigator.clipboard.writeText = async (t) => {
        copiedText = t;
      };
      try {
        panel().querySelector('#sr-send').click();
        await wait();
      } finally {
        window.open = keepOpen;
        navigator.clipboard.writeText = keepWrite;
      }
      r.send = {
        log: /^```\nOpen Hangar flight log/.test(copiedText),
        opened: opened.map((o) => o[0]),
        said: panel().querySelector('.sr-hint')?.textContent.trim(),
        open: !panel().hidden,
      };
    } finally {
      Object.assign(OH, { getAccount: keep.acct, scanSource: keep.scan, getReferral: keep.ref });
      topBar.report = null;
      setScanning(''); // the button's "done" moment, over now
      document.body.click();
      await wait();
    }
    r.cleared = !document.querySelector('#scan-report') && !/Rough/.test(btn.textContent);
    return r;
  });
  rep.packs &&
  (rep.packs.want === 0
    ? rep.packs.asked === null || rep.packs.asked === 0
    : rep.packs.asked === Math.min(rep.packs.want, 30) && rep.packs.same) &&
  rep.out &&
  rep.out.asked === 0 &&
  rep.out.kept &&
  rep.out.open &&
  rep.out.title === 'Hangar Doors Are Locked' &&
  /Log in, come back and hit Scan All\. Mind the elevators\.$/.test(rep.out.sub) &&
  rep.out.noLog &&
  rep.out.login &&
  /Rough Landing/.test(rep.out.label) &&
  !rep.out.homeLine
    ? ok('signed out: the scan reads nothing, keeps your hangar, and the report says to log in')
    : fail(`signed-out scan report: ${JSON.stringify(rep)}`);
  rep.hist &&
  rep.hist.src === 'history' &&
  rep.hist.ships === 2 &&
  rep.hist.price === 45 &&
  rep.hist.note === 'From your hangar history' &&
  !rep.hist.loading &&
  rep.hist.rsi === 0 &&
  rep.hist.skipped &&
  rep.hist.asked === 30
    ? ok(
        'buy-backs: a melted pack shows its contents from your hangar history, no RSI read; 30 packs per scan',
      )
    : fail(`buy-backs from hangar history: ${JSON.stringify(rep.hist)}`);
  rep.closed && rep.reopened
    ? ok('scan report: ✕ closes it, Rough Landing opens it again')
    : fail(`scan report close/reopen: ${JSON.stringify(rep)}`);
  rep.part &&
  rep.part.open &&
  rep.part.title === 'Rough Landing' &&
  rep.part.rows.join() === 'Hangar:false,Buy-Backs:true,Referrals:false' &&
  rep.part.actions.join() === 'Send Flight Log (opens Discord),Scan Again,Report on GitHub ↗' &&
  /Nothing is sent until you submit it/.test(rep.part.hint) &&
  rep.cleared
    ? ok('scan report: one row per source with the failed one marked, and its buttons')
    : fail(`partial scan report: ${JSON.stringify(rep)}`);
  rep.send &&
  rep.send.log &&
  rep.send.opened.join() === 'https://discord.gg/pxJ6PzQe7z' &&
  rep.send.said === 'Flight log copied. Paste it in #bug-reports.' &&
  rep.send.open
    ? ok('problem card: Send Flight Log copies the log and opens #bug-reports on Discord')
    : fail(`send flight log: ${JSON.stringify(rep.send)}`);

  // Your menu: Clear Data (red) asks once in place; Keep Data backs out with nothing
  // cleared and the menu still open.
  const ask = await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 60));
    const items = state.items.length;
    document.querySelector('#settings-btn').click();
    await tick();
    document.querySelector('#clear-home').click();
    await tick();
    const box = document.querySelector('#settings-menu .you-confirm.danger');
    const r = {
      asked: /Clear This Account's Data\?/.test(box?.textContent || ''),
      open: !document.querySelector('#settings-menu').hidden,
    };
    [...box.querySelectorAll('button')].find((b) => /Keep Data/.test(b.textContent)).click();
    await tick();
    r.back = !!document.querySelector('#clear-home') && !document.querySelector('.you-confirm');
    r.kept = state.items.length === items && items > 0;
    document.dispatchEvent(new CustomEvent('oh:close-menus'));
    return r;
  });
  ask.asked && ask.open && ask.back && ask.kept
    ? ok('your menu: Clear Data asks first, Keep Data clears nothing')
    : fail(`clear data confirm: ${JSON.stringify(ask)}`);

  console.log('Keyboard');
  await go('#inventory');
  await page.click('#layout [data-layout="gallery"]');
  const active = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        id: a.id,
        card: a.classList.contains('card') ? a.dataset.id : null,
        chip: a.dataset.type || null,
        inModal: !!a.closest('#item-modal'),
        inMenu: !!a.closest('#settings-menu'),
        ring: getComputedStyle(a).outlineStyle,
      };
    });
  const modalOpen = () => page.$eval('#item-modal', (m) => !m.hidden);
  // The pop-up's picture comes from RSI or the wiki; offline neither answers, so
  // give the first card's item a local picture to fall back on (a real RSI image).
  await page.evaluate(() => {
    const id = document.querySelector('.card[data-id]').dataset.id;
    const item = state.items.find((x) => String(x.id) === id);
    if (item && !item.image) item.image = `${location.origin}/icons/icon128.png`;
  });
  await page.focus('.card[data-id]');
  const cardId = (await active()).card;
  await page.keyboard.press('Enter');
  const afterEnter = { open: await modalOpen(), ...(await active()) };
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const trapped = (await active()).inModal;
  await page.keyboard.press('Escape');
  const back = { open: await modalOpen(), ...(await active()) };
  afterEnter.open &&
  afterEnter.id === 'modal-close' &&
  trapped &&
  !back.open &&
  back.card === cardId
    ? ok('card opens with Enter, focus stays in the pop-up, Escape returns to the card')
    : fail(`card keyboard: ${JSON.stringify({ afterEnter, trapped, back })}`);
  back.ring === 'solid' ? ok('focused card shows a focus ring') : fail(`no ring: ${back.ring}`);
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 100));
  (await modalOpen())
    ? ok('Space opens the card and the pop-up stays open')
    : fail('Space did not open (or instantly closed) the pop-up');
  // Full-size picture (#299): the pop-up's picture opens the viewer, Escape closes
  // only the viewer and focus goes back to the picture.
  const picBtn = await page.waitForSelector('#modal-body .modal-img-btn', { timeout: 10000 });
  await picBtn.focus();
  await page.keyboard.press('Enter');
  const lb = () =>
    page.evaluate(() => ({
      open: !document.getElementById('lightbox').hidden,
      onClose: document.activeElement.id === 'lightbox-close',
      onPic: document.activeElement.classList.contains('modal-img-btn'),
      alt: document.getElementById('lightbox-img').alt,
    }));
  const lbOpen = await lb();
  await page.keyboard.press('Tab');
  const lbTrapped = (await lb()).onClose;
  await page.keyboard.press('Escape');
  const lbBack = { ...(await lb()), modal: await modalOpen() };
  lbOpen.open &&
  lbOpen.onClose &&
  lbOpen.alt &&
  lbTrapped &&
  !lbBack.open &&
  lbBack.modal &&
  lbBack.onPic
    ? ok('picture opens full size, Escape closes just the viewer and returns to the picture')
    : fail(`full-size viewer: ${JSON.stringify({ lbOpen, lbTrapped, lbBack })}`);
  await page.keyboard.press('Escape');
  await page.focus('.oh-fbar .oh-tp[data-type]');
  const chip = await active();
  const pressed = () =>
    page.$$eval('.oh-fbar .oh-tp[data-type][aria-pressed="true"]', (cs) => cs.length);
  const p0 = await pressed();
  await page.keyboard.press('Enter');
  const p1 = await pressed();
  const chipAfter = await active();
  await page.keyboard.press('Enter');
  p0 !== p1 && chipAfter.chip === chip.chip && (await pressed()) === p0
    ? ok('filter type pill toggles with Enter and keeps focus after redrawing')
    : fail(`chip keyboard: ${JSON.stringify({ p0, p1, chip, chipAfter })}`);
  await page.focus('#settings-btn');
  await page.keyboard.press('Enter');
  const inMenu = (await active()).inMenu;
  await page.keyboard.press('Escape');
  const menuBack = await active();
  const menuHidden = await page.$eval('#settings-menu', (m) => m.hidden);
  inMenu && menuHidden && menuBack.id === 'settings-btn'
    ? ok('gear menu: focus moves in, Escape closes it and returns to the gear')
    : fail(`gear menu keyboard: ${JSON.stringify({ inMenu, menuHidden, menuBack })}`);

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
