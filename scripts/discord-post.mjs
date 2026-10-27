// Posts a release to the Discord #updates channel (called by the Publish to stores
// workflow once every store upload went through). The whole release goes out,
// laid out like the extension's Updates page (#238), in Open Hangar's Discord
// standard (owner, 2026-10-28, Direction A): a grey header card, then New /
// Improved / Fixed cards, every item with its bold lead, and on the last card the
// footer and Discord's own timestamp. Every card has a title, no emoji, nobody is
// pinged. Words: "Open Hangar {version} Is on the Way" and "Extension {version}"
// (approved 2026-10-27), with the website post's "Fly safe, Citizens. o7".
//
//   DISCORD_UPDATES_WEBHOOK=<url> node scripts/discord-post.mjs 0.2.12
//   node scripts/discord-post.mjs 0.2.12 --dry-run   (prints the messages instead)
//   node scripts/discord-post.mjs 0.2.12 --changelog=tag/CHANGELOG.md
// The workflow passes the released tag's CHANGELOG, so the post describes exactly
// what shipped; without --changelog it reads the one next to this script.
//
// Skips quietly (exit 0) when the webhook isn't set, like the store jobs do.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const STORES =
  '[Chrome](https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl) · ' +
  '[Edge](https://microsoftedge.microsoft.com/addons/detail/fmcnemfepnifokjelgjacgdhoodaiicl) · ' +
  '[Firefox](https://addons.mozilla.org/en-US/firefox/addon/open-hangar/)';

// Same groups and colors as the Updates page (--good, --link, --bad). "Changed:"
// and untagged items count as Improved, as there.
const GROUPS = [
  ['new', 'New', 0x3fb950],
  ['improved', 'Improved', 0x58a6ff],
  ['fixed', 'Fixed', 0xf85149],
];
const TAG = /^(new|improved|changed|fix(?:ed)?)\s*:\s*/i;
const kindOf = (b) => {
  const t = (b.match(TAG)?.[1] || '').toLowerCase();
  return t === 'new' ? 'new' : t.startsWith('fix') ? 'fixed' : 'improved';
};

// Discord's limits: 4096 characters per embed description, 6000 across a
// message's embeds, 10 embeds per message.
// The header card's grey (Discord's own neutral), as on the website's post.
const HEADER_COLOR = 0x4e5058;
const SIGN_OFF = 'Fly safe, Citizens. o7';
const DESC_MAX = 4096;
const MSG_MAX = 6000;
const EMBEDS_MAX = 10;

// House style: no em dashes in public posts.
const plain = (t) => t.replace(/\s*—\s*/g, ': ');

// The version's section of CHANGELOG.md → { intro: [text], bullets: [text] }. Pure.
export function releaseSection(log, version) {
  // Every regex character in the version is escaped, not only dots (CodeQL #285).
  const v = String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = log.search(new RegExp(`^## ${v}\\b`, 'm'));
  if (start < 0) return null;
  const rest = log.slice(start + 3);
  const end = rest.search(/^## /m);
  const lines = rest
    .slice(0, end === -1 ? undefined : end)
    .split('\n')
    .slice(1);
  const intro = [];
  const bullets = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) cur = null;
    else if (line.startsWith('- ')) bullets.push((cur = line.slice(2)));
    else if (cur !== null) bullets[bullets.length - 1] = cur = `${cur} ${line}`;
    else intro.push(line);
  }
  return { intro, bullets };
}

// Lines → descriptions of at most `max` characters, never splitting a line. Pure.
function pack(lines, max) {
  const out = [];
  let cur = '';
  for (const l of lines) {
    const line = l.length > max ? l.slice(0, max - 1) + '…' : l;
    if (cur && cur.length + 1 + line.length > max) {
      out.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

// One item as a line: `- ` to start, a capital first, no closing full stop (an
// ellipsis stays), the same as the website's post.
const line = (b) =>
  `- ${plain(b.replace(TAG, ''))
    .replace(/(?<!\.)\.$/, '')
    .replace(/^(\*\*)?(\w)/, (_, bold, c) => (bold || '') + c.toUpperCase())}`;

// The webhook bodies for one release, in order. Pure. now: the last card's timestamp.
export function buildMessages(log, version, now = Date.now()) {
  const section = releaseSection(log, version);
  if (!section) return null;
  const header = {
    title: `Open Hangar ${version} Is on the Way`,
    description: [
      ...section.intro.map(plain),
      `It rolls out as each store finishes its review: ${STORES}`,
    ].join('\n\n'),
    color: HEADER_COLOR,
  };
  const embeds = [header];
  for (const [key, label, color] of GROUPS) {
    const items = section.bullets.filter((b) => kindOf(b) === key).map(line);
    // A kind too long for one card goes on in another with the same title.
    pack(items, DESC_MAX).forEach((description) =>
      embeds.push({ title: label, description, color }),
    );
  }
  const last = embeds[embeds.length - 1];
  last.footer = { text: `Extension ${version} · ${SIGN_OFF}` };
  last.timestamp = new Date(now).toISOString();
  const size = (e) => e.title.length + e.description.length + (e.footer?.text.length ?? 0);
  const messages = [];
  let batch = [];
  for (const e of embeds) {
    const total = batch.reduce((n, x) => n + size(x), 0);
    if (batch.length && (batch.length === EMBEDS_MAX || total + size(e) > MSG_MAX)) {
      messages.push(batch);
      batch = [];
    }
    batch.push(e);
  }
  messages.push(batch);
  return messages.map((embeds) => ({
    username: 'Open Hangar',
    embeds,
    allowed_mentions: { parse: [] }, // never ping anyone
  }));
}

async function main() {
  const [version] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dry = process.argv.includes('--dry-run');
  const hook = process.env.DISCORD_UPDATES_WEBHOOK;
  if (!version) {
    console.error('usage: node scripts/discord-post.mjs <version> [--dry-run]');
    process.exit(1);
  }
  if (!hook && !dry) {
    console.log('::notice::Discord skipped: DISCORD_UPDATES_WEBHOOK not set');
    return;
  }
  const file = process.argv.find((a) => a.startsWith('--changelog='))?.slice(12);
  const log = fs.readFileSync(file || new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const messages = buildMessages(log, version);
  if (!messages) {
    console.error(`No "## ${version}" section in ${file || 'CHANGELOG.md'}`);
    process.exit(1);
  }
  if (dry) {
    console.log(JSON.stringify(messages, null, 2));
    return;
  }
  for (const body of messages) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Discord said ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
  }
  console.log(`Posted Open Hangar ${version} to Discord (${messages.length} message(s))`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
