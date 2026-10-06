<script>
  // Hangar Spotlight: a clean picture of one ship from your own fleet, a new one each
  // visit. No heading, buttons or stats (owner, 2026-10-05): the ship's name is the
  // picture's alt text and a small caption on hover or focus. It fills the spare
  // height of its column on Home, so the columns finish together.
  import { app, OH, version } from '../lib/app.svelte.js';

  const a = app();
  const ships = $derived.by(() => {
    version.n;
    const seen = new Map();
    for (const p of a.state.items) {
      if (!p.containsShip) continue;
      const name = a.resolveImageName(p);
      const v = name && a.shipOf(name);
      if (!v || seen.has(v.name)) continue;
      seen.set(v.name, {
        name: [v.mfr && !v.name.startsWith(v.mfr.split(' ')[0]) ? v.mfr.split(' ')[0] : '', v.name]
          .filter(Boolean)
          .join(' '),
        lookup: name,
        img: a.realImage(p.image),
      });
    }
    return [...seen.values()];
  });
  // Somewhere different each visit.
  const pick = Math.floor(Math.random() * 1000);
  const ship = $derived(ships.length ? ships[pick % ships.length] : null);
  let art = $state('');
  $effect(() => {
    const s = ship;
    art = s ? s.img : '';
    if (!s) return;
    OH()
      .getShipImage(s.lookup)
      .then((url) => {
        if (url && ship === s) art = url;
      });
  });
</script>

{#if ship}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <figure class="spot" id="oh-spotlight" tabindex="0" aria-label={ship.name}>
    {#if art}<img src={art} alt={ship.name} />{/if}
    <figcaption>{ship.name}</figcaption>
  </figure>
{/if}

<style>
  .spot {
    position: relative;
    flex: 1 1 auto;
    min-height: 220px;
    margin: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: linear-gradient(135deg, var(--panel-2), var(--bg));
    outline: none;
  }
  .spot:focus-visible {
    box-shadow: 0 0 0 2px var(--accent-line);
  }
  .spot img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  figcaption {
    position: absolute;
    left: 12px;
    bottom: 12px;
    max-width: calc(100% - 24px);
    padding: 3px 9px;
    border-radius: var(--r-sm);
    background: rgba(0, 0, 0, 0.6);
    color: #e6ecf2;
    font: 500 12px var(--font-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .spot:hover figcaption,
  .spot:focus-visible figcaption {
    opacity: 1;
  }
</style>
