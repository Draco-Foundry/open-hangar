// Quick screenshot of the running demo (npm run demo) for design checks:
//   node scripts/screenshots/shot.mjs <out.png> [#view] [width] [--alerts]
// --alerts adds a wishlist sale so Home's Hangar Alerts card shows.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const [out = 'shot.png', view = '#home', width = '1280'] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
const alerts = process.argv.includes('--alerts');
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
  defaultViewport: { width: +width, height: 900, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:8323/${view}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  if (alerts) {
    await page.evaluate(async () => {
      OH.getShipStock = async (url) =>
        /Cutlass-Black/i.test(url)
          ? { state: 'in', price: 110, packs: [] }
          : { state: 'out', price: null, packs: [] };
      OHApp.state.wishlist = ['Cutlass Black'];
      document.dispatchEvent(new CustomEvent('oh:home'));
      await new Promise((r) => setTimeout(r, 1500));
    });
  }
  await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png' });
  console.log(out);
} finally {
  await browser.close();
}
