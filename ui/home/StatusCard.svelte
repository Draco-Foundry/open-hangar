<script>
  // Game Status: LIVE from star-citizen.wiki (with its release date, "13 days ago");
  // test channels (PTU / EPTU) from the starcitizen.tools main page, with the wave
  // and date of its newest notes from RSI's Patch Notes forum; a link to the newest
  // patch notes thread.
  import { live, OH } from '../lib/app.svelte.js';
  import { daysAgo, daysAgoUTC, shortDateUTC, wikiUrl } from '../lib/format.js';

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
      >Latest patch notes →</a
    >
  {/if}
  {#if !live.loaded}
    <div class="row"><span class="oh-muted">Loading…</span></div>
  {/if}
</section>

<style>
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
