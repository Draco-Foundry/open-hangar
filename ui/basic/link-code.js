// Connect where the browser has no sign-in window (Firefox for Android, #764): a code
// instead, as the dashboard's Connect falls back to (src/dashboard.js siteConnect). The
// website's code page opens with the code in its address and fills it in only when this
// extension says it's the one it's waiting for (src/background.js oh-link-check), so the
// code, the site's origin and when it runs out wait in session storage
// (siteLinkPending) until then. The device code never leaves this page. Approved, the
// new link comes back unsaved, so the account-switch question (./hub.svelte.js connect)
// still comes before anything is replaced.
import { signInWindow } from './sign-in.js';

// → { link } once approved; { expired: true } when the code ran out or was refused on
// the website (both read "expired" from /api/link/poll); { cancelled: true } when
// shouldGo turned false. Throws when /api/link/start fails.
export async function linkByCode({ OH, base, session, open, show, shouldGo = () => true }) {
  const start = await OH.siteLinkStart();
  const code = String(start.user_code || '');
  // Always this site's own code page, never an address the answer names.
  const url = `${base}/link?code=${encodeURIComponent(code)}`;
  const until = Date.now() + (start.expires_in || 600) * 1000;
  const pending = { code, origin: new URL(url).origin, until };
  // Best effort: without it the page just leaves the code for the pilot to type.
  await session?.set({ siteLinkPending: pending }).catch(() => {});
  show({ code, url });
  open(url);
  try {
    const link = await OH.siteLinkWait(start, shouldGo, { save: false });
    if (link) return { link };
    return shouldGo() ? { expired: true } : { cancelled: true };
  } finally {
    // Done with it, unless a newer one took over.
    const { siteLinkPending: now } =
      (await session?.get('siteLinkPending').catch(() => ({}))) || {};
    if (now && now.code === pending.code) await session.remove('siteLinkPending').catch(() => {});
  }
}

// Connect's link: the sign-in window (./sign-in.js), or a code when there's no window
// here. → what either gives back, with `sync` only from the window.
export async function connectLink({ base, identity, fetch, log, ...code }) {
  const got = await signInWindow({ base, identity, fetch, log });
  if (got) return got;
  return linkByCode({ base, ...code });
}
