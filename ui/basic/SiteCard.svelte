<script>
  // openhangar.space on the basic page: Connect, and once connected Sync Now and
  // Disconnect. The page shows it when it's opened for it (#settings: the popup's
  // Connect, whose sign-in window would close the popup, and the background's asks), so
  // Firefox's yes and the sign-in window each get a click on a page that stays open.
  import { t } from './copy.js';
  import { tick } from 'svelte';
  import { at } from '../site/when.js';
  import { codeCancel, codeReopen, connect, disconnect, hub, syncNow } from './hub.svelte.js';

  let confirmDisconnect = $state(false);
  let stay = $state(); // Stay Connected, focused when the question opens
  const when = (at) =>
    at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  async function askDisconnect() {
    confirmDisconnect = true;
    await tick();
    stay?.focus();
  }
  async function leave() {
    confirmDisconnect = false;
    await disconnect();
  }
</script>

<section class="bp-card" id="bp-site" aria-labelledby="bp-site-h">
  <h2 id="bp-site-h">openhangar.space</h2>
  {#if hub.site.code}
    <div id="bp-code" aria-live="polite">
      <p>{t('basic.code-hint')}</p>
      <p class="bp-code"><b>{hub.site.code.code}</b></p>
      <div class="bp-row">
        <button type="button" class="bp-btn" id="bp-code-again" onclick={codeReopen}
          >{t('basic.code-again')}</button
        >
        <button type="button" class="bp-btn" id="bp-code-cancel" onclick={codeCancel}
          >{t('basic.code-cancel')}</button
        >
      </div>
    </div>
  {:else if hub.site.link}
    <p>
      {t('basic.connected', { name: hub.site.link.name })}
      <small
        >{hub.site.syncing
          ? t('basic.syncing')
          : hub.site.link.waitUntil
            ? t('basic.sync-wait', { time: at(hub.site.link.waitUntil) })
            : hub.site.link.lastSync
              ? t('basic.synced', { when: when(hub.site.link.lastSync) })
              : t('basic.not-synced')}</small
      >
    </p>
    {#if confirmDisconnect}
      <!-- The dashboard's question, word for word (ui/site/YouDisconnect.svelte). -->
      <div class="bp-confirm" id="bp-disconnect-ask" role="group" aria-label="Disconnect">
        <b>Disconnect From openhangar.space?</b>
        <p>
          Your synced copy stays on openhangar.space until you delete it there. This extension
          just stops syncing.
        </p>
        <div class="bp-pair">
          <button
            bind:this={stay}
            type="button"
            class="bp-btn"
            id="bp-stay"
            onclick={() => (confirmDisconnect = false)}>Stay Connected</button
          >
          <button type="button" class="bp-btn danger" id="bp-disconnect-yes" onclick={leave}
            >Disconnect</button
          >
        </div>
      </div>
    {:else}
      <div class="bp-row">
        <button type="button" class="bp-btn" onclick={() => syncNow()} disabled={hub.site.syncing}
          >Sync Now</button
        >
        <button type="button" class="bp-btn" id="bp-disconnect" onclick={askDisconnect}
          >Disconnect</button
        >
      </div>
    {/if}
  {:else}
    <p>{t('basic.connect-about')}</p>
    <div class="bp-row">
      <button type="button" class="bp-btn primary" id="bp-connect" onclick={() => connect()}
        >Connect to openhangar.space</button
      >
    </div>
  {/if}
  {#if hub.site.msg}<p class="bp-msg" class:calm={hub.site.calm} role="status">
      {hub.site.msg}
    </p>{/if}
</section>
