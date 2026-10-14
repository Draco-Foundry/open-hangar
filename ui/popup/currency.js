// The popup's Currency (Settings): amounts in your currency, converted from US dollars
// at the day's rate. RSI charges in US dollars, so each converted amount keeps the
// dollar figure on hover (its title). The rates are the ECB's, from openhangar.space's
// rates.json (OH.getFxRates: at most once a day, kept in `fxRates`), read only for a
// currency other than USD. Until you pick one, the currency is your browser's language's
// (US English: USD). Pure apart from loadRates.

// The currencies the popup offers: OH.CURRENCIES in src/lib.js, in its order
// (test/popup-settings.test.js keeps them the same).
export const CURRENCIES = [
  'USD',
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
const ZERO_DECIMAL = ['JPY', 'KRW']; // no cents (OH.ZERO_DECIMAL)

// The euro's countries, and the other regions with a currency here.
const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const REGION = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  LI: 'CHF',
  SE: 'SEK',
  PL: 'PLN',
  CZ: 'CZK',
  BR: 'BRL',
  CN: 'CNY',
  JP: 'JPY',
  KR: 'KRW',
};
// The browser's language ("en-US", "de-DE", "fr") → its currency, else USD. A language
// with no country is read as its most likely one ("de" → Germany).
export function currencyFor(language) {
  let region = '';
  try {
    const loc = new Intl.Locale(String(language || 'en-US'));
    region = loc.region || loc.maximize().region || '';
  } catch {
    return 'USD';
  }
  if (EURO.includes(region)) return 'EUR';
  return REGION[region] || 'USD';
}
// The currency shown: the one picked in Settings, else the browser's language's.
export const shownCurrency = (picked, language = globalThis.navigator?.language) =>
  CURRENCIES.includes(picked) ? picked : currencyFor(language);

// The rate to use: { code, rate, date } (US dollars, rate 1, until a picked currency's
// rate is in).
export const USD = Object.freeze({ code: 'USD', rate: 1, date: null });
export function fxFor(code, rates) {
  if (code === 'USD' || !CURRENCIES.includes(code)) return USD;
  const r = rates?.rates?.[code];
  return typeof r === 'number' && r > 0 ? { code, rate: r, date: rates.date || null } : USD;
}
// The day's rates, only for a currency other than USD (none is asked for USD).
export async function loadRates(code, getFxRates = globalThis.OH?.getFxRates) {
  if (code === 'USD' || !CURRENCIES.includes(code) || typeof getFxRates !== 'function') return null;
  try {
    return (await getFxRates()) || null;
  } catch {
    return null;
  }
}

// An amount in US dollars → { text, title }: `text` in the shown currency, `title` the
// dollar figure when it's converted ('' in dollars). `cents`: always two decimals (Store
// Credit); otherwise none for a big total, up to `most`.
export function money(usd, fx = USD, { cents = false, most } = {}) {
  if (!Number.isFinite(usd)) return { text: '', title: '' };
  const fmt = (n, code) => {
    const top = most ?? (Math.abs(n) >= 1000 ? 0 : 2);
    const max = ZERO_DECIMAL.includes(code) ? 0 : cents ? 2 : top;
    const min = ZERO_DECIMAL.includes(code) ? 0 : cents ? 2 : Math.min(2, top);
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: max,
      minimumFractionDigits: min,
    });
  };
  const dollars = fmt(usd, 'USD');
  if (fx.code === 'USD') return { text: dollars, title: '' };
  return { text: fmt(usd * fx.rate, fx.code), title: dollars };
}
