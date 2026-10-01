// Uploads a zip to the Chrome Web Store and submits it for review.
//   EXTENSION_ID=… CLIENT_ID=… CLIENT_SECRET=… REFRESH_TOKEN=… \
//     node scripts/publish/chrome.mjs dist/open-hangar-chrome-0.2.13.zip
// "Previous version still in review" is a warning, not a failure (see lib.mjs).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { chromeOutcome } from './lib.mjs';

const zip = process.argv[2];
const r = spawnSync(
  'npx',
  ['--yes', 'chrome-webstore-upload-cli@3', 'upload', '--auto-publish', '--source', zip],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);
const output = `${r.stdout || ''}${r.stderr || ''}`;
process.stdout.write(output);

const summary = (line) => {
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
};
switch (chromeOutcome(output, r.status)) {
  case 'ok':
    summary('Chrome: uploaded and sent for review.');
    break;
  case 'waiting':
    console.log(
      "::warning::Chrome is still reviewing the previous version, so it won't take a new one yet. " +
        'Run Publish to stores again with store: chrome once that review clears.',
    );
    summary(
      'Chrome: **not sent**, the previous version is still in review. Rerun with store: chrome later.',
    );
    break;
  default:
    console.log('::error::Chrome Web Store rejected the upload (details above).');
    process.exit(1);
}
