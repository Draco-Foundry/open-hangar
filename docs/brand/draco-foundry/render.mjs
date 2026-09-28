/*
 * Render logo.svg to the PNG sizes Discord and GitHub want, using the same
 * puppeteer-core + installed Chrome as the screenshot harness.
 *   node docs/brand/draco-foundry/render.mjs
 * Outputs next to this file: logo-1024.png, logo-512.png (Discord server icon),
 * logo-500.png (GitHub org avatar), logo-128.png, and a round preview.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(HERE, 'logo.svg'), 'utf8');
const chrome =
  process.env.CHROME_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({ executablePath: chrome });
const page = await browser.newPage();
for (const [size, round] of [
  [1024, false],
  [512, false],
  [500, false],
  [128, false],
  [256, true],
]) {
  await page.setViewport({ width: size, height: size });
  const radius = round ? 'border-radius:50%;' : '';
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;overflow:hidden;${radius}">
        ${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}
      </div></body></html>`,
  );
  const name = round ? `preview-round-${size}.png` : `logo-${size}.png`;
  await page.screenshot({ path: path.join(HERE, name), omitBackground: true });
  console.log(name);
}
await browser.close();
