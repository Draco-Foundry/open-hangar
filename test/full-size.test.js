'use strict';

/*
 * Full-size pictures (#299, OH.fullSizeImage in src/lib.js): a thumbnail's URL turns
 * into the original's, for RSI's two media URL shapes and wiki thumbnails.
 * Run: `npm test`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = globalThis;
global.chrome = global.chrome || {
  storage: { local: { get: async () => ({}), set: async () => {} } },
};
require('../src/lib.js');
const OH = globalThis.OH;
const full = OH.fullSizeImage;

test('RSI media host: the size name becomes "source", same file type', () => {
  assert.equal(
    full('https://media.robertsspaceindustries.com/abc123xyz/store_small.jpg'),
    'https://media.robertsspaceindustries.com/abc123xyz/source.jpg',
  );
  assert.equal(
    full('https://media.robertsspaceindustries.com/abc123xyz/slideshow_wide.png?v=2'),
    'https://media.robertsspaceindustries.com/abc123xyz/source.png?v=2',
  );
});

test('RSI /media/ folders: the size folder becomes "source"', () => {
  assert.equal(
    full('https://robertsspaceindustries.com/media/k1x9/store_small/Aurora-MR.jpg'),
    'https://robertsspaceindustries.com/media/k1x9/source/Aurora-MR.jpg',
  );
  assert.equal(
    full('https://robertsspaceindustries.com/media/k1x9/heap_infobox/Avatar.png'),
    'https://robertsspaceindustries.com/media/k1x9/source/Avatar.png',
  );
});

test('wiki thumbnails point at the original file', () => {
  assert.equal(
    full(
      'https://media.starcitizen.tools/thumb/a/ab/Carrack_in_space.jpg/600px-Carrack_in_space.jpg',
    ),
    'https://media.starcitizen.tools/a/ab/Carrack_in_space.jpg',
  );
});

test('already the original, unknown hosts and junk give null', () => {
  assert.equal(full('https://media.robertsspaceindustries.com/abc/source.jpg'), null);
  assert.equal(full('https://robertsspaceindustries.com/media/k1x9/source/A.jpg'), null);
  assert.equal(full('https://media.robertsspaceindustries.com/abc/wallpaper_1920x1080.jpg'), null);
  assert.equal(full('https://example.com/picture.jpg'), null);
  assert.equal(full('http://media.robertsspaceindustries.com/abc/store_small.jpg'), null);
  assert.equal(full('/media/abc/store_small/A.jpg'), null);
  assert.equal(full(''), null);
  assert.equal(full(null), null);
});
