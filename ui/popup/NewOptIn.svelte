<script>
  // After an update (the firstRun flag): an opt-in that release added, once, at the top
  // of the popup (ui/lib/opt-ins.js newOptIns). Its name, its tip behind the ⓘ
  // (ui/lib/InfoTip.svelte, the setup's words), and Turn On or Not Now; either answers it for good (`optInSeen`).
  // Turn On does what the switch on the Settings tab does.
  import { t } from './copy.js';
  import { t as bt } from '../basic/copy.js';
  import { OPT_INS } from '../lib/opt-ins.js';
  import { askNotify, setAutoDaily } from './actions.js';
  import InfoTip from '../lib/InfoTip.svelte';

  let { opt, onanswered } = $props();
  const OH = globalThis.OH;
  const o = $derived(OPT_INS.find((x) => x.key === opt));
  let tipOpen = $state(false);

  async function seen() {
    const { optInSeen = [] } = await chrome.storage.local.get('optInSeen');
    await chrome.storage.local.set({ optInSeen: [...new Set([...optInSeen, opt])] });
    onanswered?.();
  }
  // The notifications ask is the click's very first step (Firefox only asks then, and
  // closes the popup for it: so it's marked answered at once, not after the answer).
  function turnOn() {
    if (opt === 'notify' || opt === 'autoDaily') {
      askNotify();
      if (opt === 'autoDaily') setAutoDaily(true);
      seen();
      return;
    }
    const scan = () => chrome.runtime.sendMessage({ ohPopup: 'scan' }).catch(() => null);
    if (opt === 'accountLogs') OH.wantAccountLogs().then((ok) => ok && scan());
    if (opt === 'orderHistory') OH.setOrderHistory(true).then(scan);
    seen();
  }
</script>

{#if o}
  <div class="pp-grp pp-newopt" id="pp-new-opt" role="group" aria-labelledby="pp-new-opt-l">
    <div class="pp-r pp-col">
      <small>{t('popup.new-setting')}</small>
      <div class="pp-line">
        <b class="pp-grow" id="pp-new-opt-l">{t(o.label)}</b>
        <InfoTip
          id="pp-new-opt-tip"
          label={t(o.label)}
          text={bt(o.tip)}
          open={tipOpen}
          ontoggle={() => (tipOpen = !tipOpen)}
        />
      </div>
      <div class="pp-pair">
        <button type="button" class="pp-btn2" id="pp-new-opt-on" onclick={turnOn}
          >{t('popup.turn-on')}</button
        >
        <button type="button" class="pp-btn2" id="pp-new-opt-no" onclick={seen}>{t('popup.not-now')}</button>
      </div>
    </div>
  </div>
{/if}
