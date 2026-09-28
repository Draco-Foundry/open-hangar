// Save the Appearance choice: always as a cookie (this browser), and on the
// account too when signed in (so it follows you to other devices).
import type { APIRoute } from 'astro';
import { getAuth } from '../../lib/auth';
import { db } from '../../lib/sync';
import { readTheme } from '../../lib/theme';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = (await request.json().catch(() => ({}))) as { theme?: string };
  const t = readTheme(body.theme);
  const value = `${t.palette}.${t.font}.${t.style}`;
  cookies.set('oh_theme', value, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  const got = await getAuth().api.getSession({ headers: request.headers });
  if (got?.user) {
    await db()
      .prepare(
        `insert into user_pref (user_id, theme, updated_at) values (?, ?, ?)
         on conflict (user_id) do update set theme = excluded.theme, updated_at = excluded.updated_at`,
      )
      .bind(got.user.id, value, Date.now())
      .run();
  }
  return new Response(JSON.stringify({ theme: value, saved: Boolean(got?.user) }), {
    headers: { 'content-type': 'application/json' },
  });
};
