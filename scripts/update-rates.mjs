// Builds the exchange-rate file the extension reads (openhangar.space/rates.json),
// so users never depend on a third-party rates service (#243). Run by the Pages
// deploy, daily and on every site change:
//
//   node scripts/update-rates.mjs site/rates.json
//
// Source: the European Central Bank's daily reference rates (EUR based, published
// around 16:00 CET on working days), converted to USD. If the ECB can't be read,
// two free no-key services stand in; if all fail, yesterday's live file is kept.
// Never fails the deploy: the extension keeps its last saved rates either way.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const FAWAZ_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const ERAPI_URL = 'https://open.er-api.com/v6/latest/USD';
const LIVE_URL = 'https://openhangar.space/rates.json';

// Must cover OH.CURRENCIES in src/lib.js (test/rates.test.js checks it).
export const WANT = [
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'SEK',
  'PLN',
  'CZK',
  'BRL',
  'CNY',
  'JPY',
  'KRW',
];

// A rate moving more than this in a day is a bad source, not the market.
const MAX_DAY_MOVE = 0.3;

const round = (n) => Number(n.toPrecision(6));

// ECB XML → { date, rates } in USD. Pure.
export function parseEcb(xml) {
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1] || null;
  const eur = {};
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g))
    eur[m[1]] = Number(m[2]);
  if (!eur.USD) return null;
  const rates = { USD: 1, EUR: round(1 / eur.USD) };
  for (const [c, r] of Object.entries(eur)) if (c !== 'USD') rates[c] = round(r / eur.USD);
  return { date, rates };
}

// fawazahmed0/currency-api usd.json → { date, rates }. Pure.
export function parseFawaz(json) {
  const usd = json?.usd;
  if (!usd) return null;
  const rates = { USD: 1 };
  for (const c of WANT) if (usd[c.toLowerCase()] > 0) rates[c] = round(usd[c.toLowerCase()]);
  return { date: json.date || null, rates };
}

// open.er-api.com latest/USD → { date, rates }. Pure.
export function parseErApi(json) {
  if (json?.result !== 'success' || !json.rates) return null;
  const date = json.time_last_update_utc
    ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
    : null;
  const rates = { USD: 1 };
  for (const c of WANT) if (json.rates[c] > 0) rates[c] = round(json.rates[c]);
  return { date, rates };
}

// Problems with a candidate, or [] when it's usable. `previous` is the live file. Pure.
export function check(candidate, previous) {
  if (!candidate) return ['nothing read'];
  const problems = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date || '')) problems.push('no date');
  for (const c of WANT) {
    const r = candidate.rates?.[c];
    if (!(r > 0)) problems.push(`${c} missing`);
    const old = previous?.rates?.[c];
    if (r > 0 && old > 0 && Math.abs(r / old - 1) > MAX_DAY_MOVE)
      problems.push(`${c} jumped from ${old} to ${r}`);
  }
  return problems;
}

async function get(url, as) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'OpenHangar-rates (+https://openhangar.space)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

async function main(out) {
  const previous = await get(LIVE_URL, 'json').catch(() => null);
  const sources = [
    ['ECB', async () => parseEcb(await get(ECB_URL))],
    ['currency-api', async () => parseFawaz(await get(FAWAZ_URL, 'json'))],
    ['ExchangeRate-API', async () => parseErApi(await get(ERAPI_URL, 'json'))],
  ];
  for (const [source, read] of sources) {
    let candidate;
    try {
      candidate = await read();
    } catch (e) {
      console.log(`::warning::Rates: ${source} couldn't be read (${e?.message || e})`);
      continue;
    }
    const problems = check(candidate, previous);
    if (problems.length) {
      console.log(`::warning::Rates: ${source} skipped: ${problems.join(', ')}`);
      continue;
    }
    const file = { base: 'USD', date: candidate.date, source, rates: candidate.rates };
    fs.writeFileSync(out, JSON.stringify(file) + '\n');
    console.log(
      `Rates: ${source}, ${candidate.date}, ${Object.keys(candidate.rates).length} currencies`,
    );
    return;
  }
  if (previous?.rates) {
    fs.writeFileSync(out, JSON.stringify(previous) + '\n');
    console.log(`::warning::Rates: every source failed, kept the live file from ${previous.date}`);
  } else {
    console.log('::warning::Rates: every source failed and there is no live file; none published');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main(process.argv[2] || 'site/rates.json');
}
