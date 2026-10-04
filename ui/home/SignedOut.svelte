<script>
  // Signed out of RSI (anything but a confirmed login): the card's centred Log In
  // wall in place of CitizenCard.svelte. Mounted after the card's status line.
  import { app, version } from '../lib/app.svelte.js';

  const shown = $derived.by(() => {
    version.n;
    const a = app().account;
    return !!a && a.loggedIn !== true;
  });
</script>

<div class="cc-loggedout" id="cc-loggedout" hidden={!shown}>
  <div class="cc-lo-inner">
    <div class="cc-lo-title">Open Hangar</div>
    <p class="cc-lo-sub">Log in to RSI to scan your hangar. Your ships are waiting on the pad.</p>
    <a
      class="btn-login cc-lo-btn"
      href="https://robertsspaceindustries.com/connect"
      target="_blank"
      rel="noopener">Log In to RSI ↗</a
    >
  </div>
</div>
