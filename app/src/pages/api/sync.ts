// Extension sync, with a Bearer sync token:
//   POST   → store this hangar (the same JSON as the extension's backup file)
//   GET    → when it last synced
//   DELETE → disconnect this extension (revokes its token)
import type { APIRoute } from 'astro';
import { MAX_PAYLOAD, corsHeaders, db, json, sha256, userForToken } from '../../lib/sync';
import { latestSnapshotForUser, recordSync, rsiAccountFor } from '../../lib/accounts';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request) });

export const GET: APIRoute = async ({ request }) => {
  const who = await userForToken(request);
  if (!who) return json(request, { error: 'not connected' }, 401);
  const row = await latestSnapshotForUser(who.user_id);
  return json(request, { synced_at: row?.synced_at ?? null, size: row?.payload.length ?? 0 });
};

export const POST: APIRoute = async ({ request }) => {
  const who = await userForToken(request);
  if (!who) return json(request, { error: 'not connected' }, 401);
  const text = await request.text();
  if (text.length > MAX_PAYLOAD) return json(request, { error: 'too large' }, 413);
  let data: Parameters<typeof recordSync>[1] & { app?: string; account?: { handle?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    return json(request, { error: 'not JSON' }, 400);
  }
  if (!data || typeof data !== 'object' || !data.sources) {
    return json(request, { error: 'not an Open Hangar export' }, 400);
  }
  // Everything is kept per RSI account, so a sync has to say whose hangar it is.
  const handle = String(data.account?.handle || '').trim();
  if (!/^[\w-]{1,60}$/.test(handle)) {
    return json(
      request,
      { error: 'no RSI handle in this export; scan while signed in to RSI' },
      400,
    );
  }
  const now = Date.now();
  await recordSync(await rsiAccountFor(who.user_id, handle), data, text, now);
  return json(request, { ok: true, synced_at: now });
};

export const DELETE: APIRoute = async ({ request }) => {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (m)
    await db()
      .prepare('delete from sync_token where token_hash = ?')
      .bind(await sha256(m[1]))
      .run();
  return json(request, { ok: true });
};
