<script>
  // The filter sidebar (Filters Pass, B2, signed off 2026-09-30), shared by
  // Inventory and Buy-Backs. Types as colored toggle pills at the top (with the
  // page's Hide Small Stuff switch), then folding groups: each shows how many are
  // picked and has its own Clear; a group with `search` gets a box to narrow its
  // options (Manufacturer). A price range sits at the bottom. "‹ Hide Filters"
  // folds the sidebar away; the page's toolbar brings it back. Picking never
  // closes anything.
  //
  // `f`: { types: [{ key, label, n, on }], switches: [{ key, label, on, title }],
  // groups: [{ key, title, search, picked, options: [{ key, label, n, on }] }],
  // range: { title, top, value }, closed: [key] }. Switches are [data-switch]
  // buttons, handled by the classic click handler in src/dashboard.js.
  let {
    f,
    fmtMoney = (n) => `$${n}`,
    onType,
    onOption,
    onClearGroup,
    onCap,
    onFold,
    onGroupToggle,
  } = $props();

  let finds = $state({}); // group key → what's typed in its search box
  const shownOptions = (g) => {
    const q = (finds[g.key] || '').trim().toLowerCase();
    return q ? g.options.filter((o) => o.on || o.label.toLowerCase().includes(q)) : g.options;
  };
  const capValue = $derived(
    f.range.value == null ? f.range.top : Math.min(f.range.value, f.range.top),
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
  {#each f.switches as sw (sw.key)}
    <button
      type="button"
      class="oh-sw"
      class:on={sw.on}
      data-switch={sw.key}
      aria-pressed={sw.on}
      title={sw.title}><span class="sw-t"></span>{sw.label}</button
    >
  {/each}
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
  {#if f.range.top}
    <details
      class="oh-fg"
      data-group="cap"
      open={!f.closed.includes('cap')}
      ontoggle={(e) => onGroupToggle('cap', e.currentTarget.open)}
    >
      <summary
        >{f.range.title}{#if f.range.value != null}<span class="oh-sn">1</span>{/if}</summary
      >
      <div class="oh-range">
        <div class="oh-range-vals">
          <span>{fmtMoney(0)}</span><span
            >{f.range.value == null ? 'Any' : `Up to ${fmtMoney(capValue)}`}</span
          >
        </div>
        <input
          type="range"
          min="0"
          max={f.range.top}
          step="5"
          value={capValue}
          aria-label="Highest {f.range.title.toLowerCase()}"
          oninput={(e) => {
            const v = Number(e.currentTarget.value);
            onCap(v >= f.range.top ? null : v);
          }}
        />
      </div>
    </details>
  {/if}
</aside>
