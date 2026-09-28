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
  (await page.$('.howto details[open]')) ? ok('how-to guide open') : fail('how-to guide missing');

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
  await page.click('#layout [data-layout="gallery"]');
  await page.click('#select-toggle');
  const [c1, c2] = await page.$$('#results .card');
  await c1.click();
  await c2.click();
  const sel = await page.$eval('#sb-count', (e) => e.textContent);
  /2 selected/.test(sel) ? ok('select mode picks items') : fail(`select mode: "${sel}"`);
  await page.click('[data-sb="done"]');

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

  console.log('Store');
  await go('#store');
  await page
    .waitForFunction(() => document.querySelectorAll('#price-table tbody tr').length > 50, {
      timeout: 20000,
    })
    .catch(() => {});
  const prices = await page.$$eval('#price-table tbody tr', (r) => r.length);
  prices > 50 ? ok(`price list: ${prices} ships`) : fail(`price list only ${prices} rows`);

  console.log('Updates');
  await go('#updates');
  await page.waitForSelector('#updates-body .release', { timeout: 5000 }).catch(() => {});
  const rel = await page.$$eval('#updates-body .release', (r) => r.length);
  const tags = await page.$$eval('.release-tag', (t) => t.map((e) => e.textContent).join('|'));
  rel >= 3 ? ok(`${rel} releases listed`) : fail(`only ${rel} releases listed`);
  /Your version/.test(tags) ? ok('current version tagged') : fail('current version not tagged');

  console.log('Saved accounts');
  await go('#developers');
  const prof = await page.$$eval('#profiles .profile-row', (r) => r.map((e) => e.textContent));
  prof.length && /signed in/.test(prof[0])
    ? ok(`${prof.length} saved account(s) listed`)
    : fail('saved accounts list empty');

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
