// Extension sync, with a Bearer sync token:
//   POST   → store this hangar (the same JSON as the extension's backup file)
//   GET    → when it last synced
//   DELETE → disconnect this extension (revokes its token)
import type { APIRoute } from 'astro';
import { MAX_PAYLOAD, corsHeaders, db, json, sha256, userForToken } from '../../lib/sync';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) });

export const GET: APIRoute = async ({ request }) => {
  const who = await userForToken(request);
  if (!who) return json(request, { error: 'not connected' }, 401);
  const row = await db()
    .prepare('select synced_at, size from hangar_snapshot where user_id = ?')
    .bind(who.user_id)
    .first<{ synced_at: number; size: number }>();
  return json(request, { synced_at: row?.synced_at ?? null, size: row?.size ?? 0 });
};

export const POST: APIRoute = async ({ request }) => {
  const who = await userForToken(request);
  if (!who) return json(request, { error: 'not connected' }, 401);
  const text = await request.text();
  if (text.length > MAX_PAYLOAD) return json(request, { error: 'too large' }, 413);
  let data: { app?: string; sources?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return json(request, { error: 'not JSON' }, 400);
  }
  if (!data || typeof data !== 'object' || !data.sources) {
    return json(request, { error: 'not an Open Hangar export' }, 400);
  }
  const now = Date.now();
  await db()
    .prepare(
      `insert into hangar_snapshot (user_id, synced_at, size, payload) values (?, ?, ?, ?)
       on conflict (user_id) do update set synced_at = excluded.synced_at, size = excluded.size, payload = excluded.payload`,
    )
    .bind(who.user_id, now, text.length, text)
    .run();
  return json(request, { ok: true, synced_at: now });
};

export const DELETE: APIRoute = async ({ request }) => {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (m) await db().prepare('delete from sync_token where token_hash = ?').bind(await sha256(m[1])).run();
  return json(request, { ok: true });
};
