<script>
  // A pledge's window: its facts, store price, where it is on RSI, what's inside.
  import Row from './Row.svelte';
  import MeltOnRsi from './MeltOnRsi.svelte';

  let { v } = $props();
</script>

<div class="modal-info">
  <h3 class="modal-name">{v.name}</h3>
  <div class="modal-meta">
    <span class="badge {v.badge}">{v.type}</span><span class="modal-val">{v.value}</span>
  </div>
  <Row k="ID">{v.id}</Row>
  {#if v.date}<Row k="Pledged">{v.date}</Row>{/if}
  <Row k="Giftable">{v.giftable ? 'Yes' : 'No'}</Row>
  {#if v.meltable !== undefined}<Row k="Meltable">{v.meltable ? 'Yes' : 'No'}</Row>{/if}
  {#if v.store}
    <Row k="Store price">
      {v.store.text}{#if v.store.note}{' '}<span class={v.store.note.cls}>{v.store.note.text}</span
        >{/if}
      {#if v.store.sub}<div class="mr-sub">{v.store.sub}</div>{/if}
    </Row>
  {/if}
  {#if v.currency}<Row k="Currency">{v.currency}</Row>{/if}
  {#if v.upgrade}<Row k="Upgrade">{v.upgrade}</Row>{/if}
  {#if v.spot}
    <Row k="On RSI">
      <a class="bb-reclaim" href={v.spot.url} target="_blank" rel="noopener" title={v.spot.title}
        >View ↗</a
      >
    </Row>
  {/if}
  {#if v.melt}
    {#key v.id}<MeltOnRsi m={v.melt} />{/key}
  {/if}
  <Row k="Scanned">{v.scanned}</Row>
  <h4 class="modal-h">Contents ({v.contents.length})</h4>
  {#if v.contents.length}
    <table class="modal-contents">
      <tbody>
        {#each v.contents as c, i (i)}
          <tr>
            <td>{c.kind}</td>
            <td>
              {#if c.ship}
                <button type="button" class="ship-link" data-ship={c.label}>{c.label}</button>
              {:else}{c.label}{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">No itemized contents.</p>
  {/if}
</div>
