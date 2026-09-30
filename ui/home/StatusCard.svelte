<script>
  // Game Status: LIVE from star-citizen.wiki; test channels (PTU / EPTU) from the
  // starcitizen.tools main page, with the wave from RSI's Patch Notes forum; a link
  // to the newest patch notes thread.
  import { live, OH } from '../lib/app.svelte.js';
  import { wikiUrl } from '../lib/format.js';

  const d = $derived.by(() => {
    const patches = (live.main && live.main.patches) || [];
    const livePatch = patches.find((p) => p.channel === 'LIVE') || {};
    return {
      live: live.live || livePatch.name || '',
      livePage: livePatch.page || '',
      tests: patches
        .filter((p) => p.channel !== 'LIVE')
        .map((p) => ({ ...p, wave: OH().patchWave(live.patches, p.name) })),
      newest: live.patches[0] || null,
    };
  });
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Game Status</h3></div>
  {#if d.live}
    <div class="oh-kv">
      <span><span class="dot"></span>LIVE</span>
      <span class="v"
        >{#if d.livePage}<a href={wikiUrl(d.livePage)} target="_blank" rel="noopener"><b>{d.live}</b></a
          >{:else}<b>{d.live}</b>{/if}</span
      >
    </div>
  {/if}
  {#each d.tests as t (t.channel)}
    <div class="oh-kv">
      <span><span class="dot test"></span>{t.channel}</span>
      <span class="v"
        >{#if t.page}<a href={wikiUrl(t.page)} target="_blank" rel="noopener"><b>{t.name}</b></a
          >{:else}<b>{t.name}</b>{/if}{t.wave ? ` · ${t.wave}` : ''}</span
      >
    </div>
  {/each}
  {#if d.newest}
    <div class="oh-kv">
      <a href={d.newest.url} target="_blank" rel="noopener" title={d.newest.title}>Latest patch notes →</a>
    </div>
  {/if}
  {#if !live.loaded}
    <div class="oh-kv"><span class="oh-muted">Loading…</span></div>
  {/if}
</section>

<style>
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
  a b {
    color: var(--head);
  }
</style>
