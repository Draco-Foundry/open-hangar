'use strict';

/*
 * Error log + copy-paste report (OH.scrubLog / OH.log / OH.errorReport in
 * src/lib.js). Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const mem = {};
global.window = globalThis;
global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        const out = {};
        for (const k of [].concat(keys)) if (k in mem) out[k] = mem[k];
        return out;
      },
      set: async (obj) => Object.assign(mem, obj),
      remove: async (keys) => [].concat(keys).forEach((k) => delete mem[k]),
    },
  },
  runtime: { getManifest: () => ({ version: '9.9.9' }) },
};
require('../src/lib.js');
const OH = globalThis.OH;

test('scrubLog removes emails, referral codes and extension ids', () => {
  const s = OH.scrubLog(
    'mail me@x.com code STAR-ABCD-1234 at chrome-extension://bbmbgehang/src/lib.js ?referral=XYZ',
  );
  assert.ok(!s.includes('me@x.com'));
  assert.ok(!s.includes('STAR-ABCD-1234'));
  assert.ok(!s.includes('bbmbgehang'));
  assert.ok(!s.includes('XYZ'));
});

test('log keeps the newest entries and the report includes them', async () => {
  for (let i = 0; i < 105; i++) OH.log('warn', 'hangar', `retry ${i}`);
  await OH.log('error', 'status', 'Not signed in to RSI');
  const log = await OH.getLog();
  assert.equal(log.length, 100);
  assert.equal(log.at(-1).msg, 'Not signed in to RSI');
  const report = await OH.errorReport();
  assert.match(report, /^```\nOpen Hangar error report/);
  assert.match(report, /Version: +9\.9\.9/);
  assert.match(report, /ERROR +status +Not signed in to RSI/);
  await OH.clearLog();
  assert.equal((await OH.getLog()).length, 0);
});
