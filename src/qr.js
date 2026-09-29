/*
 * qr.js — a small QR code encoder (byte mode, error correction level M,
 * versions 1–6: up to 106 bytes, plenty for a referral link). No dependencies.
 * Follows the ISO/IEC 18004 layout; the structure mirrors Project Nayuki's
 * well-known reference encoder. Verified by test/qr.test.js, which decodes the
 * output with a real QR reader.
 *
 *   OpenHangarQR.encode('https://…') → { size, modules: boolean[row][col] }
 */
(function (root) {
  'use strict';

  // Level M block structure per version: [EC codewords per block, [count, data codewords]...]
  const BLOCKS_M = {
    1: [10, [1, 16]],
    2: [16, [1, 28]],
    3: [26, [1, 44]],
    4: [18, [2, 32]],
    5: [24, [2, 43]],
    6: [16, [4, 27]],
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
  const FORMAT_BITS_M = 0; // level M's two format bits

  // --- GF(256) arithmetic (x^8 + x^4 + x^3 + x^2 + 1) + Reed–Solomon -------------
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let rootVal = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], rootVal);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootVal = gfMul(rootVal, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = new Array(divisor.length).fill(0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => {
        result[i] ^= gfMul(coef, factor);
      });
    }
    return result;
  }

  function dataCapacity(ver) {
    const [, ...groups] = BLOCKS_M[ver];
    return groups.reduce((n, [count, len]) => n + count * len, 0);
  }

  // Byte-mode bit stream, terminated and padded to the version's capacity.
  function encodeData(bytes, ver) {
    const cap = dataCapacity(ver);
    const bits = [];
    const put = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    put(0b0100, 4); // byte mode
    put(bytes.length, 8); // character count (8 bits for versions 1–9)
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, cap * 8 - bits.length)); // terminator
    while (bits.length % 8) bits.push(0);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      out.push(v);
    }
    for (let pad = 0xec; out.length < cap; pad ^= 0xec ^ 0x11) out.push(pad);
    return out;
  }

  // Split into blocks, add EC codewords, interleave.
  function addEcc(data, ver) {
    const [ecLen, ...groups] = BLOCKS_M[ver];
    const divisor = rsDivisor(ecLen);
    const blocks = [];
    let k = 0;
    for (const [count, len] of groups) {
      for (let c = 0; c < count; c++) {
        const d = data.slice(k, (k += len));
        blocks.push({ d, e: rsRemainder(d, divisor) });
      }
    }
    const out = [];
    const maxData = Math.max(...blocks.map((b) => b.d.length));
    for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
    for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
    return out;
  }

  function buildMatrix(ver, codewords, mask) {
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => {
      mod[y][x] = dark;
      fn[y][x] = true;
    };
    // Timing patterns.
    for (let i = 0; i < size; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    // Finder patterns (with their separators).
    for (const [cx, cy] of [
      [3, 3],
      [size - 4, 3],
      [3, size - 4],
    ]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          set(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
    // Alignment patterns (not over the finders).
    const al = ALIGN[ver];
    for (let i = 0; i < al.length; i++) {
      for (let j = 0; j < al.length; j++) {
        const last = al.length - 1;
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    // Format information (both copies) + the dark module.
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fmt = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((fmt >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);

    // Data, zig-zagging up and down column pairs from the bottom right.
    let n = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && n < codewords.length * 8) {
            mod[y][x] = ((codewords[n >>> 3] >>> (7 - (n & 7))) & 1) === 1;
            n++;
          }
        }
      }
    }
    // Mask the data area.
    const MASKS = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) mod[y][x] = !mod[y][x];
    }
    return mod;
  }

  // Simplified penalty (runs, 2x2 blocks, dark balance) to pick a readable mask.
  function penalty(m) {
    const size = m.length;
    let p = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          const cur = pass ? m[b][a] : m[a][b];
          const prev = pass ? m[b - 1][a] : m[a][b - 1];
          if (cur === prev) {
            run++;
            if (run === 5) p += 3;
            else if (run > 5) p++;
          } else run = 1;
        }
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
        }
      }
    }
    const k = Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
    return p + k * 10;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let ver = 1;
    // 2 bytes of header per version (mode + count, rounded up).
    while (ver <= 6 && dataCapacity(ver) < bytes.length + 2) ver++;
    if (ver > 6) throw new Error('Text too long for a QR code here (max ~100 characters).');
    const codewords = addEcc(encodeData(bytes, ver), ver);
    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const m = buildMatrix(ver, codewords, mask);
      const score = penalty(m);
      if (!best || score < best.score) best = { m, score };
    }
    return { size: best.m.length, modules: best.m };
  }

  const api = { encode };
  root.OpenHangarQR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
