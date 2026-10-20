// Renders beta/icons/icon.svg into the Open Hangar Beta PNGs (16, 32, 48, 128, plus
// the 300 px store logo Edge asks for) with the Chrome that the UI tests use. Run it after editing the SVG and commit the PNGs;
// `npm run build:beta` only copies them (scripts/pack.mjs --beta). With `dev`, the same
// for dev/icons/icon.svg, the developer's build (scripts/pack.mjs --dev), no store logo.
//   node scripts/beta-icons.mjs [dev]
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

const kind = process.argv[2] === 'dev' ? 'dev' : 'beta';
const svg = fs.readFileSync(`${kind}/icons/icon.svg`, 'utf8');
// The tag can't be read at 16 or 32 px: the colour carries it there.
const noTag = svg.replace(/<g id="(beta|dev)-tag">[\s\S]*?<\/g>/, '');
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  for (const size of kind === 'beta' ? [16, 32, 48, 128, 300] : [16, 32, 48, 128]) {
    await page.setViewport({ width: size, height: size });
    const src = (size < 48 ? noTag : svg).replace(
      /width="128" height="128"/,
      `width="${size}" height="${size}"`,
    );
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${src}`,
    );
    const file = size === 300 ? 'beta/logo-300.png' : `${kind}/icons/icon${size}.png`;
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
