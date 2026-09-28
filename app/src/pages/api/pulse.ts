// The home page's live strip, polled every minute by the page itself.
import type { APIRoute } from 'astro';
import { funding, gameVersion, rsiStatus } from '../../lib/live';

export const prerender = false;

export const GET: APIRoute = async () => {
  const [v, s, f] = await Promise.all([gameVersion(), rsiStatus(), funding()]);
  const today = f.value?.days.at(-1) ?? null;
  return new Response(
    JSON.stringify({
      version: v.value?.version ?? null,
      status: s.value?.summary ?? null,
      systems: s.value?.systems ?? [],
      fundingTotal: f.value?.total ?? null,
      citizens: f.value?.citizens ?? null,
      fundingToday: today?.amount ?? null,
      at: Date.now(),
    }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
};
