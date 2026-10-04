<script>
  // Hangar Spotlight: one ship from your own fleet per visit, with its art and key
  // numbers; "Another ship" flips to the next.
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
        key: v.name,
        name: [v.mfr && !v.name.startsWith(v.mfr.split(' ')[0]) ? v.mfr.split(' ')[0] : '', v.name]
          .filter(Boolean)
          .join(' '),
        lookup: name,
        role: v.role || v.career || '',
        size: v.size || '',
        crew: v.crew,
        cargo: v.cargo,
        store: v.msrp || null,
        status: v.status,
        pledged: Date.parse(p.date),
        paid: Number.isFinite(p.value) ? p.value : null,
        ins: p.insurance && p.insurance !== 'Unknown' ? p.insurance : '',
        img: a.realImage(p.image),
      });
    }
    return [...seen.values()];
  });
  // Start somewhere different each visit.
  let i = $state(Math.floor(Math.random() * 1000));
  const ship = $derived(ships.length ? ships[i % ships.length] : null);
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
  const month = (t) =>
    Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
  // "Light Fighter · Small · Flight Ready · Pledged Dec 2021 for $90" (no price for
  // free rewards).
  const metaLine = (s) =>
    [
      cap(s.role),
      cap(s.size),
      s.status === 'flight-ready' ? 'Flight Ready' : 'In Concept',
      Number.isFinite(s.pledged)
        ? `Pledged ${month(s.pledged)}${s.paid ? ` for ${a.dollars(s.paid)}` : ''}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const cap = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (_, p, c) => p + c.toUpperCase());
</script>

{#if ship}
  <section class="oh-p spot">
    <div class="oh-ph">
      <h3>Hangar Spotlight</h3>
      {#if ships.length > 1}<button type="button" class="next" onclick={() => i++}>Another Ship ↻</button>{/if}
    </div>
    <div class="art">
      {#if art}<img src={art} alt="" />{/if}
      <div class="cap"><b>{ship.name}</b>{#if ship.ins}<span>{ship.ins}</span>{/if}</div>
    </div>
    <div class="meta">{metaLine(ship)}</div>
    <div class="specs">
      <div><b>{ship.crew ?? '—'}</b>crew</div>
      <div><b>{ship.cargo ?? '—'}</b>SCU</div>
      <div><b>{cap(ship.size) || '—'}</b>size</div>
      <div><b>{ship.store ? a.dollars(ship.store) : '—'}</b>store today</div>
    </div>
  </section>
{/if}

<style>
  .next {
    border: 1px solid var(--line-2);
    background: none;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--muted);
    cursor: pointer;
  }
  .next:hover {
    color: var(--head);
  }
  /* The card stretches to its row (beside Latest Acquisitions); the picture takes
     the spare height so there's no empty band at the bottom. */
  .spot {
    display: flex;
    flex-direction: column;
  }
  .art {
    position: relative;
    flex: 1 1 auto;
    min-height: 180px;
    border-radius: var(--r-md);
    overflow: hidden;
    background: linear-gradient(135deg, var(--panel-2), var(--bg));
  }
  .art img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .art::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.6));
  }
  .cap {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 12px;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 10px;
  }
  .cap b {
    font: 600 22px var(--font-head);
    color: #fff;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cap span {
    flex: none;
    font-size: 12px;
    color: #e6ecf2;
    background: rgba(0, 0, 0, 0.5);
    border-radius: var(--r-sm);
    padding: 2px 8px;
  }
  .meta {
    font-size: 14px;
    color: var(--muted);
    margin-top: 12px;
  }
  .specs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  .specs div {
    background: var(--panel-2);
    border-radius: var(--r-md);
    padding: 8px 10px;
    font-size: 12px;
    color: var(--muted);
    min-width: 0;
  }
  .specs b {
    display: block;
    font: 600 17px var(--font-head);
    color: var(--head);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 420px) {
    .specs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
