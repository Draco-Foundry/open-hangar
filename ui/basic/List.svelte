<script>
  // One list on the basic page: Pledges or Buy-Backs, as plain rows with a search and
  // totals, and its CSV (what the search shows). Text only: no pictures, nothing
  // fetched, so it works offline.
  import { t } from './copy.js';
  import {
    buybackRow,
    buybacksCsv,
    exportName,
    kindLabel,
    pledgeRow,
    pledgeTotalsLine,
    pledgesCsv,
    search,
    totals,
  } from './rows.js';
  import { hub } from './hub.svelte.js';
  import { download } from './download.js';

  let { kind } = $props(); // 'pledges' | 'buybacks'
  const STEP = 300; // rows drawn at first; Show All draws the rest
  let q = $state('');
  let all = $state(false);
  let saved = $state('');

  const rows = $derived(
    kind === 'pledges'
      ? hub.items.map(pledgeRow)
      : hub.buybacks.map((b) => buybackRow(b, hub.bbDetails[b.id])),
  );
  const shown = $derived(search(rows, q));
  const sum = $derived(totals(shown, kind === 'pledges' ? 'value' : 'price'));
  const drawn = $derived(all ? shown : shown.slice(0, STEP));
  const when = $derived(kind === 'pledges' ? hub.scannedAt : hub.bbScannedAt);

  const money = (n) =>
    n == null
      ? ''
      : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const day = (at) =>
    at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const handle = () => hub.owner?.nickname || '';

  function csv() {
    const text = kind === 'pledges' ? pledgesCsv(shown) : buybacksCsv(shown);
    download(new Blob([text], { type: 'text/csv' }), exportName(kind, handle(), 'csv'));
    saved = t('basic.csv-saved', { n: shown.length });
  }
</script>

<section class="bp-list" id={`bp-${kind}`} aria-labelledby={`bp-${kind}-h`}>
  <div class="bp-bar">
    <h2 id={`bp-${kind}-h`}>{kind === 'pledges' ? t('basic.tab-pledges') : 'Buy-Backs'}</h2>
    <input
      type="search"
      class="bp-search"
      placeholder={t('basic.search')}
      aria-label={t('basic.search')}
      bind:value={q}
    />
    <button type="button" class="bp-btn" onclick={csv} disabled={!shown.length}>Export CSV</button>
  </div>
  <p class="bp-totals" aria-live="polite">
    {#if kind === 'pledges'}
      {pledgeTotalsLine(sum, money)}
    {:else}
      {t('basic.buyback-totals', { n: sum.count, value: money(sum.value), priced: sum.priced })}
    {/if}
    {#if when}<span class="bp-when">{t('basic.scanned-at', { when: day(when) })}</span>{/if}
    {#if saved}<span class="bp-saved" role="status">{saved}</span>{/if}
  </p>

  {#if !rows.length}
    <p class="bp-empty">{kind === 'pledges' ? t('basic.no-pledges') : t('basic.no-buybacks')}</p>
  {:else if !shown.length}
    <p class="bp-empty">{t('basic.no-match', { q })}</p>
  {:else}
    <div class="bp-scroll">
      <table class="bp-table">
        <thead>
          <tr>
            <th scope="col">{t('basic.col-name')}</th>
            <th scope="col">{t('basic.col-type')}</th>
            {#if kind === 'pledges'}
              <th scope="col" class="num">{t('basic.col-value')}</th>
              <th scope="col">{t('basic.col-insurance')}</th>
              <th scope="col">{t('basic.col-date')}</th>
            {:else}
              <th scope="col">{t('basic.col-contains')}</th>
              <th scope="col">{t('basic.col-insurance')}</th>
              <th scope="col">{t('basic.col-date')}</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each drawn as r (r.id)}
            <tr>
              <td class="name">
                {r.name}
                {#if kind === 'pledges' && r.contents.length}<small>{r.contents.join(' · ')}</small
                  >{/if}
              </td>
              <td><span class="bp-kind" data-kind={r.kind}>{kindLabel(r.kind)}</span></td>
              {#if kind === 'pledges'}
                <td class="num">{money(r.value)}</td>
                <td>{r.insurance}</td>
                <td class="date">{r.date}</td>
              {:else}
                <td>{r.contains}</td>
                <td>{r.insurance}</td>
                <td class="date">{r.date}</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if drawn.length < shown.length}
      <button type="button" class="bp-btn bp-more" onclick={() => (all = true)}
        >{t('basic.show-all', { n: shown.length })}</button
      >
    {/if}
  {/if}
</section>
