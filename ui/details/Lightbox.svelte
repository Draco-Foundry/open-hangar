<script>
  // Full-size picture viewer (#299), on top of the detail window. Shows the sharp copy
  // already on screen at once, then fetches RSI's original ("source", or the wiki's
  // original) only now, one picture, because someone asked for it. Escape or the
  // close button closes it and focus goes back to the picture that opened it.
  import { flushSync } from 'svelte';
  import { app, OH } from '../lib/app.svelte.js';

  let box;
  let img;
  let closeBtn;
  let alt = $state('');
  let src = $state('');
  let status = $state('');
  let label = $state('Full Size Picture');
  let opener = null;
  let ticket = 0; // bumps on every open, so a slow load can't land on the next picture

  export function open(shown, thumb, name, from) {
    const t = ++ticket;
    opener = from || document.activeElement;
    alt = name || 'Ship picture';
    src = shown;
    label = name ? `${name}, Full Size` : 'Full Size Picture';
    const full = OH().fullSizeImage(thumb);
    status = full ? 'Zooming in for the full-res shot…' : '';
    flushSync();
    box.hidden = false;
    closeBtn.focus({ preventScroll: true });
    if (!full) return;
    app()
      .detail.loadImage(full)
      .then((ok) => {
        if (t !== ticket || box.hidden) return;
        if (ok) src = full;
        status = '';
      });
  }
  export function close() {
    if (!box || box.hidden) return;
    ticket++;
    box.hidden = true;
    src = '';
    const back = opener;
    opener = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  // Capture phase, so the detail window under it doesn't also close on Escape.
  $effect(() => {
    const onKey = (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      } else if (e.key === 'Tab') {
        e.preventDefault(); // the close button is the only stop
        e.stopImmediatePropagation();
        closeBtn.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={box}
  class="lightbox"
  id="lightbox"
  role="dialog"
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
  hidden
  onclick={(e) => {
    if (e.target === box || e.target === img) close();
  }}
>
  <button
    bind:this={closeBtn}
    class="lightbox-close"
    id="lightbox-close"
    type="button"
    aria-label="Close"
    onclick={close}
  >
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
  <img bind:this={img} id="lightbox-img" {alt} src={src || undefined} />
  <p class="lightbox-status" id="lightbox-status" role="status" hidden={!status}>{status}</p>
</div>
