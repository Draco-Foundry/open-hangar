<script>
  // Firefox asks before an extension shares anything, in its own fixed words; this
  // card says first what's shared and why. `local`: our hangar page asked for the
  // hangar (Local Mode, no account); its words are owner-approved word for word
  // (2026-10-10). Otherwise Connect from the website: the dashboard's Connect card's
  // words (ui/site/FirefoxExplain.svelte). Continue is the click that asks Firefox.
  let { local = false, onContinue, onClose } = $props();
</script>

<section class="bp-note bp-fx" id="bp-firefox" aria-labelledby="bp-firefox-h">
  {#if local}
    <span class="bp-kick">Local Mode</span>
    <h2 id="bp-firefox-h">What Our Hangar Page Reads, and Why Firefox Asks</h2>
    <dl>
      <dt>What it reads</dt>
      <dd>
        The hangar this browser scanned: your pledges, buy-backs, Store Credit and RSI handle. It's
        your backup file without the scan history, referral code or referral prospects.
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
        Nothing changes in Open Hangar. The hangar page can't show your hangar until you say yes, and
        its Try Again button asks again.
      </dd>
      <dt>Change your mind</dt>
      <dd>
        Turn it off any time on Open Hangar's "Permissions and data" tab in Firefox's add-ons page.
      </dd>
    </dl>
  {:else}
    <span class="bp-kick">Before You Connect</span>
    <h2 id="bp-firefox-h">What We Share, and Why Firefox Asks</h2>
    <dl>
      <dt>What we send</dt>
      <dd>
        Your pledges (name, date, price, insurance), buy-backs, store credit and your RSI handle. The
        same as your backup file.
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
  <div class="bp-row">
    <button type="button" class="bp-btn primary" id="bp-firefox-continue" onclick={onContinue}
      >Continue</button
    >
    <button type="button" class="bp-btn" onclick={onClose}>Not Now</button>
  </div>
</section>
