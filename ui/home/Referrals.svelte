<script>
  // Referrals: recruits and progress to the next reward. Only shown with referral history.
  import { app, version } from '../lib/app.svelte.js';
  import { exactCount, plural, shortCount } from '../lib/format.js';

  const a = app();
  const d = $derived.by(() => {
    version.n;
    const n = a.recruits;
    const p = a.tierProgress(n);
    return { n, pct: Math.round(p.pct * 100), next: p.next ? { left: p.next.at - n, what: a.rewardNames(p.next.items) } : null };
  });
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Referrals</h3><a href="#referrals" class="det">Details →</a></div>
  <div class="n" title="{exactCount(d.n)} {plural(d.n, 'recruit', 'recruits')}">
    {shortCount(d.n)} <span>{plural(d.n, 'recruit', 'recruits')}</span>
  </div>
  <div class="track" role="progressbar" aria-valuenow={d.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next reward">
    <i style="width:{d.pct}%"></i>
  </div>
  {#if d.next}
    <p class="oh-muted nx">{exactCount(d.next.left)} more to your next reward: <b>{d.next.what}</b></p>
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
    font: 800 34px var(--font-head);
    color: var(--head);
  }
  .n span {
    font: 600 14px var(--font-body);
    color: var(--muted);
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: var(--panel-2);
    margin: 12px 0 8px;
    overflow: hidden;
  }
  .track i {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--accent);
  }
  .nx {
    margin: 0;
    font-size: 14px;
  }
  .nx b {
    color: var(--text);
  }
</style>
