// Watchdog (docs/WEBSITE-PLAN.md → Backend Foundation step 4), every 5 minutes.
// Posts to Discord once when a check starts failing (after two misses in a row, so a
// blip doesn't page anyone) and once when it recovers, with how long it was down.
//   site:  app.openhangar.space/api/health answers 200 (database + login set up).
//          Players feel this one, so it goes to #status too.
//   stats: today's store-stats snapshot exists by 14:00 UTC (#ops only).
// Webhooks: DISCORD_OPS_WEBHOOK / DISCORD_STATUS_WEBHOOK (Worker secrets, put by the
// deploy workflow). Without them it still records state, it just can't post.

const SITE = 'https://app.openhangar.space/api/health';
const FAILS_TO_ALERT = 2;

async function checkSite() {
  try {
    const res = await fetch(SITE, { signal: AbortSignal.timeout(10000), cf: { cacheTtl: 0 } });
    if (res.status === 200) return { ok: true };
    let why = `answered ${res.status}`;
    try {
      const j = await res.json();
      const bad = Object.entries(j.checks || {})
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (bad.length) why += ` (${bad.join(', ')} failing)`;
    } catch {
      /* not JSON */
    }
    return { ok: false, why };
  } catch (e) {
    return {
      ok: false,
      why: e.name === 'TimeoutError' ? 'no answer in 10s' : String(e.message || e),
    };
  }
}

async function checkStats(env, now) {
  if (new Date(now).getUTCHours() < 14) return { ok: true }; // the job runs at 13:00 UTC
  const today = new Date(now).toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT date FROM snapshots WHERE date = ?').bind(today).first();
  return row ? { ok: true } : { ok: false, why: `no snapshot for ${today} yet` };
}

const CHECKS = [
  { key: 'site', name: 'The website (app.openhangar.space)', run: () => checkSite(), public: true },
  {
    key: 'stats',
    name: 'The daily store-stats job',
    run: (env, now) => checkStats(env, now),
    public: false,
  },
];

async function post(hook, text, color) {
  if (!hook) return;
  await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'Open Hangar',
      embeds: [{ description: text, color, timestamp: new Date().toISOString() }],
      allowed_mentions: { parse: [] },
    }),
  }).catch((e) => console.warn('discord', e.message));
}

const minutes = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export async function watchdog(env, now = Date.now()) {
  const results = {};
  for (const c of CHECKS) {
    const r = await c.run(env, now);
    results[c.key] = r;
    const prev = (await env.DB.prepare('SELECT * FROM watch WHERE key = ?')
      .bind(c.key)
      .first()) || {
      fails: 0,
      down_since: null,
      alerted: 0,
    };
    if (r.ok) {
      if (prev.alerted) {
        const took = minutes(now - prev.down_since);
        await post(env.DISCORD_OPS_WEBHOOK, `✅ ${c.name} is back (down about ${took}).`, 0x3fb950);
        if (c.public)
          await post(
            env.DISCORD_STATUS_WEBHOOK,
            `✅ Open Hangar's website is back up. Thanks for your patience.`,
            0x3fb950,
          );
      }
      await env.DB.prepare(
        'INSERT OR REPLACE INTO watch (key, fails, down_since, alerted, detail, checked_at) VALUES (?, 0, NULL, 0, NULL, ?)',
      )
        .bind(c.key, now)
        .run();
      continue;
    }
    const fails = prev.fails + 1;
    const downSince = prev.down_since || now;
    let alerted = prev.alerted;
    if (!alerted && fails >= FAILS_TO_ALERT) {
      await post(env.DISCORD_OPS_WEBHOOK, `🔴 ${c.name} is failing: ${r.why}.`, 0xf85149);
      if (c.public)
        await post(
          env.DISCORD_STATUS_WEBHOOK,
          `🔴 Open Hangar's website is having trouble right now; we're on it. The extension keeps working, only sync and sign-in are affected.`,
          0xf85149,
        );
      alerted = 1;
    }
    await env.DB.prepare(
      'INSERT OR REPLACE INTO watch (key, fails, down_since, alerted, detail, checked_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(c.key, fails, downSince, alerted, r.why, now)
      .run();
  }
  return results;
}
