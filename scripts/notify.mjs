// Post a short message to one of Open Hangar's Discord channels by webhook:
//
//   node scripts/notify.mjs ops "CI failed on main"            → #ops (private)
//   node scripts/notify.mjs status "Sync is down, on it" --down → #status (public)
//   node scripts/notify.mjs status "Sync is back" --up
//
// Webhooks come from DISCORD_OPS_WEBHOOK / DISCORD_STATUS_WEBHOOK (GitHub secrets, or
// your shell for a one-off). Skips quietly when the webhook isn't set. Never pings.
const [channel, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const text = rest.join(' ').trim();
const flag = (f) => process.argv.includes(f);
const HOOKS = { ops: 'DISCORD_OPS_WEBHOOK', status: 'DISCORD_STATUS_WEBHOOK' };
if (!HOOKS[channel] || !text) {
  console.error('usage: node scripts/notify.mjs <ops|status> "message" [--down|--up|--info]');
  process.exit(1);
}
const hook = process.env[HOOKS[channel]];
if (!hook) {
  console.log(`::notice::Discord #${channel} skipped: ${HOOKS[channel]} not set`);
  process.exit(0);
}
// Red for trouble, green for recovered, blue otherwise.
const color = flag('--down') ? 0xf85149 : flag('--up') ? 0x3fb950 : 0x2f81f7;
const res = await fetch(hook, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'Open Hangar',
    embeds: [{ description: text.slice(0, 4000), color, timestamp: new Date().toISOString() }],
    allowed_mentions: { parse: [] },
  }),
});
if (!res.ok) {
  console.error(`Discord said ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`Posted to #${channel}`);
