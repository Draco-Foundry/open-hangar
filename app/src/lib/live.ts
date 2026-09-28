// Live Star Citizen data for the home page. Every source is public and
// read-only; results are cached in D1 (live_cache) with a short TTL, and a stale
// copy is served if a source is down.
import { db } from './sync';

const UA = {
  'user-agent': 'OpenHangar/1.0 (+https://openhangar.space)',
  accept: 'application/json',
};

async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<{ value: T | null; at: number | null; stale: boolean }> {
  const row = await db()
    .prepare('select value, fetched_at from live_cache where key = ?')
    .bind(key)
    .first<{ value: string; fetched_at: number }>();
  if (row && Date.now() - row.fetched_at < ttlMs)
    return { value: JSON.parse(row.value), at: row.fetched_at, stale: false };
  try {
    const value = await load();
    const now = Date.now();
    await db()
      .prepare(
        `insert into live_cache (key, value, fetched_at) values (?, ?, ?)
         on conflict (key) do update set value = excluded.value, fetched_at = excluded.fetched_at`,
      )
      .bind(key, JSON.stringify(value), now)
      .run();
    return { value, at: now, stale: false };
  } catch {
    return row
      ? { value: JSON.parse(row.value), at: row.fetched_at, stale: true }
      : { value: null, at: null, stale: true };
  }
}

// Live game build, from the Star Citizen Wiki ("4.10.1-LIVE.12660092").
export type GameVersion = { code: string; version: string; released: string | null };
export const gameVersion = () =>
  cached<GameVersion>('version', 30 * 60e3, async () => {
    const res = await fetch('https://api.star-citizen.wiki/api/v2/game-versions', { headers: UA });
    const list =
      (
        (await res.json()) as {
          data?: { code: string; is_default?: boolean; released_at?: string }[];
        }
      ).data || [];
    const cur = list.find((v) => v.is_default) || list[0];
    if (!cur) throw new Error('no version');
    return {
      code: cur.code,
      version: (cur.code.match(/^\d+\.\d+(?:\.\d+)?/) || [cur.code])[0],
      released: cur.released_at || null,
    };
  });

// RSI service status (status.robertsspaceindustries.com).
export type ServiceStatus = { summary: string; systems: { name: string; status: string }[] };
export const rsiStatus = () =>
  cached<ServiceStatus>('status', 2 * 60e3, async () => {
    const res = await fetch('https://status.robertsspaceindustries.com/index.json', {
      headers: UA,
    });
    const j = (await res.json()) as {
      summaryStatus?: string;
      systems?: { name: string; status: string }[];
    };
    return {
      summary: j.summaryStatus || 'unknown',
      systems: (j.systems || []).map((s) => ({ name: s.name, status: s.status })),
    };
  });

