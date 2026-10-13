<script>
  // The Load Details bar: buy-back details (insurance, real prices, pack contents)
  // come from each buy-back's own RSI page, so reading them is opt-in, one page at a
  // time, with Stop. Never part of a Scan. `x` is from OHApp.bb.list().details.
  import { app } from '../lib/app.svelte.js';

  let { x } = $props();
  // Big lists get a heads-up: hundreds of pages in a row is what makes RSI throttle.
  const BIG =
    ' Reading this many pages can make RSI slow you down for a while;' +
    " if it does, we stop and keep what's read.";
</script>

{#if x && x.loading}
  <div class="bb-details-bar">
    <span id="bbd-progress"
      >Reading buy-back pages…{x.total ? ` ${x.done} of ${x.total}` : ''}</span
    >
    <button type="button" class="mk-btn" id="bbd-stop" onclick={() => app().bb.stopDetails()}
      >Stop</button
    >
  </div>
{:else if x}
  <div class="bb-details-bar">
    {x.have ? `${x.have} of ${x.of} have details. ` : ''}Insurance, real prices and pack contents
    come from each buy-back's own RSI page. Opening a buy-back loads just that one.
    <button
      type="button"
      class="mk-btn primary"
      id="bbd-load"
      onclick={() => app().bb.loadDetails()}>Load Details for {x.need}</button
    >
    <span class="muted"
      >(about {x.mins} min, one page at a time; you can keep browsing.{x.big ? BIG : ''})</span
    >
  </div>
{/if}
