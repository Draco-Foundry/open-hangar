<script>
  // Firefox only (owner sign-off, 2026-10-05): before Firefox's own data-sharing
  // prompt, which reads alarming in Mozilla's fixed words, we say what we share and
  // why. Opened by Learn More, and by Connect while Firefox hasn't said yes yet. Its
  // Continue is the click that asks Firefox (siteConnect asks first thing, before
  // any wait, as Firefox needs), then Connect carries on; Not Now, ✕ and Escape close
  // it. Focus moves into the card and back to the button that opened it.
  // `local`: opened for our hangar page (Local Mode), which has no account: Continue
  // only asks Firefox, and Connect doesn't start.
  import { app } from '../lib/app.svelte.js';

  let { opener = null, local = false, onClose } = $props();
  let card = $state();

  // Drawn on the page itself, so the Citizen Card's clipping can't cut it.
  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  $effect(() => card?.focus({ preventScroll: true }));

  function close() {
    const back = opener;
    onClose();
    if (back?.isConnected) back.focus({ preventScroll: true });
  }
  function proceed() {
    const back = opener;
    onClose();
    // Both ask Firefox right away, inside this click.
    if (local) app().site.allowData();
    else app().site.connect();
    if (back?.isConnected) back.focus({ preventScroll: true });
  }
  function onEscape(e) {
    if (e.key === 'Escape') close();
  }
  // Tab stays inside the card.
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const all = [...card.querySelectorAll('button')];
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

{#snippet shield(size)}
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    ><path
      d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linejoin="round"
    /></svg
  >
{/snippet}

<svelte:window onkeydown={onEscape} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fx-overlay" use:portal onclick={(e) => e.target === e.currentTarget && close()}>
  <div
    bind:this={card}
    class="fx-card"
    id="fx-explain"
    role="dialog"
    aria-modal="true"
    aria-labelledby="fx-title"
    tabindex="-1"
    onkeydown={onKey}
  >
    <button type="button" class="fx-x" aria-label="Close" onclick={close}>✕</button>
    <span class="fx-kick">{@render shield(14)}Before You Connect</span>
    <h2 id="fx-title">What We Share, and Why Firefox Asks</h2>
    <dl>
      <dt>What we send</dt>
      <dd>
        Your pledges (name, date, price, insurance), buy-backs, store credit and your RSI handle.
        The same as your backup file.
      </dd>
      <dt>What we never send</dt>
      <dd>Passwords, card numbers, bank details or how you pay. Open Hangar never sees any of that.</dd>
      <dt>Why Firefox asks</dt>
      <dd>
        Firefox makes every extension name what it shares, using a short fixed list. Pledge prices
        and store credit fall under <b>"financial and payment information"</b>, so that's what its
        prompt will say.
      </dd>
      <dt>If you say no</dt>
      <dd>Nothing changes. Open Hangar stays private and local, and you can connect later.</dd>
      <dt>Change your mind</dt>
      <dd>Disconnect any time, and delete what was synced from your Account page.</dd>
    </dl>
    <div class="fx-acts">
      <button type="button" class="sc-btn primary" id="fx-continue" onclick={proceed}
        >Continue</button
      >
      <button type="button" class="sc-btn" onclick={close}>Not Now</button>
    </div>
  </div>
</div>
