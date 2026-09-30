// Renders scripts/og/og.html to site/img/og.jpg (the 1200×630 link preview).
//   node scripts/og/render.mjs
// Rerun after new store screenshots (npm run screenshots), since it uses the Home one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../site/img/og.jpg');
const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--allow-file-access-from-files'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(here, 'og.html')).href, { waitUntil: 'load' });
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  console.log(path.relative(process.cwd(), out));
} finally {
  await browser.close();
}
