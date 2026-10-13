<script>
  // Melt on RSI (#403): opens the pledge's page in your RSI hangar, after an
  // in-window confirm that says what melting means. We never melt anything: the
  // melt itself is RSI's own button. Pledges RSI never sells back get a big red
  // warning first. `m` is { url, page, pos, reason, lines } from itemView.
  import { tick } from 'svelte';
  import Row from './Row.svelte';

  let { m } = $props();
  let asking = $state(false);
  let keepBtn = $state(null);

  async function ask() {
    asking = true;
    await tick();
    keepBtn?.focus();
  }
</script>

<Row k="Melt">
  <button
    type="button"
    class="bb-reclaim melt-open"
    id="melt-open"
    aria-expanded={asking}
    onclick={() => (asking ? (asking = false) : ask())}>Melt on RSI</button
  >
</Row>
{#if asking}
  <div
    class="sm-confirm melt-confirm"
    class:danger={!!m.reason}
    id="melt-confirm"
    role="group"
    aria-label={m.reason ? 'Gone for Good if You Melt It' : 'Before You Melt It'}
  >
    {#if m.reason}
      <b class="melt-title" id="melt-never">Gone for Good if You Melt It</b>
      <span class="melt-never">RSI never sells this one back. {m.reason}</span>
    {:else}
      <b class="melt-title">Before You Melt It</b>
    {/if}
    <ul class="melt-facts">
      {#each m.lines as line, i (i)}<li>{line}</li>{/each}
    </ul>
    <span class="melt-where"
      >Opens page {m.page} of your RSI hangar, where it's number {m.pos} (as of your last scan). The
      melt itself is RSI's button.</span
    >
    <div class="sm-confirm-row">
      <button bind:this={keepBtn} type="button" class="sc-btn" onclick={() => (asking = false)}
        >Keep It</button
      >
      <a
        class="sc-btn"
        class:danger={!!m.reason}
        id="melt-go"
        href={m.url}
        target="_blank"
        rel="noopener"
        onclick={() => (asking = false)}
        >{m.reason ? 'I Understand, Open on RSI ↗' : 'Open on RSI ↗'}</a
      >
    </div>
  </div>
{/if}
