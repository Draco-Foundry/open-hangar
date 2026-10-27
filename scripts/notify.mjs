// Post a short message to one of Open Hangar's Discord channels by webhook, as one card
// in Open Hangar's Discord standard (owner, 2026-10-28): a title, the color for its
// state, the text, a Run link, the footer and Discord's own timestamp. No emoji, never
// a ping.
//
//   node scripts/notify.mjs ops "Checks: failure." --down --title="Extension CI Failed on Main" --footer="Extension CI" --run=<url>
//   node scripts/notify.mjs status "Sync is down, on it" --down
//
// --down red (broken), --up green (back or done), --warn amber (a warning), else blue
// (a notice). --json: ready Discord messages ({ embeds }), sent in order. Webhooks come
// from DISCORD_OPS_WEBHOOK / DISCORD_STATUS_WEBHOOK / DISCORD_UPDATES_WEBHOOK (GitHub
// secrets, or your shell for a one-off). Skips quietly when the webhook isn't set.
//
// The website's notify.mjs is the same file; both are pinned to the same cases
// (test/fixtures/discord-notify-cases.json, test/discord-notify.test.js), so they
// don't drift.
import { pathToFileURL } from 'node:url';

const HOOKS = {
  ops: 'DISCORD_OPS_WEBHOOK',
  status: 'DISCORD_STATUS_WEBHOOK',
  updates: 'DISCORD_UPDATES_WEBHOOK',
};
// One color meaning (owner, 2026-10-28), the same everywhere Open Hangar posts.
export const COLORS = { down: 0xf85149, up: 0x3fb950, warn: 0xd29922, info: 0x58a6ff };
// Long text (a canary report, say) is cut here, with the rest on the run.
const TEXT_MAX = 4000;

/**
 * The message for one card. A text past TEXT_MAX is cut, and says the rest is on the run.
 * @param {{ text: string, title: string, state?: string, footer: string, run?: string,
 *   now?: number }} m
 */
export function opsMessage({ text, title, state = 'info', footer, run = '', now = Date.now() }) {
  let description = String(text).trim();
  if (description.length > TEXT_MAX)
    description = `${description.slice(0, TEXT_MAX - 40).trimEnd()}…\n(cut here: the rest is on the run)`;
  /** @type {Record<string, unknown>} */
  const embed = { title, color: COLORS[state] ?? COLORS.info, description };
  if (run) embed.fields = [{ name: 'Run', value: `[Actions](${run})`, inline: true }];
  embed.footer = { text: footer };
  embed.timestamp = new Date(now).toISOString();
  return { embeds: [embed] };
}

// --name=value, or '' when it isn't given.
const option = (argv, name) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';

// The title and footer when a call gives none, as hand-run commands do. The public
// channels use the approved words (2026-10-27).
export function defaults(channel, state) {
  if (channel === 'status')
    return {
      title: state === 'up' ? 'Website Is Back' : 'Website Trouble',
      footer: 'Website Check',
    };
  if (channel === 'updates') return { title: 'A Note From the Crew', footer: 'Website' };
  return { title: 'Notice', footer: 'Open Hangar' };
}

async function main(argv) {
  const [channel, ...rest] = argv.filter((a) => !a.startsWith('--'));
  const text = rest.join(' ').trim();
  const flag = (f) => argv.includes(f);
  if (!HOOKS[channel] || !text) {
    console.error(
      'usage: node scripts/notify.mjs <ops|status|updates> "message" [--title="..."] [--footer=...] [--run=<url>] [--down|--up|--warn]\n' +
        "       node scripts/notify.mjs <channel> '<messages>' --json",
    );
    process.exit(1);
  }
  const hook = process.env[HOOKS[channel]];
  if (!hook) {
    console.log(`::notice::Discord #${channel} skipped: ${HOOKS[channel]} not set`);
    process.exit(0);
  }
  const state = flag('--down') ? 'down' : flag('--up') ? 'up' : flag('--warn') ? 'warn' : 'info';
  const fallback = defaults(channel, state);
  const messages = flag('--json')
    ? [JSON.parse(text)].flat()
    : [
        opsMessage({
          text,
          title: option(argv, 'title') || fallback.title,
          state,
          footer: option(argv, 'footer') || fallback.footer,
          run: option(argv, 'run'),
        }),
      ];
  for (const message of messages) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Open Hangar',
        ...message,
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) {
      console.error(`Discord said ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
  }
  console.log(`Posted to #${channel}${messages.length > 1 ? ` (${messages.length} posts)` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href)
  await main(process.argv.slice(2));
