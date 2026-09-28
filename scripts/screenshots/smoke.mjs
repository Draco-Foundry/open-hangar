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
