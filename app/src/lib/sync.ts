// Linking an extension (device-code flow) and syncing its data.
import { env } from 'cloudflare:workers';

export const LINK_TTL_MS = 10 * 60 * 1000; // a code is good for 10 minutes
export const MAX_PAYLOAD = 5 * 1024 * 1024; // 5 MB per sync, well above a big hangar

// Short, unambiguous code a person types: "K7Q-4PX" (no 0/O/1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function userCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const c = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}
export const normalizeCode = (s: string) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^(.{3})(.{3})$/, '$1-$2');

export function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const db = () => env.DB;

// The user a sync token belongs to (and touch last_used_at), or null.
export async function userForToken(request: Request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const hash = await sha256(m[1]);
  const row = await db()
    .prepare('select id, user_id from sync_token where token_hash = ?')
    .bind(hash)
    .first<{ id: string; user_id: string }>();
  if (!row) return null;
  await db().prepare('update sync_token set last_used_at = ? where id = ?').bind(Date.now(), row.id).run();
  return row;
}

// Extensions call from chrome-extension:// or moz-extension:// pages.
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const ok = /^(chrome|moz)-extension:\/\/[a-z0-9-]+$/i.test(origin);
  return ok
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '600',
        vary: 'origin',
      }
    : {};
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request) },
  });
}
