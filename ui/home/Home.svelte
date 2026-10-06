<script>
  // Home under the Citizen Card ("Layout B, Final", owner 2026-10-05): Account Value,
  // Latest Acquisitions and Wishlist Watch a third each, then Quick Links across the
  // whole width. Game Status lives in the top bar. Customize Home shows or hides each
  // card (Hangar Spotlight and Referrals are off by default). A 12-column grid: cards
  // flow into rows, and the last card in a row stretches over any columns left, so
  // rows always end level (ui/lib/home-layout.js). Every card in a row stretches to
  // the tallest one; footers are pinned to the bottom.
  import { app, version } from '../lib/app.svelte.js';
  import { flowSpans, HOME_CARDS } from '../lib/home-layout.js';
  import { layout } from '../lib/home-layout.svelte.js';
  import ValueCard from './ValueCard.svelte';
  import Acquisitions from './Acquisitions.svelte';
  import WishWatch from './WishWatch.svelte';
  import Spotlight from './Spotlight.svelte';
  import Referrals from './Referrals.svelte';
  import QuickLinks from './QuickLinks.svelte';

  const COMPONENTS = {
    value: ValueCard,
    acquisitions: Acquisitions,
    wishlist: WishWatch,
    spotlight: Spotlight,
    referrals: Referrals,
    quicklinks: QuickLinks,
  };

  const cells = $derived.by(() => {
    version.n;
    const a = app();
    const has = a.state.items.length > 0;
    // A card only where it has something to show.
    const ready = {
      value: has,
      acquisitions: has,
      wishlist: has,
      spotlight: has && a.state.items.some((p) => p.containsShip),
      referrals: has && a.recruits > 0,
      quicklinks: true,
    };
    const cards = HOME_CARDS.filter(
      (c) => c.id !== 'citizen' && layout.pref.cards[c.id] !== false && ready[c.id],
    );
    const wide = flowSpans(cards, 'wide');
    const mid = flowSpans(cards, 'mid');
    return cards.map((c) => ({ id: c.id, C: COMPONENTS[c.id], wide: wide[c.id], mid: mid[c.id] }));
  });
</script>

<div class="oh-grid" id="oh-grid">
  {#each cells as c (c.id)}
    <div class="oh-cell" data-card={c.id} style="--sw: {c.wide}; --sm: {c.mid}">
      <c.C />
    </div>
  {/each}
</div>
