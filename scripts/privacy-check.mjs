// Privacy check: the built store extension, loaded in Chrome as someone who never
// connected, sends nothing to the sync site and nothing personal anywhere.
//
//   npm run pack && npm run test:privacy      (CI runs it on the store build)
//   node scripts/privacy-check.mjs [dir]      dir defaults to dist/chrome
//
// It opens Home, presses Scan, visits every page, then calls Sync and Disconnect
// directly. Nothing leaves the machine: the dashboard's requests are answered here
// (openhangar.space's feeds get an empty answer, RSI is cut off), and the browser can
// only go out through a local proxy that refuses everything. Every request from the
// dashboard and the background worker is noted. It fails on:
// - any request to app.openhangar.space or another openhangar.space subdomain (the
//   sync site), from anywhere in the browser (the proxy sees those too)
// - a request to openhangar.space that isn't a plain GET with no body (the public feeds)
// - a request from the extension to any host other than RSI and openhangar.space
// - Sync or Disconnect making a request with no Connect
// And it checks the build is what the store gets: sync on, built in to production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const dir = path.resolve(process.argv[2] || 'dist/chrome');
const SYNC_SITE = 'app.openhangar.space';
const FEEDS = 'openhangar.space';
const RSI = /(^|\.)robertsspaceindustries\.com$/;
const PAGES = [
  'home',
  'inventory',
  'buybacks',
  'stats',
  'store',
  'org',
  'referrals',
  'updates',
  'developers',
];

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

if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
  console.error(`No build in ${dir}: run npm run pack (or npm run build) first.`);
  process.exit(1);
}
const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome not found: set CHROME_PATH to your Chrome or Chromium binary.');
  process.exit(1);
}

// The extension's requests (dashboard and background worker): { from, method, url, body }.
const seen = [];
// Hosts the whole browser tried to reach through the proxy (Chrome's own traffic too).
const outbound = [];
const proxy = http.createServer((req, res) => {
  outbound.push(String(req.headers.host || req.url));
  res.writeHead(403).end();
});
proxy.on('connect', (req, socket) => {
  socket.on('error', () => {}); // the browser hangs up first sometimes
  outbound.push(String(req.url).split(':')[0]);
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
});
proxy.on('clientError', (err, socket) => socket.destroy());
await new Promise((r) => proxy.listen(0, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  pipe: true,
  enableExtensions: true,
  args: [
    `--proxy-server=http://127.0.0.1:${proxy.address().port}`,
    ...(process.env.CI ? ['--no-sandbox'] : []),
  ],
  defaultViewport: { width: 1280, height: 900 },
});

try {
  const id = await browser.installExtension(dir);
  const ORIGIN = `chrome-extension://${id}`;
  // The background worker, each time it starts: its requests, from the browser's side.
  const watched = new Set();
  const watchWorker = async (t) => {
    if (t.type() !== 'service_worker' || !t.url().startsWith(ORIGIN) || watched.has(t)) return;
    watched.add(t);
    const cdp = await t.createCDPSession();
    cdp.on('Network.requestWillBeSent', ({ request: q }) => {
      if (/^https?:/.test(q.url))
        seen.push({ from: 'worker', method: q.method, url: q.url, body: q.postData || '' });
    });
    await cdp.send('Network.enable');
  };
  browser.on('targetcreated', (t) => watchWorker(t).catch(() => {}));
  await Promise.all(browser.targets().map((t) => watchWorker(t).catch(() => {})));

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`  (page error: ${e.message})`));
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const url = r.url();
    if (!/^https?:/.test(url)) return r.continue(); // the extension's own files, data:, blob:
    seen.push({ from: 'page', method: r.method(), url, body: r.postData() || '' });
    if (new URL(url).hostname === FEEDS)
      return r.respond({
        status: 404,
        headers: { 'access-control-allow-origin': ORIGIN },
        contentType: 'application/json',
        body: '{}',
      });
    return r.abort();
  });
  // Quiet: no new request for a while (or the time's up).
  const settle = async (quietMs = 2500, maxMs = 30000) => {
    const until = Date.now() + maxMs;
    let n = -1;
    while (Date.now() < until && n !== seen.length) {
      n = seen.length;
      await new Promise((r) => setTimeout(r, quietMs));
    }
  };

  console.log(`Privacy check: ${path.relative(process.cwd(), dir) || dir}`);
  await page.goto(`${ORIGIN}/src/dashboard.html#home`);
  await settle();

  // The build the store gets: sync on and built in to production, never connected.
  const state = await page.evaluate(async () => ({
    sync: !!(OH.flags && OH.flags.sync),
    enabled: await OH.siteEnabled(),
    url: await OH.siteUrl(),
    link: await OH.getSiteLink(),
    connect: !!(window.OHApp && window.OHApp.site),
  }));
  if (state.sync && state.enabled && state.url === `https://${SYNC_SITE}` && state.connect)
    ok('store build: sync on, built in to production, Connect there');
  else fail(`not the store build's sync: ${JSON.stringify(state)}`);
  if (state.link) fail('a fresh install has a sync link');

  await page.evaluate(() => document.querySelector('#scan-home')?.click());
  await settle();
  for (const p of PAGES) {
    await page.evaluate((h) => (location.hash = h), `#${p}`);
    await settle(1500);
  }
  ok(`Scan and ${PAGES.length} pages: ${seen.length} requests, every one answered here`);

  const before = seen.length;
  const direct = await page.evaluate(async () => {
    const sync = await OH.siteSync().then(
      () => 'sent',
      (e) => e.message,
    );
    await OH.siteDisconnect();
    return sync;
  });
  await settle(1500, 5000);
  if (direct === 'Not connected to openhangar.space.' && seen.length === before)
    ok('Sync and Disconnect with no Connect: no request');
  else fail(`Sync with no Connect: "${direct}", ${seen.length - before} requests`);

  let feeds = 0;
  for (const r of seen) {
    const host = new URL(r.url).hostname;
    const what = `${r.from}: ${r.method} ${r.url}`;
    if (host.endsWith(`.${FEEDS}`)) fail(`request to the sync site before Connect: ${what}`);
    else if (host === FEEDS) {
      feeds++;
      if (r.method !== 'GET' || r.body) fail(`not a plain public read: ${what}`);
    } else if (!RSI.test(host)) fail(`request to a host that isn't RSI or ours: ${what}`);
  }
  for (const host of new Set(outbound))
    if (host.endsWith(`.${FEEDS}`)) fail(`the browser tried the sync site before Connect: ${host}`);
  if (!failures.length)
    ok(`nothing to ${SYNC_SITE}; ${feeds} plain GETs of openhangar.space's public feeds`);
} catch (err) {
  fail(`couldn't run: ${err.message}`);
} finally {
  await browser.close().catch(() => {});
  proxy.close();
}

if (failures.length) {
  console.log(`\n${failures.length} privacy check(s) failed.`);
  process.exit(1);
}
console.log('\nPrivacy check passed: nothing sent before Connect.');
