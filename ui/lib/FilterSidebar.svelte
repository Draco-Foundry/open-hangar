<script>
  // The filter sidebar (Filters Pass, B2, signed off 2026-09-30), shared by
  // Inventory and Buy-Backs. Types as colored toggle pills at the top (with the
  // page's Hide Small Stuff switch), then folding groups: each shows how many are
  // picked and has its own Clear; a group with `search` gets a box to narrow its
  // options (Manufacturer). Melt Value is a range at the bottom. "‹ Hide Filters"
  // folds the sidebar away; the page's toolbar brings it back. Picking never
  // closes anything.
  //
  // `f`: { types: [{ key, label, n, on }], hideSmall, groups: [{ key, title, search,
  // picked, options: [{ key, label, n, on }] }], melt: { top, value }, closed: [key] }.
  let {
    f,
    smallSwitch = '', // data-switch key of the page's Hide Small Stuff switch
    fmtMoney = (n) => `$${n}`,
    onType,
    onOption,
    onClearGroup,
    onMelt,
    onFold,
    onGroupToggle,
  } = $props();

  let finds = $state({}); // group key → what's typed in its search box
  const shownOptions = (g) => {
    const q = (finds[g.key] || '').trim().toLowerCase();
    return q ? g.options.filter((o) => o.on || o.label.toLowerCase().includes(q)) : g.options;
  };
  const meltValue = $derived(
    f.melt.value == null ? f.melt.top : Math.min(f.melt.value, f.melt.top),
  );
</script>

<aside class="oh-fbar" aria-label="Filters">
  <div class="oh-fbar-top">
    <h3>Filters</h3>
    <button type="button" class="oh-link" onclick={() => onFold(true)}>‹ Hide Filters</button>
  </div>
  <div class="oh-tpills">
    {#each f.types as t (t.key)}
      <button
        type="button"
        class="oh-tp"
        style:--c="var(--t-{t.key}-line, var(--accent))"
        data-type={t.key}
        aria-pressed={t.on}
        onclick={() => onType(t.key)}><span class="oh-tdot"></span>{t.label} <i>{t.n}</i></button
      >
    {/each}
  </div>
  {#if smallSwitch}
    <button
      type="button"
      class="oh-sw"
      class:on={f.hideSmall}
      data-switch={smallSwitch}
      aria-pressed={f.hideSmall}
      title="Paints, add-ons and coupons"><span class="sw-t"></span>Hide Small Stuff</button
    >
  {/if}
  {#each f.groups as g (g.key)}
    <details
      class="oh-fg"
      data-group={g.key}
      open={!f.closed.includes(g.key)}
      ontoggle={(e) => onGroupToggle(g.key, e.currentTarget.open)}
    >
      <summary
        >{g.title}{#if g.picked}<span class="oh-sn">{g.picked}</span>{/if}</summary
      >
      {#if g.picked}
        <button type="button" class="oh-link oh-gc" onclick={() => onClearGroup(g.key)}
          >Clear</button
        >
      {/if}
      {#if g.search}
        <input
          class="oh-fsearch"
          type="search"
          placeholder="Find a {g.title.toLowerCase()}"
          aria-label="Find a {g.title}"
          value={finds[g.key] || ''}
          oninput={(e) => (finds[g.key] = e.currentTarget.value)}
        />
      {/if}
      <div class="oh-opts">
        {#each shownOptions(g) as o (o.key)}
          <button
            type="button"
            class="oh-opt"
            data-option={o.key}
            aria-pressed={o.on}
            onclick={() => onOption(g.key, o.key)}
            ><span class="oh-box" aria-hidden="true"
              >{#if o.on}<svg viewBox="0 0 12 12" width="10" height="10"
                  ><path
                    d="M2 6.5l2.5 2.5L10 3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  /></svg
                >{/if}</span
            >{o.label}<i>{o.n}</i></button
          >
        {/each}
      </div>
    </details>
  {/each}
  {#if f.melt.top}
    <details
      class="oh-fg"
      data-group="melt"
      open={!f.closed.includes('melt')}
      ontoggle={(e) => onGroupToggle('melt', e.currentTarget.open)}
    >
      <summary>Melt Value{#if f.melt.value != null}<span class="oh-sn">1</span>{/if}</summary>
      <div class="oh-range">
        <div class="oh-range-vals">
          <span>{fmtMoney(0)}</span><span
            >{f.melt.value == null ? 'Any' : `Up to ${fmtMoney(meltValue)}`}</span
          >
        </div>
        <input
          type="range"
          min="0"
          max={f.melt.top}
          step="5"
          value={meltValue}
          aria-label="Highest melt value"
          oninput={(e) => {
            const v = Number(e.currentTarget.value);
            onMelt(v >= f.melt.top ? null : v);
          }}
        />
      </div>
    </details>
  {/if}
</aside>
