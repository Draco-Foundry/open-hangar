<script>
  // A ship's window: its specs, the store, what it comes with, loaners, links, and
  // your copies of it (pledges and buy-backs).
  import { app, version } from '../lib/app.svelte.js';
  import Row from './Row.svelte';
  import Reclaim from './Reclaim.svelte';
  import RsiCart from './RsiCart.svelte';

  let { v, onChange } = $props();

  const link = $derived(v.store && v.store.link);
  // In Store Now: the ship's own store page, asked once it shows ("Checking…" till then).
  $effect(() => {
    if (link) app().store.checkStock([link]);
  });
  const stock = $derived.by(() => {
    version.n;
    return link ? app().store.stock(link) : null;
  });

  function toggleWish() {
    app().detail.toggleWish(v.title);
    onChange(); // the label changes now, not on the next redraw
  }
</script>

<div class="modal-info">
  <h3 class="modal-name">{v.title}</h3>
  <div class="modal-meta">
    {#if v.status}<span class="badge {v.status.cls}">{v.status.text}</span>{/if}{#if v.msrp}<span
        class="modal-val">{v.msrp}</span
      >{/if}
  </div>
  <button type="button" class="mk-btn wish-btn" data-wish-toggle={v.title} onclick={toggleWish}
    >{v.wished ? 'Remove from Wishlist' : 'Add to Wishlist'}</button
  >
  {#if v.mfr}<Row k="Manufacturer">{v.mfr}</Row>{/if}
  {#if v.role}<Row k="Role">{v.role}</Row>{/if}
  {#if v.size}<Row k="Size">{v.size}</Row>{/if}
  {#if v.crew}<Row k="Crew">{v.crew}</Row>{/if}
  {#if v.cargo}<Row k="Cargo">{v.cargo}</Row>{/if}
  {#if v.store}
    <Row k="In store now">
      {#if link}
        <a
          class="sale {stock ? stock.cls : ''}"
          href={link}
          target="_blank"
          rel="noopener"
          title={stock ? stock.title : undefined}>{stock ? stock.text : 'Checking…'}</a
        >
      {:else}<span class="muted">—</span>{/if}
    </Row>
  {/if}
  {#if v.upgrade}
    {#key v.upgrade.toSkuId}<RsiCart kind="upgrade" target={v.upgrade} />{/key}
  {/if}
  {#if v.comesWith}
    <Row k="Comes with">
      {#each v.comesWith as t, i (i)}{#if i}{', '}{/if}<button
          type="button"
          class="ship-link"
          data-ship={t.name}>{t.text}</button
        >{/each}
    </Row>
  {/if}
  {#if v.loaners}
    <Row k="Loaners">
      {#each v.loaners as l, i (i)}{#if i}{', '}{/if}<button
          type="button"
          class="ship-link"
          data-ship={l}>{l}</button
        >{/each}
    </Row>
  {/if}
  <Row k="Links">
    <a
      href="https://robertsspaceindustries.com/ship-matrix/search?q={v.q}"
      target="_blank"
      rel="noopener"
      class="bb-reclaim">RSI ↗</a
    >
    ·
    <a
      href="https://starcitizen.tools/index.php?search={v.q}"
      target="_blank"
      rel="noopener"
      class="bb-reclaim">Wiki ↗</a
    >
    ·
    <a
      href="https://www.erkul.games/live/calculator"
      target="_blank"
      rel="noopener"
      class="bb-reclaim">Erkul ↗</a
    >
  </Row>
  <h4 class="modal-h">In Your Hangar ({v.pledges.length})</h4>
  {#if v.pledges.length}
    <table class="modal-contents">
      <tbody>
        {#each v.pledges as p, i (i)}
          <tr>
            <td><button type="button" class="ship-link" data-open-item={p.id}>{p.name}</button></td>
            <td class="num">{p.value}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">Not in your hangar.</p>
  {/if}
  {#if v.bbs.length}
    <h4 class="modal-h">In Your Buy-Backs ({v.bbs.length})</h4>
    <table class="modal-contents">
      <tbody>
        {#each v.bbs as b, i (i)}
          <tr>
            <td><button type="button" class="ship-link" data-open-bb={b.id}>{b.name}</button></td>
            <td class="num"><Reclaim r={b.reclaim} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#if !v.known}<p class="muted">No ship data for this name yet.</p>{/if}
</div>
