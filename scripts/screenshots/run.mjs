/*
 * run.mjs — regenerate the store screenshots (`npm run screenshots`).
 * ---------------------------------------------------------------------------
 * Serves the REAL dashboard from src/ on localhost, with two extra scripts
 * injected into dashboard.html:
 *   demo-shim.js       stubs chrome.* (in-memory storage seeded with a
 *                      fictional demo account) and routes public RSI /
 *                      star-citizen.wiki lookups through the local proxy
 *   demo-after-lib.js  swaps the live account/referral calls for demo data
 * Then drives your installed Chrome (puppeteer-core, no browser download) at
 * exactly 1280x800 and saves one JPEG per view into docs/store-assets/.
 *
 * No personal data: nothing reads your RSI session, and the proxy only allows
 * GETs to public endpoints, without cookies.
 *
 * Chrome is found automatically; override with CHROME_PATH=/path/to/chrome.
 * `npm run demo` serves the same demo dashboard without capturing, for trying
 * UI changes by hand at http://localhost:8323.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'store-assets');
const PORT = 8323;

// Order = store listing order (first is the hero shot).
const VIEWS = ['inventory', 'home', 'referrals', 'buybacks', 'stats'];

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};
const PROXY_ALLOW =
  /^https:\/\/(robertsspaceindustries\.com\/ship-matrix\/|api\.star-citizen\.wiki\/)/;
const proxyCache = new Map();

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found — set CHROME_PATH to your Chrome/Chromium binary.');
  return hit;
}

// dashboard.html with the demo scripts injected around parser.js / lib.js.
function demoDashboard() {
  return fs
    .readFileSync(path.join(SRC, 'dashboard.html'), 'utf8')
    .replace(
      '<script src="scraper/parser.js"></script>',
      '<script src="/__demo/demo-shim.js"></script>\n    <script src="scraper/parser.js"></script>',
    )
    .replace(
      '<script src="lib.js"></script>',
      '<script src="lib.js"></script>\n    <script src="/__demo/demo-after-lib.js"></script>',
    );
}

async function handle(req, res) {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/proxy') {
    const target = u.searchParams.get('u') || '';
    if (!PROXY_ALLOW.test(target)) return res.writeHead(403).end();
    try {
      if (!proxyCache.has(target)) {
        const r = await fetch(target, { headers: { accept: 'application/json' } });
        proxyCache.set(target, {
          status: r.status,
          type: r.headers.get('content-type') || 'application/json',
          body: Buffer.from(await r.arrayBuffer()),
        });
      }
      const c = proxyCache.get(target);
      return res.writeHead(c.status, { 'content-type': c.type }).end(c.body);
    } catch (e) {
      return res.writeHead(502).end(String(e));
    }
  }

  if (u.pathname === '/' || u.pathname === '/dashboard.html') {
    return res
      .writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
      .end(demoDashboard());
  }

  const base = u.pathname.startsWith('/__demo/') ? HERE : SRC;
  const rel = decodeURIComponent(u.pathname.replace(/^\/__demo\//, '/'));
  const file = path.join(base, rel);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return res.writeHead(404).end();
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store', // always serve the latest edits (npm run demo)
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(handle);
await new Promise((ok) => server.listen(PORT, ok));
console.log(`demo dashboard on http://localhost:${PORT}`);

// `npm run demo` (--serve): just keep the demo dashboard running for manual
// testing in a normal browser — no screenshots. Ctrl+C to stop.
if (process.argv.includes('--serve')) {
  console.log('serving only (Ctrl+C to stop)');
  await new Promise(() => {});
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});

try {
  fs.mkdirSync(OUT, { recursive: true });
  const page = await browser.newPage();
  for (const [i, view] of VIEWS.entries()) {
    await page.goto(`http://localhost:${PORT}/#${view}`, { waitUntil: 'networkidle0' });
    // Ship art resolves lazily after render — wait until every visible image has loaded.
    await page
      .waitForFunction(() => [...document.images].every((img) => img.complete), { timeout: 20000 })
      .catch(() => console.warn(`  (${view}: some images still loading — capturing anyway)`));
    await new Promise((r) => setTimeout(r, 500));
    const file = path.join(OUT, `screenshot-${i + 1}-${view}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    console.log(`  ${path.relative(ROOT, file)}`);
  }
} finally {
  await browser.close();
  server.close();
}
