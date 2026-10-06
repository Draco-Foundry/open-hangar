<script>
  // Quick Links card (#374): the RSI pages pilots hunt for, in four groups side by
  // side (one column when narrow), each link with its one-liner. Hide Card puts it
  // away; Show on Home in your portrait menu's Quick Links group brings it back.
  // The list lives in ui/lib/quick-links.js (the portrait menu shares it).
  import { app, version } from '../lib/app.svelte.js';
  import { quickLinks } from '../lib/quick-links.js';
  import { qlPref, setQuickLinksHidden } from '../lib/quick-links-pref.svelte.js';
  import QuickLinkRow from '../lib/QuickLinkRow.svelte';

  const groups = $derived.by(() => (version.n, quickLinks(app().account?.nickname)));
</script>

{#if !qlPref.hidden}
  <section class="oh-p ql-card" id="oh-quicklinks">
    <div class="oh-ph">
      <h3>Quick Links</h3>
      <button type="button" class="ql-hide" onclick={() => setQuickLinksHidden(true)}>Hide Card</button>
    </div>
    <p class="ql-sub">Straight to the right RSI page. Each one opens in a new tab.</p>
    <div class="ql-grid">
      {#each groups as g (g.name)}
        <div>
          <p class="ql-grp">{g.name}</p>
          {#each g.links as l (l.t)}<QuickLinkRow link={l} desc />{/each}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .ql-card .oh-ph {
    margin-bottom: 4px;
  }
  .ql-hide {
    border: 0;
    padding: 0;
    background: none;
    color: var(--link);
    font: 500 12.5px var(--font-head);
    cursor: pointer;
    filter: none;
  }
  .ql-hide:hover {
    filter: none;
    text-decoration: underline;
  }
  .ql-sub {
    margin: 0 0 10px;
    font-size: 13.5px;
    color: var(--muted);
  }
  .ql-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 4px 16px;
  }
  .ql-grid > div {
    min-width: 0;
  }
  .ql-grp {
    margin: 10px 6px 4px;
    font: 600 11px var(--font-head);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ql-grid > div > .ql-grp:first-child {
    margin-top: 4px;
  }
</style>