// Crowdfunding: all-time total, citizens, and daily totals for the last days.
export type Funding = { total: number; citizens: number; days: { date: string; amount: number }[] };
export const funding = () =>
  cached<Funding>('funding', 10 * 60e3, async () => {
    const res = await fetch('https://robertsspaceindustries.com/api/stats/getCrowdfundStats', {
      method: 'POST',
      headers: { ...UA, 'content-type': 'application/json' },
      body: JSON.stringify({ chart: 'day', fans: true, funds: true, fleet: false, alpha: false }),
    });
    const d = (
      (await res.json()) as {
        data?: { funds?: number; fans?: number; chart?: Record<string, { gross: string }> };
      }
    ).data;
    if (!d || !d.funds) throw new Error('no funding data');
    const days = Object.entries(d.chart || {})
      .map(([date, v]) => ({ date, amount: Number(v.gross) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { total: d.funds / 100, citizens: d.fans || 0, days };
  });

// Latest Comm-Links. RSI has no public feed; this community mirror of the
// Comm-Link list (leonick.se) is credited on the page.
export type NewsItem = { title: string; url: string; date: string };
export const commLinks = () =>
  cached<NewsItem[]>('news', 15 * 60e3, async () => {
    const res = await fetch('https://leonick.se/feeds/rsi/atom', {
      headers: { ...UA, accept: 'application/atom+xml' },
    });
    const xml = await res.text();
    const items: NewsItem[] = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const title = (e.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1];
      const url = (e.match(/<link[^>]*href=['"]([^'"]+)['"]/) || [])[1];
      const date = (e.match(/<(?:published|updated)>([^<]+)</) || [])[1];
      if (title && url && /^https:\/\/robertsspaceindustries\.com\//.test(url)) {
        items.push({ title: title.trim(), url, date: date || '' });
      }
      if (items.length >= 8) break;
    }
    if (!items.length) throw new Error('no news');
    return items;
  });

// Ship list changes (new ships, price changes). The public list is the weekly
// snapshot the extension ships with; compare it to our last copy at most every
// 6 hours and record what changed.
const CATALOG_URL =
  'https://raw.githubusercontent.com/Draco-Foundry/open-hangar/main/src/data/ship-catalog.json';
export async function refreshShipChanges() {
  const last = await cached<{ ok: true }>('ships-checked', 6 * 3600e3, async () => {
    const res = await fetch(CATALOG_URL, { headers: UA });
    const list =
      (
        (await res.json()) as {
          list?: {
            slug: string;
            name?: string;
            lname: string;
            msrp: number | null;
            status: string | null;
          }[];
        }
      ).list || [];
    if (list.length < 200) throw new Error('catalog too small');
    const { results } = await db()
      .prepare('select slug, msrp, status from ship_state')
      .all<{ slug: string; msrp: number | null; status: string | null }>();
    const known = new Map(results.map((r) => [r.slug, r]));
    const first = known.size === 0; // first run is a baseline, not "300 new ships"
    const now = Date.now();
    const stmts = [];
    for (const v of list) {
      const name = v.name || v.lname;
      const was = known.get(v.slug);
      if (!first) {
        if (!was) {
          stmts.push(
            db()
              .prepare(
                'insert into ship_change (slug, name, kind, old_value, new_value, at) values (?, ?, ?, ?, ?, ?)',
              )
              .bind(v.slug, name, 'new', null, v.msrp == null ? null : String(v.msrp), now),
          );
        } else {
          if ((was.msrp ?? null) !== (v.msrp ?? null)) {
            stmts.push(
              db()
                .prepare(
                  'insert into ship_change (slug, name, kind, old_value, new_value, at) values (?, ?, ?, ?, ?, ?)',
                )
                .bind(
                  v.slug,
                  name,
                  'price',
                  was.msrp == null ? null : String(was.msrp),
                  v.msrp == null ? null : String(v.msrp),
                  now,
                ),
            );
          }
          if ((was.status ?? null) !== (v.status ?? null) && v.status) {
            stmts.push(
              db()
                .prepare(
                  'insert into ship_change (slug, name, kind, old_value, new_value, at) values (?, ?, ?, ?, ?, ?)',
                )
                .bind(v.slug, name, 'status', was.status, v.status, now),
            );
          }
        }
      }
      stmts.push(
        db()
          .prepare(
            `insert into ship_state (slug, name, msrp, status, seen_at) values (?, ?, ?, ?, ?)
             on conflict (slug) do update set name = excluded.name, msrp = excluded.msrp, status = excluded.status, seen_at = excluded.seen_at`,
          )
          .bind(v.slug, name, v.msrp, v.status, now),
      );
    }
    for (let i = 0; i < stmts.length; i += 90) await db().batch(stmts.slice(i, i + 90));
    return { ok: true as const };
  });
  return last;
}

export type ShipChange = {
  name: string;
  kind: string;
  old_value: string | null;
  new_value: string | null;
  at: number;
};
export async function recentShipChanges(limit = 8) {
  const { results } = await db()
    .prepare(
      'select name, kind, old_value, new_value, at from ship_change order by at desc, id desc limit ?',
    )
    .bind(limit)
    .all<ShipChange>();
  return results;
}

// Newest concept ships in the list (no dates in the source, so by price).
export async function conceptShips(limit = 5) {
  const { results } = await db()
    .prepare(
      "select name, msrp from ship_state where status = 'in-concept' and msrp is not null order by msrp desc limit ?",
    )
    .bind(limit)
    .all<{ name: string; msrp: number }>();
  return results;
}
