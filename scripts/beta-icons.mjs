// Renders beta/icons/icon.svg into the Open Hangar Beta PNGs (16, 32, 48, 128, plus
// the 300 px store logo Edge asks for) with the Chrome that the UI tests use. Run it after editing the SVG and commit the PNGs;
// `npm run build:beta` only copies them (scripts/pack.mjs --beta).
//   node scripts/beta-icons.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const chrome = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
  .filter(Boolean)
  .find((p) => fs.existsSync(p));
if (!chrome) throw new Error('No Chrome found: set CHROME_PATH');

const svg = fs.readFileSync('beta/icons/icon.svg', 'utf8');
// The tag can't be read at 16 or 32 px: the amber colour carries it there.
const noTag = svg.replace(/<g id="beta-tag">[\s\S]*?<\/g>/, '');
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128, 300]) {
    await page.setViewport({ width: size, height: size });
    const src = (size < 48 ? noTag : svg).replace(
      /width="128" height="128"/,
      `width="${size}" height="${size}"`,
    );
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${src}`,
    );
    const file = size === 300 ? 'beta/logo-300.png' : `beta/icons/icon${size}.png`;
    await page.screenshot({
      path: file,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(file);
  }
} finally {
  await browser.close();
}
