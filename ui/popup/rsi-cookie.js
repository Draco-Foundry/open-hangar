// Signed in to RSI? The popup asks the browser whether RSI's sign-in cookie is there,
// and nothing more (the privacy policy's cookies bullet): never its value, never stored
// or sent, and RSI isn't asked anything. The cookie is the one RSI keeps your session in
// (Rsi-Token, src/data/parser-rules.json `cart.cookie`: the session cookie Log Out of RSI
// clears, src/lib.js OH.logout). Without it you're signed out for sure; with it you may
// be signed in (RSI decides when a scan reads your account).
//
// What the popup does with it (./Popup.svelte): signed out for sure, Log In to RSI with
// Scan greyed out; once the cookie is back, Scan again. The check runs when the popup
// opens and again whenever a cookie changes while it's open (a sign-in or a sign-out in
// another tab). When a popup sees the cookie gone it notes the time in session storage
// (`rsiCookieGone`, a number, nothing of the cookie), so the next popup knows the cookie
// it finds came back after the last scan said signed out.

const RSI = 'https://robertsspaceindustries.com';
export const GONE_KEY = 'rsiCookieGone';
// The cookie's name, from the parser rules (window.OHRules, src/parser-rules.js).
export const cookieName = () => globalThis.OHRules?.cart?.cookie || 'Rsi-Token';

// → 'in' (the cookie is in this browser), 'out' (it isn't), or null (this browser can't
// tell: no cookies API, no access to RSI, or the ask failed). Only whether it's there is
// looked at.
export async function rsiCookie(api = globalThis.chrome?.cookies, { access = true } = {}) {
  if (!access || !api || typeof api.get !== 'function') return null;
  try {
    const got = await api.get({ url: RSI, name: cookieName() });
    return got != null ? 'in' : 'out';
  } catch {
    return null;
  }
}

// What the popup shows → 'in' (Scan), 'out' (Log In to RSI, Scan greyed and off) or
// 'maybe' (Log In to RSI, a grey Scan still there to press: the last scan or account
// read said signed out, and the cookie can't say otherwise). `cookie`: rsiCookie's
// answer. `readOut`: when the last scan or account read said signed out (ms), or null.
// `goneAt`: when a popup last saw the cookie gone (ms), or null.
export function rsiSignIn({ cookie, readOut = null, goneAt = null }) {
  if (cookie === 'out') return 'out';
  if (!Number.isFinite(readOut)) return 'in';
  // The cookie came back after the last read said signed out: signed in again.
  if (cookie === 'in' && Number.isFinite(goneAt) && goneAt >= readOut) return 'in';
  return 'maybe';
}

// Watches for cookie changes while the popup is open → stop(). The browser tells about
// every cookie; this never reads what it says (not even which cookie): any change just
// asks rsiCookie again, a moment later, once.
export function watchCookie(onChange, api = globalThis.chrome?.cookies, wait = 300) {
  const ev = api?.onChanged;
  if (!ev || typeof ev.addListener !== 'function') return () => {};
  let timer = null;
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, wait);
  };
  ev.addListener(changed);
  return () => {
    clearTimeout(timer);
    ev.removeListener?.(changed);
  };
}
