// The extension's exchange rates (openhangar.space/rates.json, #243): where they
// come from, how each source is read, and the checks a reading must pass. Shared
// by the front Worker (src/index.js), which builds the file on request, and by
// scripts/update-rates.mjs, which builds the static copy in each Pages run. Pure
// apart from pickRates' fetches: no Node modules, so it bundles into the Worker.
//
// Source: the European Central Bank's daily reference rates (EUR based, published
// around 16:00 CET on working days), converted to USD. If the ECB can't be read,
// two free no-key services stand in.

export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const FAWAZ_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
export const ERAPI_URL = 'https://open.er-api.com/v6/latest/USD';
export const USER_AGENT = 'OpenHangar-rates (+https://openhangar.space)';

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

// Problems with a candidate, or [] when it's usable. `previous` is the last
// published file. Pure.
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

// The sources in the order they're tried: [name, url, how to read the body, parser].
export const SOURCES = [
  ['ECB', ECB_URL, 'text', parseEcb],
  ['currency-api', FAWAZ_URL, 'json', parseFawaz],
  ['ExchangeRate-API', ERAPI_URL, 'json', parseErApi],
];

// The first source whose reading passes check() against `previous`, as the
// published file's shape { base, date, source, rates }, or null when none does.
// `get(url, as)` fetches a body ('text' or 'json'); `warn(line)` hears why each
// source was skipped.
export async function pickRates(previous, get, warn = () => {}) {
  for (const [source, url, as, parse] of SOURCES) {
    let candidate;
    try {
      candidate = parse(await get(url, as));
    } catch (e) {
      warn(`${source} couldn't be read (${e?.message || e})`);
      continue;
    }
    const problems = check(candidate, previous);
    if (problems.length) {
      warn(`${source} skipped: ${problems.join(', ')}`);
      continue;
    }
    return { base: 'USD', date: candidate.date, source, rates: candidate.rates };
  }
  return null;
}
