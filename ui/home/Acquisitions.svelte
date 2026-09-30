<script>
  // Latest Acquisitions: your newest pledges by purchase date, with picture, type,
  // insurance, price and date. A row opens the pledge's details window.
  import { SvelteMap } from 'svelte/reactivity';
  import { app, OH, version } from '../lib/app.svelte.js';
  import { shortDay } from '../lib/format.js';

  const a = app();
  const rows = $derived.by(() => {
    version.n;
    return a.state.items
      .map((p) => ({ p, t: Date.parse(p.date) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((x, y) => y.t - x.t)
      .slice(0, 5)
      .map(({ p, t }) => {
        const type = a.pledgeType(p);
        return {
          id: String(p.id),
          name: a.cardName(p),
          full: a.plainName(p),
          type,
          typeClass: a.typeKeys.includes(type) ? type : '',
          ins: p.insurance && p.insurance !== 'Unknown' ? p.insurance : '',
          price: Number.isFinite(p.value) ? a.formatValue(p) : '',
          day: shortDay(t),
          img: a.realImage(p.image),
          resolve: a.resolveImageName(p),
        };
      });
  });
  // Pledges without an RSI picture get the ship's wiki art (like Inventory cards).
  const art = new SvelteMap();
  $effect(() => {
    for (const r of rows) {
      if (r.img || !r.resolve || art.has(r.resolve)) continue;
      art.set(r.resolve, '');
      OH()
        .getShipImage(r.resolve)
        .then((url) => url && art.set(r.resolve, url));
    }
  });
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Latest Acquisitions</h3></div>
  {#each rows as r (r.id)}
    <button type="button" class="li" onclick={() => a.openItem(r.id)} title={r.full}>
      {#if r.img || art.get(r.resolve)}
        <img class="th" src={r.img || art.get(r.resolve)} alt="" loading="lazy" />
      {:else}
        <span class="th"></span>
      {/if}
      <span class="nm">
        <span class="n">{r.name}</span>
        <span class="sub"><span class="badge {r.typeClass}">{r.type}</span>{#if r.ins}<span class="ins">{r.ins}</span>{/if}</span>
      </span>
      <span class="meta">{#if r.price}<b>{r.price}</b>{/if}{r.day}</span>
    </button>
  {/each}
  <a class="oh-more" href="#inventory">All pledges →</a>
</section>

<style>
  .li {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    width: calc(100% + 16px);
    margin-inline: -8px;
    padding: 9px 8px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .li:hover {
    background: var(--panel-2);
  }
  .li + .li {
    box-shadow: 0 -1px 0 var(--line);
  }
  .th {
    width: 64px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--panel-2);
  }
  .nm {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .n {
    font-weight: 600;
    color: var(--head);
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .ins {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .meta {
    text-align: right;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .meta b {
    display: block;
    color: var(--text);
    font-weight: 600;
  }
  @media (max-width: 480px) {
    .li {
      grid-template-columns: 52px minmax(0, 1fr);
    }
    .th {
      width: 52px;
      height: 34px;
      grid-row: span 2;
    }
    .meta {
      grid-column: 2;
      text-align: left;
    }
    .meta b {
      display: inline;
      margin-right: 6px;
    }
  }
</style>
