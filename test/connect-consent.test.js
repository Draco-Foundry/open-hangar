'use strict';
// Before You Connect on every browser (ui/basic/consent.js, ui/basic/FirefoxCard.svelte):
// Chrome and Edge want what sync sends said inside the extension, with a click that
// agrees, before any data leaves. Connect waits for the card's Continue. Run: `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const consent = () => import('../ui/basic/consent.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('consent: missing or older records are a no; the current one is a yes', async () => {
  const { CONSENT_VERSION, consentGiven, consentRecord } = await consent();
  assert.equal(consentGiven(undefined), false, 'never asked (the key is missing)');
  assert.equal(consentGiven(null), false);
  assert.equal(consentGiven({}), false);
  assert.equal(consentGiven({ v: CONSENT_VERSION - 1, at: 1 }), false, 'an older version');
  assert.equal(consentGiven({ v: String(CONSENT_VERSION) }), false, 'not a number');
  assert.equal(consentGiven(consentRecord(5)), true);
  assert.deepEqual(consentRecord(5), { v: CONSENT_VERSION, at: 5 });
});

test("connect: the card comes first, before Firefox's ask and the sign-in window", () => {
  const hub = read('ui/basic/hub.svelte.js');
  const body = hub.slice(hub.indexOf('export async function connect('));
  const gate = body.indexOf('if (!hub.site.consent)');
  assert.ok(gate > 0, 'connect checks the consent');
  assert.ok(gate < body.indexOf('dataOk()'), "before Firefox's ask");
  assert.ok(gate < body.indexOf('connectOnce('), 'before the sign-in window');
  // Continue is what saves it, and only for Connect's card.
  const cont = hub.slice(hub.indexOf('export async function firefoxContinue('));
  assert.match(cont.slice(0, cont.indexOf('\n}')), /why === 'connect'[\s\S]*dataConsent:/);
});

test("the card: Firefox's line only on Firefox, the rest on every browser", () => {
  const card = read('ui/basic/FirefoxCard.svelte');
  assert.match(card, /\{#if firefox\}\s*<dt>Why Firefox asks<\/dt>/);
  for (const line of ['What we send', 'What we never send', 'If you say no', 'Change your mind'])
    assert.ok(card.includes(`<dt>${line}</dt>`), line);
  assert.match(read('ui/basic/Basic.svelte'), /firefox=\{/);
});
