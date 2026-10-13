<script>
  // Customize Home (0.3.0: show and hide; reorder and sizes come later). The
  // portrait menu's Customize Home item, or a quiet button at the very end of Home,
  // opens a drawer: every card with a switch
  // (the Citizen Card is pinned), Reset to Default, and your saved layouts (save the
  // current choice under a name, Apply or Delete one; Default is built in). Saved in
  // this browser (ui/lib/home-layout.svelte.js), not with the RSI account.
  import { tick } from 'svelte';
  import { cust, openCustomize } from '../lib/customize.svelte.js';
  import { DEFAULT_NAME, HOME_CARDS, MAX_NAME, MAX_SAVED, currentLayoutName } from '../lib/home-layout.js';
  import {
    applySaved,
    layout,
    removeSaved,
    resetLayout,
    saveCurrent,
    setCard,
  } from '../lib/home-layout.svelte.js';

  let btn = $state();
  let drawer = $state();
  let name = $state('');
  let error = $state('');
  let saved = $state(''); // the name just saved, for a short confirmation
  let confirming = $state(null); // a saved layout's name while "Delete …?" shows

  const onHome = HOME_CARDS.filter((c) => c.on);
  const more = HOME_CARDS.filter((c) => !c.on);
  const current = $derived(currentLayoutName(layout.pref));

  // Opened from either place (openCustomize closes the other pop-ups): focus moves in.
  let opener = null;
  $effect(() => {
    if (!cust.open) return;
    opener = document.activeElement;
    tick().then(() => drawer?.querySelector('button')?.focus({ preventScroll: true }));
  });
  const show = () => openCustomize();
  function hide() {
    cust.open = false;
    confirming = null;
    error = '';
    saved = '';
    (opener && opener.isConnected && opener !== document.body ? opener : btn)?.focus({
      preventScroll: true,
    });
  }
  function onKey(e) {
    if (!cust.open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (confirming) confirming = null;
      else hide();
      return;
    }
    // Keep Tab inside the drawer while it's open.
    if (e.key === 'Tab' && drawer) {
      const f = [...drawer.querySelectorAll('button:not([disabled]), input, a[href]')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  function save(e) {
    e.preventDefault();
    const n = name;
    error = saveCurrent(n);
    if (!error) {
      saved = n.trim();
      name = '';
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="cust-bar">
  <button
    bind:this={btn}
    type="button"
    class="cust-btn"
    id="cust-btn"
    class:on={cust.open}
    aria-haspopup="dialog"
    aria-expanded={cust.open}
    aria-controls="cust-drawer"
    onclick={show}
    >Customize Home</button
  >
</div>

{#if cust.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cust-dim" onclick={hide}></div>
  <div
    class="cust-drawer"
    id="cust-drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cust-h"
    bind:this={drawer}
  >
    <div class="dh">
      <h3 id="cust-h">Customize Home</h3>
      <button type="button" class="x" aria-label="Close" onclick={hide}>✕</button>
    </div>
    <p class="dsub">Pick the cards you want on your Home.</p>
    <div class="dbody">
      {#snippet row(c)}
        {#if c.pinned}
          <div class="cr pinned">
            <span class="nm">{c.name}<small>Pinned first, can't be hidden</small></span>
            <span class="pin">Always On</span>
          </div>
        {:else}
          {@const on = layout.pref.cards[c.id] !== false}
          <div class="cr" class:off={!on}>
            <span class="nm" id="cr-{c.id}">{c.name}{#if c.note}<small>{c.note}</small>{/if}</span>
            <button
              type="button"
              class="sw"
              class:on
              role="switch"
              aria-checked={on}
              aria-labelledby="cr-{c.id}"
              data-card={c.id}
              onclick={() => setCard(c.id, !on)}
            ></button>
          </div>
        {/if}
      {/snippet}
      <p class="cg">On Home</p>
      {#each onHome as c (c.id)}{@render row(c)}{/each}
      <p class="cg">More Cards</p>
      {#each more as c (c.id)}{@render row(c)}{/each}

      <p class="cg">Layouts</p>
      <p class="hint lnote">Saved in this browser, not with your RSI account.</p>
      <div class="lay-list" id="cust-layouts">
        <div class="ly">
          <span class="nm">{DEFAULT_NAME}<small>Built in</small></span>
          {#if current === DEFAULT_NAME}<span class="now">On Home Now</span>{:else}<button
              type="button"
              class="lk"
              data-apply={DEFAULT_NAME}
              onclick={() => applySaved(DEFAULT_NAME)}>Apply</button
            >{/if}
        </div>
        {#each layout.pref.saved as l (l.name)}
          <div class="ly" data-layout={l.name}>
            {#if confirming === l.name}
              <span class="nm">Delete {l.name}?</span>
              <span class="acts">
                <button
                  type="button"
                  class="lk bad"
                  data-confirm-delete
                  onclick={() => {
                    removeSaved(l.name);
                    confirming = null;
                  }}>Delete</button
                >
                <button type="button" class="lk" onclick={() => (confirming = null)}>Keep</button>
              </span>
            {:else}
              <span class="nm">{l.name}</span>
              <span class="acts">
                {#if current === l.name}<span class="now">On Home Now</span>{:else}<button
                    type="button"
                    class="lk"
                    data-apply={l.name}
                    onclick={() => applySaved(l.name)}>Apply</button
                  >{/if}
                <button type="button" class="lk muted" data-delete={l.name} onclick={() => (confirming = l.name)}
                  >Delete</button
                >
              </span>
            {/if}
          </div>
        {/each}
      </div>
      <form class="save" onsubmit={save}>
        <input
          type="text"
          id="cust-name"
          bind:value={name}
          maxlength={MAX_NAME}
          placeholder="Name this layout"
          aria-label="Layout name"
          oninput={() => ((error = ''), (saved = ''))}
          disabled={layout.pref.saved.length >= MAX_SAVED}
        />
        <button type="submit" class="btn sm" id="cust-save" disabled={layout.pref.saved.length >= MAX_SAVED}
          >Save Layout</button
        >
      </form>
      <p class="hint" class:err={!!error} id="cust-msg" aria-live="polite">
        {#if error}{error}{:else if saved}Saved as {saved}.{:else}{layout.pref.saved.length} of {MAX_SAVED} layouts
          saved.{/if}
      </p>
    </div>
    <div class="dfoot">
      <button type="button" class="btn sm" id="cust-reset" onclick={resetLayout}>Reset to Default</button>
    </div>
  </div>
{/if}

<style>
  /* The end of Home, right-aligned in the space before the footer: it takes no line
     of its own (height 0), so the page ends where it did. */
  .cust-bar {
    display: flex;
    justify-content: flex-end;
    height: 0;
    margin-top: -6px;
  }
  .cust-btn {
    height: 22px;
    padding: 0 2px;
    border: 0;
    background: none;
    color: var(--muted);
    font: 500 12.5px var(--font-head);
    cursor: pointer;
  }
  .cust-btn:hover,
  .cust-btn.on {
    color: var(--link);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .cust-btn:focus-visible {
    outline: 2px solid var(--accent-line);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .cust-dim {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(5, 7, 10, 0.62);
  }
  .cust-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 91;
    width: 400px;
    max-width: 100vw;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-left: 1px solid var(--line-2);
    box-shadow: -20px 0 50px rgba(0, 0, 0, 0.5);
  }
  .dh {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 22px 0;
  }
  .dh h3 {
    margin: 0;
    font: 600 19px var(--font-head);
    color: var(--head);
  }
  .x {
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
  }
  .dsub {
    margin: 4px 22px 4px;
    font-size: 13.5px;
    color: var(--muted);
  }
  .dbody {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 0 22px 16px;
  }
  .cg {
    margin: 16px 0 6px;
    font: 600 11px var(--font-head);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .cr,
  .ly {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    font-size: 14px;
  }
  .cr + .cr,
  .ly + .ly {
    border-top: 1px solid var(--line);
  }
  .nm {
    min-width: 0;
    color: var(--head);
  }
  .nm small {
    display: block;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.3;
  }
  .cr.off .nm {
    color: var(--muted);
  }
  .pin,
  .now {
    flex: none;
    font: 600 11.5px var(--font-head);
    color: var(--muted);
  }
  .sw {
    flex: none;
    position: relative;
    width: 34px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--line-2);
    cursor: pointer;
  }
  .sw::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #c9cfd8;
    transition: left 0.12s;
  }
  .sw.on {
    background: var(--accent);
  }
  .sw.on::after {
    left: 17px;
    background: #fff;
  }
  .sw:focus-visible,
  .lk:focus-visible {
    outline: 2px solid var(--accent-line);
    outline-offset: 2px;
  }
  .acts {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex: none;
  }
  .lk {
    border: 0;
    padding: 0;
    background: none;
    color: var(--link);
    font: 500 13px var(--font-head);
    cursor: pointer;
  }
  .lk:hover {
    text-decoration: underline;
  }
  .lk.muted {
    color: var(--muted);
  }
  .lk.bad {
    color: var(--bad);
  }
  .save {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .save input {
    flex: 1 1 auto;
    min-width: 0;
    height: 30px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--bg);
    color: var(--text);
    font: 400 13.5px var(--font-body);
  }
  .btn.sm {
    flex: none;
    height: 30px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    color: var(--text);
    font: 500 13px var(--font-head);
    cursor: pointer;
  }
  .btn.sm:hover:not(:disabled) {
    border-color: var(--accent-line);
  }
  .btn.sm:disabled,
  .save input:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--muted);
    text-wrap: pretty;
  }
  .lnote {
    margin: -2px 0 4px;
  }
  .hint.err {
    color: var(--warn);
  }
  .dfoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--line);
  }
</style>
