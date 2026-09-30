// Posts a release to the Discord #updates channel (called by the Publish to stores
// workflow once every store upload went through). The text comes from CHANGELOG.md:
// the version's "New" highlights (the bold part of each bullet), then a count of
// the rest and a link to the full list.
//
//   DISCORD_UPDATES_WEBHOOK=<url> node scripts/discord-post.mjs 0.2.12
//   node scripts/discord-post.mjs 0.2.12 --dry-run   (prints the message instead)
//
// Skips quietly (exit 0) when the webhook isn't set, like the store jobs do.
import fs from 'node:fs';

const [version] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry-run');
const hook = process.env.DISCORD_UPDATES_WEBHOOK;
const repo = process.env.GITHUB_REPOSITORY || 'Draco-Foundry/open-hangar';
if (!version) {
  console.error('usage: node scripts/discord-post.mjs <version> [--dry-run]');
  process.exit(1);
}
if (!hook && !dry) {
  console.log('::notice::Discord skipped: DISCORD_UPDATES_WEBHOOK not set');
  process.exit(0);
}

// The version's section of the changelog ("## 0.2.12 — 2026-09-30" up to the next "## ").
const log = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const start = log.search(new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm'));
if (start < 0) {
  console.error(`No "## ${version}" section in CHANGELOG.md`);
  process.exit(1);
}
const rest = log.slice(start + 3);
const section = rest.slice(0, rest.search(/^## /m) === -1 ? undefined : rest.search(/^## /m));
// Bullets, with wrapped lines joined back up.
const bullets = section
  .split(/\n(?=- )/)
  .filter((b) => b.startsWith('- '))
  .map((b) =>
    b
      .replace(/\s*\n\s*/g, ' ')
      .slice(2)
      .trim(),
  );
const highlight = (b) => {
  const bold = /\*\*(.+?)\*\*/.exec(b);
  const text = (bold ? bold[1] : b.replace(/^(New|Improved|Changed|Fixed):\s*/, ''))
    .replace(/[.:]+$/, '')
    .replace(/\s+—\s+/g, ': '); // house style: no em dashes in public posts
  return text.length > 90 ? text.slice(0, 87).trimEnd() + '…' : text;
};
const news = bullets.filter((b) => /^New:/.test(b)).map(highlight);
const shown = news.slice(0, 8);
const others = bullets.length - shown.length;

const changelog = `https://github.com/${repo}/blob/main/CHANGELOG.md`;
const lines = [
  shown.length ? shown.map((t) => `• ${t}`).join('\n') : 'Fixes and polish all over.',
  others > 0
    ? `\n…and ${others} more changes. [Full list](${changelog})`
    : `\n[Full list](${changelog})`,
  '\nIt rolls out as each store finishes its review: ' +
    '[Chrome](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl) · ' +
    '[Edge](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) · ' +
    '[Firefox](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/)',
];
const body = {
  username: 'Open Hangar',
  embeds: [
    {
      title: `Open Hangar ${version} is on the way`,
      url: changelog,
      description: lines.join('\n').slice(0, 4000),
      color: 0x2f81f7,
    },
  ],
  allowed_mentions: { parse: [] }, // never ping anyone
};

if (dry) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}
const res = await fetch(hook, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`Discord said ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`Posted Open Hangar ${version} to Discord`);
