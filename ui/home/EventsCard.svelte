<script>
  // Events: the wiki's main-page event only while its dates say it's on, else
  // "Last: <event>, ended <date>" (the wiki card can stay up after an event ends);
  // a running referral bonus event; the next buy-back token.
  import { app, live, OH, version } from '../lib/app.svelte.js';
  import { daysUntil, shortDay, wikiUrl } from '../lib/format.js';

  const d = $derived.by(() => {
    version.n;
    const a = app();
    const lib = OH();
    const main = live.main;
    const now = Date.now();
    const on = lib.activeWikiEvent(main, now);
    const ev = main && main.event;
    const ended = !on && ev && Number.isFinite(ev.ends) && ev.ends <= now ? ev : null;
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
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Events</h3></div>
  {#if d.on}
    <div class="oh-kv">
      <a class="ev" href={d.on.page ? wikiUrl(d.on.page) : undefined} target="_blank" rel="noopener" title={d.on.text}
        >{d.on.name}</a
      >
      <span class="v">ends <b>{daysUntil(d.on.ends)}</b></span>
    </div>
  {:else}
    <div class="oh-kv"><span class="oh-muted">No event running right now</span></div>
  {/if}
  {#if d.ref}
    <div class="oh-kv">
      <a href="#referrals" title="{d.ref.name}: {d.ref.full}">Referral bonus: {d.ref.reward}</a>
      <span class="v">until {shortDay(d.ref.end)}</span>
    </div>
  {/if}
  {#if d.ended}
    <div class="oh-kv">
      <span class="oh-muted">Last: {d.ended.name}</span>
      <span class="v">ended {shortDay(d.ended.ends)}</span>
    </div>
  {/if}
  {#if d.token}
    <div class="oh-kv">
      <span>Buy-Back Token</span>
      <span class="v">{shortDay(d.token)} · <b>{daysUntil(d.token)}</b></span>
    </div>
  {/if}
</section>

<style>
  .ev {
    font-weight: 600;
    color: var(--head) !important;
    text-decoration: none;
  }
  .ev:hover {
    color: var(--link) !important;
    text-decoration: underline;
  }
</style>
