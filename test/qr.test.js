'use strict';
// The QR encoder is checked the only way that matters: a real reader (jsQR,
// dev-only) must decode what it draws back to the exact text.
const test = require('node:test');
const assert = require('node:assert/strict');
const jsQR = require('jsqr');
const QR = require('../src/qr.js');

function decode(text) {
  const { size, modules } = QR.encode(text);
  const scale = 4;
  const quiet = 4;
  const px = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * px + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  const out = jsQR(data, px, px);
  return { size, text: out && out.data };
}

for (const text of [
  'STAR-ABCD-1234',
  'https://robertsspaceindustries.com/enlist?referral=STAR-ABCD-1234',
  'https://openhangar.space',
  'x'.repeat(100), // longest supported (version 6)
  'Ünïcödé ✓ 星际公民',
]) {
  test(`QR round-trips: ${text.slice(0, 40)}`, () => {
    const r = decode(text);
    assert.equal(r.text, text);
  });
}

test('QR picks the smallest version that fits', () => {
  assert.equal(QR.encode('STAR-ABCD-1234').size, 21); // version 1
  assert.equal(
    QR.encode('https://robertsspaceindustries.com/enlist?referral=STAR-ABCD-1234').size,
    37,
  ); // version 5
});

test('QR refuses text that is too long', () => {
  assert.throws(() => QR.encode('x'.repeat(200)), /too long/);
});
