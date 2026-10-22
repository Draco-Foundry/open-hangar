// The popup's Currency (Settings): amounts in your currency, converted from US dollars
// at the day's rate. RSI charges in US dollars, so each converted amount keeps the
// dollar figure on hover (its title). The rates are the ECB's, from openhangar.space's
// rates.json (OH.getFxRates: at most once a day, kept in `fxRates`), read only for a
// currency you picked other than USD. Until you pick one, it's US dollars. Pure apart from
// loadRates.

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

// The currency shown: the one picked in Settings, else US dollars. Nothing is guessed
// from the browser: rates are read only after you pick a currency other than USD.
export const shownCurrency = (picked) => (CURRENCIES.includes(picked) ? picked : 'USD');

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

// --- Numbers that fit their box -------------------------------------------------------
// Each number on the Hangar tab has a budget: the full figure while it fits, then
// compact with one decimal at most and no ".0" ($12.4 K, 1.2 M, 3.4 B), the full figure
// kept in the tooltip and the accessible name. A non-breaking space sits between the
// digits and the letter so they never wrap apart. Measured at the popup's narrowest
// width (360 px; a card's text is about 140 px) with the card font (18 px) and the big
// number's (32 px, about 328 px wide); test:ui checks the huge cases. The budgets:
//   Account Value (32 px)         the full figure up to 999,999, then compact
//   Store Credit (18 px, cents)   the full figure up to 9,999.99, then compact
//   Since-change line (12 px)     the full figure up to 99,999, then compact
//   UEC and REC (18 px)           under 1,000 as is, then compact
//   Buy-Back Tokens (18 px)       0 to 99 as is, then 99+
// The CSS ellipsis (popup.css) is the last guard for a value nobody planned for.
export const FIT = Object.freeze({ value: 999999, credit: 9999.99, change: 99999 });
const NBSP = ' ';

// A compact-notation formatter's text for `n`, with NBSP before the suffix letter.
export function compactText(formatter, n) {
  const parts = formatter.formatToParts(n);
  return parts
    .map((p, i) =>
      p.type === 'compact' && ['integer', 'fraction'].includes(parts[i - 1]?.type)
        ? NBSP + p.value
        : p.value,
    )
    .join('');
}

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
// 950 → "950", 90,000 → "90 K", 1,200,000 → "1.2 M", 3,400,000,000 → "3.4 B"; null for
// anything that isn't a count.
export const compactCount = (n) =>
  Number.isFinite(n) && n >= 0 ? compactText(compactNumber, n) : null;

// money() that fits: `full` is the most (in the shown currency) written in full. When
// it's shortened, `title` is the full figure (with the dollar figure after it when
// converted) and `short` is true, for the accessible name.
export function moneyFit(usd, fx = USD, { cents = false, most, full = FIT.value } = {}) {
  const whole = money(usd, fx, { cents, most });
  if (!whole.text) return { ...whole, short: false };
  const shown = fx.code === 'USD' ? usd : usd * fx.rate;
  if (Math.abs(shown) <= full) return { ...whole, short: false };
  const text = compactText(
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: fx.code,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }),
    shown,
  );
  return { text, title: whole.title ? `${whole.text} (${whole.title})` : whole.text, short: true };
}
