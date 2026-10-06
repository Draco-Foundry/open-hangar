<script>
  // A buy-back's window. What's inside comes from your own hangar history when this
  // browser saw the pledge before it was melted (the small print says so), else from
  // its own RSI page, read when the window opens (Details.svelte asks) and kept.
  import Row from './Row.svelte';
  import Reclaim from './Reclaim.svelte';
  import RsiCart from './RsiCart.svelte';

  let { v, error = '' } = $props();
</script>

<div class="modal-info">
  <h3 class="modal-name">{v.name}</h3>
  <div class="modal-meta">
    <span class="badge {v.badge.cls}">{v.badge.text}</span><span class="badge muted">buy-back</span
    >{#if v.price}<span class="modal-val"
        ><span class="val" class:est={v.price.est} title={v.price.title || undefined}
          >{v.price.text}{#if v.price.est}<small class="est-l">est.</small>{/if}</span
        ></span
      >{/if}
  </div>
  {#if v.price && v.priceNote}<p class="muted bb-price-note" id="bb-price-note">
      <small>{v.priceNote}</small>
    </p>{/if}
  {#if v.upgrade}<Row k="Upgrade">{v.upgrade}</Row>{/if}
  {#if v.insurance}<Row k="Insurance">{v.insurance}</Row>{/if}
  {#if v.date}<Row k="Melted">{v.date}</Row>{/if}
  {#if v.id}<Row k="Pledge ID">{v.id}</Row>{/if}
  {#if v.reclaim}<Row k="Reclaim"><Reclaim r={v.reclaim} /></Row>{/if}
  {#if v.block}<p class="bb-block-note" id="bb-block-note">{v.block}</p>{/if}
  {#if v.cart}
    {#key v.cart.pledgeId}
      <RsiCart
        kind="buyback"
        target={v.cart.target}
        from={v.cart.from}
        pledgeId={v.cart.pledgeId}
        retired={v.cart.retired}
      />
    {/key}
  {/if}
  {#if v.contents}
    {#if v.contents.ships.length}
      <h4 class="modal-h">Ships ({v.contents.ships.length})</h4>
      <table class="modal-contents">
        <tbody>
          {#each v.contents.ships as x, i (i)}
            <tr><td>{x.name}</td><td class="muted">{x.sub}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if v.contents.also.length}
      <h4 class="modal-h">Also Contains</h4>
      <table class="modal-contents">
        <tbody>
          {#each v.contents.also as x, i (i)}
            <tr><td>{x}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {:else if v.canLoad}
    <p class="muted" id="bbd-modal-loading">
      {error ? `Couldn't load the contents: ${error}` : 'Loading what’s in it from RSI…'}
    </p>
  {/if}
  {#if v.source}<p class="muted bbd-source" id="bbd-source"><small>{v.source}</small></p>{/if}
</div>
