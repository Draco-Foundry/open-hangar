// Runs the developer's build (scripts/pack.mjs --dev, in dist/dev/ and dist/dev-firefox/)
// in a browser profile of its own, .dev-profiles/<browser>/ in this folder (gitignored),
// never the profile your installed Open Hangar lives in. The profile is kept between
// runs, so you sign in to RSI there once. npm run dev:chrome, dev:edge or dev:firefox
// build first, then call this:
//   node scripts/dev-run.mjs chrome|edge|firefox
// CHROME_PATH, EDGE_PATH or FIREFOX_PATH pick the browser when it isn't where it
// usually is (web-ext finds Chrome and Firefox on its own).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILES = '.dev-profiles';

const EDGE = {
  win32: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  darwin: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  linux: '/usr/bin/microsoft-edge',
};

// web-ext run's options for one browser. Pure, so test/dev-build.test.js can check that
// every browser gets a profile inside this folder.
export function runOptions(
  browser,
  { root = ROOT, env = process.env, platform = process.platform } = {},
) {
  const profile = path.join(root, PROFILES, browser);
  const common = {
    noInput: true,
    profileCreateIfMissing: true,
    keepProfileChanges: true,
  };
  if (browser === 'firefox')
    return {
      ...common,
      target: ['firefox-desktop'],
      sourceDir: path.join(root, 'dist', 'dev-firefox'),
      firefoxProfile: profile,
      ...(env.FIREFOX_PATH ? { firefox: env.FIREFOX_PATH } : {}),
    };
  if (browser === 'chrome' || browser === 'edge') {
    const binary = browser === 'edge' ? env.EDGE_PATH || EDGE[platform] : env.CHROME_PATH;
    return {
      ...common,
      target: ['chromium'],
      sourceDir: path.join(root, 'dist', 'dev'),
      chromiumProfile: profile,
      ...(binary ? { chromiumBinary: binary } : {}),
    };
  }
  throw new Error(`Which browser? chrome, edge or firefox (got "${browser}")`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = runOptions(process.argv[2]);
  if (!fs.existsSync(path.join(options.sourceDir, 'manifest.json')))
    throw new Error(`${options.sourceDir} isn't built: npm run dev:build first`);
  const { name } = JSON.parse(
    fs.readFileSync(path.join(options.sourceDir, 'manifest.json'), 'utf8'),
  );
  if (name !== 'Open Hangar (Dev)')
    throw new Error(`${options.sourceDir} isn't a dev build (named "${name}"): npm run dev:build`);
  // web-ext makes the profile's own folder but not the one it sits in.
  fs.mkdirSync(path.join(ROOT, PROFILES), { recursive: true });
  const { default: webExt } = await import('web-ext');
  console.log(
    `Open Hangar (Dev) in its own profile: ${options.firefoxProfile || options.chromiumProfile}`,
  );
  await webExt.cmd.run(options, { shouldExitProgram: true });
}
