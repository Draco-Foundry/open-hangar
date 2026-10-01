<script>
  // Game Status: LIVE from star-citizen.wiki (with its release date, "13 days ago");
  // test channels (PTU / EPTU) from the starcitizen.tools main page, with the wave
  // and date of its newest notes from RSI's Patch Notes forum; a link to the newest
  // patch notes thread. Under them (0.3.0, beside the Citizen Card): the event on now
  // (or the last one), a running referral bonus event, and the next buy-back token.
  import { app, live, OH, version } from '../lib/app.svelte.js';
  import { daysAgo, daysAgoUTC, daysUntil, shortDateUTC, shortDay, wikiUrl } from '../lib/format.js';

  const ev = $derived.by(() => {
    version.n;
    const a = app();
    const lib = OH();
    const main = live.main;
    const now = Date.now();
    const on = lib.activeWikiEvent(main, now);
    const e = main && main.event;
    const ended = !on && e && Number.isFinite(e.ends) && e.ends <= now ? e : null;
    const ref = a.runningEvent();
    return {
      on,
      ended,
      ref: ref
        ? { name: ref.name, reward: a.shortReward(ref.reward), full: ref.reward, end: a.parseTs(ref.end + ' 00:00:00') }
        : null,
      token: lib.nextBuybackToken(now),
    };
  });

  const d = $derived.by(() => {
    const patches = (live.main && live.main.patches) || [];
    const livePatch = patches.find((p) => p.channel === 'LIVE') || {};
    return {
      live: live.live || livePatch.name || '',
      livePage: livePatch.page || '',
      released: live.released,
      tests: patches
        .filter((p) => p.channel !== 'LIVE')
        .map((p) => {
          const notes = (live.patches || []).find((n) => n.version === p.name);
          return { ...p, wave: OH().patchWave(live.patches, p.name), at: notes ? notes.at : null };
        }),
      newest: live.patches[0] || null,
    };
  });
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Game Status</h3></div>
  {#if d.live}
    <div class="row">
      <div class="top">
        <span><span class="dot"></span>LIVE</span>
        {#if d.livePage}<a href={wikiUrl(d.livePage)} target="_blank" rel="noopener" class="ver">{d.live}</a
          >{:else}<span class="ver">{d.live}</span>{/if}
      </div>
      {#if d.released}<div class="sub">Released {shortDateUTC(d.released)} · {daysAgoUTC(d.released)}</div>{/if}
    </div>
  {/if}
  {#each d.tests as t (t.channel)}
    <div class="row">
      <div class="top">
        <span><span class="dot test"></span>{t.channel}</span>
        {#if t.page}<a href={wikiUrl(t.page)} target="_blank" rel="noopener" class="ver">{t.name}</a
          >{:else}<span class="ver">{t.name}</span>{/if}
      </div>
      <div class="sub">
        {[t.wave, t.at ? `notes ${daysAgo(t.at)}` : 'In testing'].filter(Boolean).join(' · ')}
      </div>
    </div>
  {/each}
  {#if d.newest}
    <a class="oh-more" href={d.newest.url} target="_blank" rel="noopener" title={d.newest.title}
      >Latest Patch Notes →</a
    >
  {/if}
  {#if !live.loaded}
    <div class="row"><span class="oh-muted">Loading…</span></div>
  {/if}
  <div class="evs">
    {#if ev.on}
      <div class="kv">
        <a class="evn" href={ev.on.page ? wikiUrl(ev.on.page) : undefined} target="_blank" rel="noopener" title={ev.on.text}
          >{ev.on.name}</a
        >
        <span class="v">ends <b>{daysUntil(ev.on.ends)}</b></span>
      </div>
    {:else if ev.ended}
      <div class="kv"><span class="oh-muted">Last event: {ev.ended.name}</span><span class="v">ended {shortDay(ev.ended.ends)}</span></div>
    {:else}
      <div class="kv"><span class="oh-muted">No event running. Enjoy the quiet, Citizen.</span></div>
    {/if}
    {#if ev.ref}
      <div class="kv">
        <a href="#referrals" title="{ev.ref.name}: {ev.ref.full}">Referral bonus: {ev.ref.reward}</a>
        <span class="v">until {shortDay(ev.ref.end)}</span>
      </div>
    {/if}
    {#if ev.token}
      <div class="kv">
        <span>Next Buy-Back Token</span>
        <span class="v">{shortDay(ev.token)} · <b>{daysUntil(ev.token)}</b></span>
      </div>
    {/if}
  </div>
</section>

<style>
  section {
    height: 100%;
  }
  .evs {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }
  .kv {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 7px 0;
    font-size: 14px;
  }
  .kv + .kv {
    border-top: 1px solid var(--line);
  }
  .kv a {
    color: var(--text);
    text-decoration: none;
  }
  .kv a:hover {
    color: var(--link);
  }
  .evn {
    font-weight: 600;
    color: var(--head) !important;
  }
  .v {
    white-space: nowrap;
    color: var(--muted);
    font-size: 13px;
  }
  .v b {
    color: var(--head);
  }
  .row {
    padding: 8px 0;
  }
  .row + .row {
    border-top: 1px solid var(--line);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    font-size: 14px;
  }
  .ver {
    font: 700 15px var(--font-head);
    color: var(--head) !important;
    text-decoration: none;
  }
  a.ver:hover {
    color: var(--link) !important;
    text-decoration: underline;
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
    padding-left: 17px;
  }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 9px;
    vertical-align: 1px;
    background: var(--good);
  }
  .dot.test {
    background: none;
    border: 2px solid var(--warn);
    width: 9px;
    height: 9px;
  }
</style>
