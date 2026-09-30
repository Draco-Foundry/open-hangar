// RSI accounts and long-term history, filled from extension syncs.
// Schema and reasoning: migrations/0005_accounts_orgs_history.sql, docs/WEBSITE-PLAN.md.
import { db, randomToken } from './sync';

// The pledge fields history cares about, from the backup JSON's hangar items.
type Item = { id?: string | number; name?: string; value?: number };
type Snap = { at: number; items: [string, string, number][] };

const snapOf = (items: Item[], at: number): Snap => ({
  at,
  items: (items || []).map((p) => [
    String(p.id ?? ''),
    p.name || '',
    Number.isFinite(p.value) ? Number(p.value) : 0,
  ]),
});
const meltOf = (s: Snap) => s.items.reduce((a, x) => a + (x[2] || 0), 0);
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

// Same rules as the extension's OH.diffSnapshots: added / removed pledges, and
// ones whose name or value changed (an applied CCU keeps its pledge id).
export function diffSnaps(a: Snap, b: Snap) {
  const before = new Map(a.items.map((x) => [x[0], x]));
  const after = new Set(b.items.map((x) => x[0]));
  const added = b.items.filter((x) => !before.has(x[0]));
  const removed = a.items.filter((x) => !after.has(x[0]));
  const changed: { now: [string, string, number]; was: [string, string, number] }[] = [];
  for (const x of b.items) {
    const y = before.get(x[0]);
    if (y && (y[1] !== x[1] || Math.abs(y[2] - x[2]) >= 0.01)) changed.push({ now: x, was: y });
  }
  return { added, removed, changed };
}

// The RSI account this sync is for, created (unverified) the first time a login
// syncs that handle. Verification happens separately (bio code on RSI).
export async function rsiAccountFor(userId: string, handle: string) {
  const key = handle.toLowerCase();
  const found = await db()
    .prepare('select id from rsi_account where user_id = ? and handle_key = ?')
    .bind(userId, key)
    .first<{ id: string }>();
  if (found) return found.id;
  const id = crypto.randomUUID();
  await db()
    .prepare(
      'insert into rsi_account (id, user_id, handle, handle_key, verify_code, created_at) values (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, userId, handle, key, `OH-${randomToken(6)}`, Date.now())
    .run();
  return id;
}

// Store a sync: history events against the previous snapshot, today's value
// point, then the snapshot itself. On an account's first sync, the extension's
// local scan history (up to 100 snapshots) is imported as the starting history.
export async function recordSync(
  accountId: string,
  data: { sources?: { hangar?: { items?: Item[] } }; history?: Snap[] },
  text: string,
  now: number,
) {
  const d = db();
  const prev = await d
    .prepare('select payload from hangar_snapshot where rsi_account_id = ?')
    .bind(accountId)
    .first<{ payload: string }>();
  const current = snapOf(data.sources?.hangar?.items || [], now);

  // The chain of snapshots to diff: previous sync → now, or (first sync) the
  // extension's own history → now.
  let chain: { snap: Snap; source: string }[] = [];
  if (prev) {
    try {
      const p = JSON.parse(prev.payload);
      chain = [{ snap: snapOf(p?.sources?.hangar?.items || [], 0), source: 'sync' }];
    } catch {
      /* an unreadable old payload just means no diff this time */
    }
  } else if (Array.isArray(data.history)) {
    chain = data.history
      .filter((s) => s && Number.isFinite(s.at) && Array.isArray(s.items) && s.at < now)
      .sort((a, b) => a.at - b.at)
      .map((snap) => ({ snap, source: 'import' }));
  }

  const stmts: D1PreparedStatement[] = [];
  const event = d.prepare(
    `insert into pledge_event (rsi_account_id, at, kind, pledge_id, name, value, from_name, from_value, source)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const point = d.prepare(
    `insert into value_point (rsi_account_id, day, pledges, melt) values (?, ?, ?, ?)
     on conflict (rsi_account_id, day) do update set pledges = excluded.pledges, melt = excluded.melt`,
  );
  const steps = [...chain, { snap: current, source: 'sync' }];
  for (let i = 0; i < steps.length; i++) {
    const { snap, source } = steps[i];
    const at = snap.at || now;
    if (i > 0) {
      const diff = diffSnaps(steps[i - 1].snap, snap);
      for (const x of diff.added)
        stmts.push(event.bind(accountId, at, 'added', x[0], x[1], x[2], null, null, source));
      for (const x of diff.removed)
        stmts.push(event.bind(accountId, at, 'removed', x[0], x[1], x[2], null, null, source));
      for (const c of diff.changed)
        stmts.push(
          event.bind(
            accountId,
            at,
            'changed',
            c.now[0],
            c.now[1],
            c.now[2],
            c.was[1],
            c.was[2],
            source,
          ),
        );
    }
    // Imported history also gives the chart its past points; a previous sync's
    // point is already stored.
    if (source === 'import' || i === steps.length - 1)
      stmts.push(point.bind(accountId, dayOf(at), snap.items.length, meltOf(snap)));
  }
  stmts.push(
    d
      .prepare(
        `insert into hangar_snapshot (rsi_account_id, synced_at, size, payload) values (?, ?, ?, ?)
         on conflict (rsi_account_id) do update set synced_at = excluded.synced_at, size = excluded.size, payload = excluded.payload`,
      )
      .bind(accountId, now, text.length, text),
    d.prepare('update rsi_account set last_synced_at = ? where id = ?').bind(now, accountId),
  );
  // History first, snapshot last (in the final chunk), so a failed run retries
  // the diff on the next sync instead of losing it.
  for (let i = 0; i < stmts.length; i += 100) await d.batch(stmts.slice(i, i + 100));
}

// The most recently synced hangar across a login's RSI accounts (pages that
// show one hangar use this until there's an account picker).
export async function latestSnapshotForUser(userId: string) {
  return db()
    .prepare(
      `select s.synced_at, s.payload, a.handle from hangar_snapshot s
       join rsi_account a on a.id = s.rsi_account_id
       where a.user_id = ? order by s.synced_at desc limit 1`,
    )
    .bind(userId)
    .first<{ synced_at: number; payload: string; handle: string }>();
}
