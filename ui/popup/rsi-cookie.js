// Signed in to RSI? The popup asks the browser whether RSI's sign-in cookie is there,
// and nothing more (the privacy policy's cookies bullet): never its value, never stored
// or sent, and RSI isn't asked anything. The cookie is the one RSI keeps your session in
// (Rsi-Token, src/data/parser-rules.json `cart.cookie`: the session cookie Log Out of RSI
// clears, src/lib.js OH.logout).
//
// The cookie only hints: RSI sets it for visitors who aren't signed in too (checked
// 2026-10-19), so it stays through a sign-in, and a browser can be signed in where this
// check can't see it (the owner, Firefox, 2026-10-19: Log In to RSI and no Scan while
// signed in). So it never stops a scan: the scan reads your account and says when you're
// signed out. What the popup does with it (./Popup.svelte): there, Scan; gone, Log In to
// RSI first with Scan still there to press. The check runs when the popup opens and again
// whenever a cookie changes while it's open (a sign-in or a sign-out in another tab).

const RSI = 'https://robertsspaceindustries.com';
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

// What the popup shows → 'in' (Scan) or 'maybe' (Log In to RSI, a grey Scan still there
// to press): the cookie gone, or the last scan or account read said signed out and the
// browser can't say about the cookie. `cookie`: rsiCookie's answer. `readOut`: when the
// last scan or account read said signed out (ms), or null.
export function rsiSignIn({ cookie, readOut = null }) {
  if (cookie === 'in') return 'in';
  if (cookie === 'out' || Number.isFinite(readOut)) return 'maybe';
  return 'in';
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
