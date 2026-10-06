// Game Status for the top bar's pill (ui/topbar/GameStatus.svelte): LIVE and PTU
// builds, the newest patch notes, and the event on now (and the next one), from our
// own public feed at openhangar.space/api/game-status (the same JSON for everyone,
// nothing about you is sent). Asked at most once every 10 minutes and kept in
// chrome.storage; when the site doesn't answer, the last copy shows. Contract v1:
//   { v: 1, updatedAt, status: { level: 'ok'|'degraded'|'down', label, url } | null,
//     live: { version, released } | null, ptu: { version, wave, notesAt } | null,
//     patchNotes: { title, url, at } | null, event: { name, start, end, url } | null,
//     nextEvent: { … } | null }
// Dates are ISO strings; they're turned into ms here. A part we can't read is null.
export const GAME_STATUS_URL = 'https://openhangar.space/api/game-status';
const GS_KEY = 'gameStatus';
export const GAME_STATUS_TTL = 10 * 60 * 1000;

const str = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const ms = (v) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) && t > 0 ? t : null;
};
// Only links we'd show anyway: https, no credentials.
const link = (v) => {
  const s = str(v, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
};
const event = (e) =>
  e && typeof e === 'object' && str(e.name)
    ? { name: str(e.name, 120), start: ms(e.start), end: ms(e.end), url: link(e.url) }
    : null;
const LEVELS = ['ok', 'degraded', 'down'];

// The feed's JSON → what the pill shows, or null when it isn't a v1 feed. Pure.
export function shapeGameStatus(json) {
  if (!json || typeof json !== 'object' || json.v !== 1) return null;
  const s = json.status;
  const l = json.live;
  const p = json.ptu;
  const n = json.patchNotes;
  return {
    updatedAt: ms(json.updatedAt),
    status:
      s && LEVELS.includes(s.level)
        ? { level: s.level, label: str(s.label, 120) || '', url: link(s.url) }
        : null,
    live:
      l && str(l.version, 40) ? { version: str(l.version, 40), released: ms(l.released) } : null,
    ptu:
      p && str(p.version, 40)
        ? { version: str(p.version, 40), wave: str(p.wave, 40), notesAt: ms(p.notesAt) }
        : null,
    patchNotes:
      n && link(n.url)
        ? { title: str(n.title, 160) || 'Patch Notes', url: link(n.url), at: ms(n.at) }
        : null,
    event: event(json.event),
    nextEvent: event(json.nextEvent),
  };
}

// The pill's words and dot: "LIVE 4.10.1" with the services' colour, or a neutral
// "Game Status" before the feed has ever loaded. Pure.
export function pillOf(gs) {
  if (!gs) return { text: 'Game Status', dot: 'none' };
  const dot = gs.status ? gs.status.level : 'none';
  return { text: gs.live ? `LIVE ${gs.live.version}` : 'Game Status', dot };
}

// → the shaped feed (fresh, or the last saved copy), or null when it never loaded.
// `fetchFn`, `store` and `guarded` let tests swap the network and storage.
export async function loadGameStatus({
  fetchFn = typeof fetch === 'function' ? fetch : null,
  store = typeof chrome !== 'undefined' ? chrome.storage.local : null,
  guarded = typeof window !== 'undefined' && window.OH && window.OH.guarded,
  now = Date.now(),
  force = false,
} = {}) {
  let saved = null;
  try {
    saved = store ? (await store.get(GS_KEY))[GS_KEY] || null : null;
  } catch {
    saved = null;
  }
  const last = saved && saved.data ? saved.data : null;
  // Asked within the last 10 minutes (answered or not): no new request.
  if (!force && saved && now - (saved.at || 0) < GAME_STATUS_TTL) return last;
  if (!fetchFn) return last;
  let data = null;
  try {
    const get = guarded ? guarded(fetchFn) : fetchFn;
    const res = await get(GAME_STATUS_URL, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    data = res.ok ? shapeGameStatus(await res.json()) : null;
  } catch {
    data = null;
  }
  try {
    // A failed ask still counts toward the 10 minutes, so a down site isn't hammered;
    // the last good copy stays.
    if (store) await store.set({ [GS_KEY]: { at: now, data: data || last } });
  } catch {
    // Not saved: asked again next time.
  }
  return data || last;
}
