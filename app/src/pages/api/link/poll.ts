// Extension polls with its device_code. Once the person approved the code on
// /link, this returns a sync token exactly once and deletes the pending code.
import type { APIRoute } from 'astro';
import { corsHeaders, db, json, randomToken, sha256 } from '../../../lib/sync';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) });

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { device_code?: string; label?: string };
  if (!body.device_code) return json(request, { error: 'missing device_code' }, 400);
  const row = await db()
    .prepare('select user_id, expires_at, approved_at from device_code where device_code = ?')
    .bind(body.device_code)
    .first<{ user_id: string | null; expires_at: number; approved_at: number | null }>();
  if (!row || row.expires_at < Date.now()) return json(request, { status: 'expired' }, 410);
  if (!row.approved_at || !row.user_id) return json(request, { status: 'pending' });

  const token = randomToken();
  await db().batch([
    db()
      .prepare('insert into sync_token (id, user_id, token_hash, label, created_at) values (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), row.user_id, await sha256(token), String(body.label || 'Open Hangar extension').slice(0, 60), Date.now()),
    db().prepare('delete from device_code where device_code = ?').bind(body.device_code),
  ]);
  const user = await db().prepare('select name, email from "user" where id = ?').bind(row.user_id).first<{ name: string; email: string }>();
  return json(request, { status: 'approved', token, name: user?.name || user?.email || '' });
};
