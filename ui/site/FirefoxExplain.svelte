<script>
  // Firefox only (owner sign-off, 2026-10-05): before Firefox's own data-sharing
  // prompt, which reads alarming in Mozilla's fixed words, we say what we share and
  // why. Opened by Learn More, and by Connect while Firefox hasn't said yes yet. Its
  // Continue is the click that asks Firefox (siteConnect asks first thing, before
  // any wait, as Firefox needs), then Connect carries on; Not Now, ✕ and Escape close
  // it. Focus moves into the card and back to the button that opened it.
  // `local`: opened for our hangar page (Local Mode), which has no account: Continue
  // only asks Firefox, and Connect doesn't start. Its words say what that page reads
  // and that nothing goes to our servers (owner-approved word for word, 2026-10-10);
  // the layout and buttons are the Connect card's.
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
    {#if local}
      <span class="fx-kick">{@render shield(14)}Local Mode</span>
      <h2 id="fx-title">What Our Hangar Page Reads, and Why Firefox Asks</h2>
      <dl>
        <dt>What it reads</dt>
        <dd>
          The hangar this browser scanned: your pledges, buy-backs, Store Credit and RSI handle.
          It's your backup file without the scan history, referral code or referral prospects.
        </dd>
        <dt>Where it goes</dt>
        <dd>
          Nowhere. The page shows it right here in this browser and doesn't save it. Nothing goes to
          our servers.
        </dd>
        <dt>No account</dt>
        <dd>None needed. Saying yes doesn't sign you up or turn on sync.</dd>
        <dt>Why Firefox asks</dt>
        <dd>
          The page is a website, so we ask Firefox before handing it your hangar. Firefox names what's
          shared from a short fixed list, so pledge prices and Store Credit show up as <b
            >"financial and payment information"</b
          >.
        </dd>
        <dt>If you say no</dt>
        <dd>
          Nothing changes in Open Hangar. The hangar page can't show your hangar until you say yes,
          and its Try Again button asks again.
        </dd>
        <dt>Change your mind</dt>
        <dd>
          Turn it off any time on Open Hangar's "Permissions and data" tab in Firefox's add-ons page.
        </dd>
      </dl>
    {:else}
      <span class="fx-kick">{@render shield(14)}Before You Connect</span>
      <h2 id="fx-title">What We Share, and Why Firefox Asks</h2>
      <dl>
        <dt>What we send</dt>
        <dd>
          Your pledges (name, date, price, insurance), buy-backs, store credit and your RSI handle.
          The same as your backup file.
        </dd>
        <dt>What we never send</dt>
        <dd>
          Passwords, card numbers, bank details or how you pay. Open Hangar never sees any of that.
        </dd>
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
    {/if}
    <div class="fx-acts">
      <button type="button" class="sc-btn primary" id="fx-continue" onclick={proceed}
        >Continue</button
      >
      <button type="button" class="sc-btn" onclick={close}>Not Now</button>
    </div>
  </div>
</div>
