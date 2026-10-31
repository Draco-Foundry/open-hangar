// scripts/notify.mjs against the shared Discord cases (test/fixtures/discord-notify-cases.json).
// The website's notify.mjs is read against the same cases, so the two copies stay one.
const test = require('node:test');
const assert = require('node:assert/strict');
const cases = require('./fixtures/discord-notify-cases.json');

const notify = () => import('../scripts/notify.mjs');

test('notify: one color meaning', async () => {
  const { COLORS } = await notify();
  assert.deepEqual(COLORS, cases.colors);
});

test('notify: the same cards as the website, case for case', async () => {
  const { opsMessage, defaults } = await notify();
  for (const c of cases.opsMessage) assert.deepEqual(opsMessage(c.input), c.expected);
  for (const d of cases.defaults) assert.deepEqual(defaults(d.channel, d.state), d.expected);
});

test('notify: no emoji, every card titled, long text cut with the run link', async () => {
  const { opsMessage } = await notify();
  for (const c of cases.opsMessage) {
    const [e] = opsMessage(c.input).embeds;
    assert.ok(e.title.trim() && e.footer.text.trim());
    assert.doesNotMatch(JSON.stringify(e), /\p{Extended_Pictographic}/u);
    assert.ok(e.description.length <= 4000);
  }
});
