// Health check for the watchdog (stats-worker, every 5 minutes) and for deploy smoke
// tests: the database answers and the login service is configured. 200 when all's
// well, 503 otherwise. Says nothing about users or data.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { db } from '../../lib/sync';

export const prerender = false;

export const GET: APIRoute = async () => {
  const checks: Record<string, boolean> = {};
  const started = Date.now();
  try {
    checks.database = (await db().prepare('select 1 as ok').first<{ ok: number }>())?.ok === 1;
  } catch {
    checks.database = false;
  }
  checks.auth = !!env.BETTER_AUTH_SECRET;
  const ok = Object.values(checks).every(Boolean);
  return new Response(JSON.stringify({ ok, checks, ms: Date.now() - started, at: Date.now() }), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
