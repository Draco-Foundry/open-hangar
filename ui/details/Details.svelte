<script>
  // The detail window: one at a time, a pledge's, a buy-back's or a ship's (a link
  // inside opens the next one in its place). It's a dialog: focus moves to its Close
  // button when it opens, Tab stays inside it, Escape or a click outside closes it,
  // and focus goes back to whatever opened it.
  import { flushSync } from 'svelte';
  import { app, version } from '../lib/app.svelte.js';
  import ModalArt from './ModalArt.svelte';
  import ItemBody from './ItemBody.svelte';
  import BbBody from './BbBody.svelte';
  import ShipBody from './ShipBody.svelte';
  import Lightbox from './Lightbox.svelte';

  let cur = $state(null); // { kind: 'item' | 'bb', item } or { kind: 'ship', name }
  let opened = $state(0); // bumps on every open: a fresh picture, a fresh page read
  let bbError = $state('');
  let changed = $state(0); // bumps when the window itself changes something (Wishlist)
  let overlay;
  let closeBtn;
  let lightbox;
  let opener = null;

  const view = $derived.by(() => {
    version.n;
    changed;
    if (!cur) return null;
    const d = app().detail;
    if (cur.kind === 'item') return d.item(cur.item);
    if (cur.kind === 'bb') return d.bb(cur.item);
    return d.ship(cur.name);
  });
  const title = $derived(view ? view.name || view.title : '');
  // A ship's window shows the ship looked up by name.
  const art = $derived(
    !view
      ? null
      : view.art || { real: '', resolve: view.title, preferShip: true, placeholder: 'Ship' },
  );

  function show(what) {
    if (overlay.hidden) opener = document.activeElement;
    cur = what;
    opened++;
    bbError = '';
    flushSync();
    overlay.hidden = false;
    closeBtn.focus({ preventScroll: true });
    // A buy-back's contents: read its page now, once per opening.
    if (what.kind === 'bb' && view && view.canLoad) {
      const ticket = opened;
      app()
        .detail.loadBb(what.item)
        .then((err) => {
          if (err && ticket === opened) bbError = err;
        });
    }
  }
  function close() {
    lightbox.close();
    overlay.hidden = true;
    cur = null;
    flushSync();
    let back = opener;
    opener = null;
    // A list redrawn while the window was open replaced the card: find its twin.
    if (back && !back.isConnected && back.classList?.contains('card') && back.dataset.id) {
      const id = back.dataset.id;
      back = [...document.querySelectorAll('.card[data-id]')].find((c) => c.dataset.id === id);
    }
    if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
  }

  $effect(() => {
    const onDetail = (e) => (e.detail ? show(e.detail) : !overlay.hidden && close());
    const onKey = (e) => {
      if (overlay.hidden) return;
      if (e.key === 'Escape') return void close();
      if (e.key !== 'Tab') return;
      const stops = [
        ...overlay.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      if (!overlay.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('oh:detail', onDetail);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('oh:detail', onDetail);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  bind:this={overlay}
  class="modal-overlay"
  id="item-modal"
  hidden
  onclick={(e) => e.target === overlay && close()}
>
  <div class="modal-card" role="dialog" aria-modal="true" aria-label={title || 'Details'}>
    <button bind:this={closeBtn} class="modal-close" id="modal-close" aria-label="Close" onclick={close}
      >&times;</button
    >
    <div class="modal-body" id="modal-body">
      {#if view}
        {#key opened}
          <ModalArt {art} name={title} onZoom={(...a) => lightbox.open(...a)} />
        {/key}
        {#if cur.kind === 'item'}
          <ItemBody v={view} />
        {:else if cur.kind === 'bb'}
          <BbBody v={view} error={bbError} />
        {:else}
          <ShipBody
            v={view}
            onChange={() => {
              changed++;
              flushSync();
            }}
          />
        {/if}
      {/if}
    </div>
  </div>
</div>
<Lightbox bind:this={lightbox} />
