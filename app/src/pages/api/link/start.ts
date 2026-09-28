// Extension: "Connect to openhangar.space" → a code pair. Show user_code to the
// person; keep device_code secret and poll /api/link/poll with it.
import type { APIRoute } from 'astro';
import { LINK_TTL_MS, corsHeaders, db, json, randomToken, userCode } from '../../../lib/sync';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) });

export const POST: APIRoute = async ({ request, url }) => {
  const now = Date.now();
  await db().prepare('delete from device_code where expires_at < ?').bind(now).run();
  const device = randomToken();
  const code = userCode();
  await db()
    .prepare('insert into device_code (device_code, user_code, created_at, expires_at) values (?, ?, ?, ?)')
    .bind(device, code, now, now + LINK_TTL_MS)
    .run();
  return json(request, {
    device_code: device,
    user_code: code,
    verification_uri: `${url.origin}/link`,
    expires_in: LINK_TTL_MS / 1000,
    interval: 3,
  });
};
