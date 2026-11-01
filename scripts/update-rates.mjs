// Builds the static copy of the exchange-rate file the extension reads
// (openhangar.space/rates.json), so users never depend on a third-party rates
// service (#243). Run by each Pages deploy:
//
//   node scripts/update-rates.mjs site/rates.json
//
// The front Worker (site-worker/src/index.js) builds the live file itself from
// the same sources and checks (site-worker/src/rates.mjs), so rates stay fresh
// between Pages runs; this copy is what it serves when no source passes. If all
// sources fail here, the live file is kept. Never fails the deploy: the
// extension keeps its last saved rates either way.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { USER_AGENT, pickRates } from '../site-worker/src/rates.mjs';

export {
  WANT,
  parseEcb,
  parseFawaz,
  parseErApi,
  check,
  pickRates,
} from '../site-worker/src/rates.mjs';

const LIVE_URL = 'https://openhangar.space/rates.json';

async function get(url, as) {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

async function main(out) {
  const previous = await get(LIVE_URL, 'json').catch(() => null);
  const file = await pickRates(previous, get, (line) => console.log(`::warning::Rates: ${line}`));
  if (file) {
    fs.writeFileSync(out, JSON.stringify(file) + '\n');
    console.log(
      `Rates: ${file.source}, ${file.date}, ${Object.keys(file.rates).length} currencies`,
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
