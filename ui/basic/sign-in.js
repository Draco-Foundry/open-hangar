// Connect's sign-in window (ui/basic/hub.svelte.js connect): the browser's own window
// on the website's /connect, where you press Approve. PKCE: the verifier never leaves
// this page, and the one-time code comes back on the address the browser catches for
// this extension (identity.getRedirectURL), never through a web page, so no script on
// a page can read it or hand in another (connect hardening, #669). Chrome and Edge:
// chrome.identity; Firefox: browser.identity, whose address the website allows too.
// → { link, sync } once approved and traded for the sync token; { cancelled: true }
// when the window was closed or Cancel pressed; { failed: true } when the trade
// failed; or null when there's no window to open here (then a code instead,
// ./link-code.js).
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function signInWindow({ base, identity, fetch = globalThis.fetch, log = () => {} }) {
  if (!identity?.launchWebAuthFlow || !identity.getRedirectURL) return null;
  const redirect = identity.getRedirectURL();
  const verifier = random(32);
  const state = random(16);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const url = `${base}/connect?${new URLSearchParams({
    response_type: 'code',
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
    state,
    redirect_uri: redirect,
  })}`;
  let back;
  try {
    back = await identity.launchWebAuthFlow({ url, interactive: true });
  } catch (err) {
    // Closing the window reads as "did not approve" (Chrome) or "cancelled" (Firefox).
    if (/approve|cancel|denied|closed/i.test(String(err?.message || err)))
      return { cancelled: true };
    log(`sign-in window: ${err?.message || err}`);
    return null;
  }
  // Only the address this extension's window was sent back to, with this window's state.
  let answer;
  try {
    const u = new URL(back);
    if (!String(back).startsWith(redirect)) return { cancelled: true };
    answer = u.searchParams;
  } catch {
    return { cancelled: true };
  }
  if (answer.get('state') !== state || answer.get('error') || !answer.get('code'))
    return { cancelled: true };
  const res = await fetch(`${base}/api/link/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: answer.get('code'),
      code_verifier: verifier,
      redirect_uri: redirect,
    }),
  }).catch(() => null);
  if (!res || !res.ok) return { failed: true };
  const j = await res.json().catch(() => null);
  if (!j?.token) return { failed: true };
  const link = { token: j.token, name: j.name || '', connectedAt: Date.now(), lastSync: null };
  return { link, sync: answer.get('sync') === '1' };
}
