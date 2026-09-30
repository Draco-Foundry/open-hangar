<script>
  // Referrals: a compact card (most players have few recruits): recruits, progress
  // to the next reward, and that reward's picture when it's a ship. Only shown with
  // referral history.
  import { app, OH, version } from '../lib/app.svelte.js';
  import { exactCount, plural, shortCount } from '../lib/format.js';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const n = a.recruits;
    const p = a.tierProgress(n);
    const ship = p.next ? p.next.items.find((i) => i.ship) : null;
    return {
      n,
      pct: Math.round(p.pct * 100),
      next: p.next ? { left: p.next.at - n, what: a.rewardNames(p.next.items), ship: ship ? ship.img || ship.n : '' } : null,
    };
  });
  let art = $state('');
  $effect(() => {
    const name = d.next && d.next.ship;
    art = '';
    if (!name) return;
    OH()
      .getShipImage(name)
      .then((url) => {
        if (url && d.next && d.next.ship === name) art = url;
      });
  });
</script>

<section class="oh-p ref">
  <div class="oh-ph"><h3>Referrals</h3><a href="#referrals" class="det">Details →</a></div>
  <div class="n" title="{exactCount(d.n)} {plural(d.n, 'recruit', 'recruits')}">
    {shortCount(d.n)} <span>{plural(d.n, 'recruit', 'recruits')}</span>
  </div>
  <div class="track" role="progressbar" aria-valuenow={d.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next reward">
    <i style="width:{d.pct}%"></i>
  </div>
  {#if d.next}
    <p class="oh-muted nx">{exactCount(d.next.left)} more to your next reward: <b>{d.next.what}</b></p>
    {#if art}<div class="art"><img src={art} alt={d.next.what} /></div>{/if}
  {:else}
    <p class="oh-muted nx">Every reward on the ladder earned.</p>
  {/if}
</section>

<style>
  .det {
    font-size: 13px;
    text-decoration: none;
  }
  .n {
    font: 800 26px var(--font-head);
    color: var(--head);
  }
  .n span {
    font: 600 14px var(--font-body);
    color: var(--muted);
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--panel-2);
    margin: 10px 0;
    overflow: hidden;
  }
  .track i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
  }
  /* The card stretches beside Latest From RSI; the reward picture takes the spare
     height instead of leaving an empty band. */
  .ref {
    display: flex;
    flex-direction: column;
  }
  .art {
    flex: 1 1 auto;
    min-height: 110px;
    margin-top: 12px;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }
  .art img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .nx {
    margin: 0;
    font-size: 13px;
  }
  .nx b {
    color: var(--text);
  }
</style>
