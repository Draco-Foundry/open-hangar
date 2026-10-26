<script>
  // The Hangar tab (owner, 2026-10-14): who this is (the RSI portrait the scan saved,
  // and the handle), Account Value and its change since an earlier scan (with UEC's),
  // Store Credit,
  // buy-back tokens, Fleet News (what in the store is news for this hangar, from the
  // store alerts). Scan sits at the top of the popup (./ScanBar.svelte); before the first
  // scan, under this tab's one heading (`scan`). After a scan: what went wrong, and the
  // question when its sync found an RSI account new to the connection. Amounts in the
  // currency picked (`fx`, ./currency.js), the dollar figure on hover.
  import { t } from './copy.js';
  import {
    reportTrouble,
    storeCredit,
    gameCredit,
    countFit,
    cardName,
    insChip,
    newSinceScan,
    newViewUrl,
    NEW_SHOWN,
    sinceKey,
    tokenCount,
    unpricedLine,
  } from './data.js';
  import { openTab, reportProblem } from './actions.js';
  import { FIT, USD, moneyFit } from './currency.js';
  import { flag } from '../lib/flags.js';

  let {
    v,
    value,
    since,
    avatar,
    db,
    account,
    signedOut,
    fx = USD,
    report, // the report shown once (for an account switched)
    lastReport, // the last scan's report, for a problem
    pilot = null, // the scan's sync asked: { handle } (ask), answered with onpilot(yes)
    onpilot,
    news,
    first = false,
    scan, // the first run's Scan (./ScanBar.svelte), a snippet
    onwishlist,
    alerts,
    fresh,
  } = $props();

  const OH = globalThis.OH;
  const AL = globalThis.OHAlerts;
  // Cents for Store Credit, none for a change or a big total.
  const total = $derived(moneyFit(value ? value.total : v.melt, fx));
  const change = $derived(since ? moneyFit(Math.abs(since.delta), fx, { most: 0, full: FIT.change }) : null);
  // UEC's change as the UEC tile shows a count; the line in full on hover when either
  // number is short.
  const uecChange = $derived(since?.uec ? countFit(Math.abs(since.uec)) : null);
  const sinceAs = $derived(sinceKey(since));
  const sinceLine = (full) =>
    t(sinceAs, {
      amount: full ? change.title || change.text : change.text,
      uec: uecChange ? (full ? uecChange.full : uecChange.text) : '',
      date: day(since.at),
    });
  const sinceTitle = $derived(
    sinceAs && (change.title || (uecChange && uecChange.text !== uecChange.full)) ? sinceLine(true) : null,
  );
  const day = (at) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const credit = $derived(storeCredit(account));
  const creditText = $derived(credit != null ? moneyFit(credit, fx, { cents: true, full: FIT.credit }) : null);
  const uec = $derived(gameCredit(account, 'uec'));
  const rec = $derived(gameCredit(account, 'rec'));
  const tokens = $derived(tokenCount(v.tokens));
  const nextToken = $derived(OH.nextBuybackToken ? OH.nextBuybackToken(Date.now()) : null);
  const STEP = { hangar: 'popup.step-hangar', buybacks: 'popup.step-buybacks', referrals: 'popup.step-referrals' };
  const BAR = flag('scanBar');
  // A problem in the last scan (a part not read, or read only in part), unless a scan
  // since went fine. With the scan bar, a page RSI changed is the bar's line instead.
  const trouble = $derived(
    reportTrouble(lastReport, v?.scannedAt).filter((r) => !(BAR && r.pageChanged)),
  );
  const ROW = { hangar: 'popup.row-pledges', buybacks: 'popup.row-buybacks' };
  const rowText = (r) =>
    !r.ok
      ? r.error || ''
      : r.id === 'referrals'
        ? t('popup.row-referrals')
        : ROW[r.id] && Number.isFinite(r.n)
          ? t(ROW[r.id], { n: r.n })
          : '';
  const switched = $derived(report?.switched?.who ? report.switched : null);
  const sub = (m) => (AL ? AL.lines(m)[0] || '' : '');

  // New Since Last Scan (the newSinceScan flag): what the last scan found that the one
  // before it didn't (./data.js newSinceScan), until the next scan. Each row is the
  // website's title-only pledge card in its row shape: the picture, the name, then the
  // melt value with the G and M marks after it and the insurance chip at the right.
  // Three rows, and always the link to the website's New view while connected (owner,
  // 2026-10-26: see more on openhangar.space); every row when there's no website.
  const NEW = flag('newSinceScan');
  const arrived = $derived(NEW ? newSinceScan(db?.history, v.items, v.scannedAt) : null);
  const newAll = $derived(arrived ? newViewUrl(v.myHangar) : null);
  const newRows = $derived(
    arrived ? (newAll ? arrived.items.slice(0, NEW_SHOWN) : arrived.items) : [],
  );
  // Whole dollars, cents when there are some (the website's one money rule).
  const melt = (n) =>
    moneyFit(n, fx, Number.isInteger(Math.round(n * 100) / 100) ? { most: 0 } : { cents: true });
  const newTotal = $derived(arrived ? melt(arrived.total) : null);
  let noPic = $state({}); // pledge id → its picture didn't load

</script>

{#if first}
  <div class="pp-body pp-first" id="pp-first">
    <svg class="pp-big-ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"
      ><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"></path><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"></path></svg
    >
    {#if !signedOut}
      <h2 class="pp-h">{t('popup.first')}</h2>
      <p class="pp-firstline" id="pp-first-line">{t('popup.first-line')}</p>
    {/if}
    {@render scan?.()}
  </div>
{:else}
  <div class="pp-body">
    <div class="pp-who">
      <span class="pp-face">
        {#if avatar}<img src={avatar} alt="" width="34" height="34" />{:else}<svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg
          >{/if}
      </span>
      <span class="pp-whoname">
        <b id="pp-handle">{v.nickname || v.handle}</b>
        {#if v.name && v.name !== (v.nickname || v.handle)}<small>{v.name}</small>{/if}
      </span>
      {#if v.myHangar}
        <button type="button" class="pp-link pp-mine" id="pp-hangar" onclick={() => openTab(v.myHangar)}
          >{t('popup.open-my-hangar')}</button
        >
      {/if}
    </div>

    <div class="pp-value" aria-live="polite">
      <div class="pp-vtop">
        <span class="pp-lbl">{value ? 'Account Value' : t('popup.melt-label')}</span>
        {#if sinceAs && value}
          <span
            class="pp-since"
            class:up={Math.abs(since.delta) >= 1 ? since.delta > 0 : since.uec > 0}
            id="pp-since"
            title={sinceTitle}>{sinceLine(false)}</span
          >
        {/if}
      </div>
      <div
        class="pp-big"
        id="pp-value"
        title={total.title || null}
        role={total.short ? 'group' : null}
        aria-label={total.short ? total.title : null}
      >{total.text}</div>
      {#if (value ? value.unpriced : v.unpriced) > 0}
        <div class="pp-unpriced">{unpricedLine(value ? value.unpriced : v.unpriced)}</div>
      {/if}
    </div>

    <!-- One balances strip (owner, 2026-10-23): Store Credit, UEC and REC, each label over
         its number, no boxes; Buy-Back Tokens and the next refill one small line under it. -->
    {#if credit != null || uec || rec}
      <div class="pp-tiles" id="pp-balances">
        {#if credit != null}
          <div
            class="pp-tile"
            id="pp-credit"
            role={creditText.short ? 'group' : null}
            aria-label={creditText.short ? `${t('popup.store-credit')} ${creditText.title}` : null}
          >
            <span class="pp-lbl">{t('popup.store-credit')}</span><b title={creditText.title || null}>{creditText.text}</b>
          </div>
        {/if}
        {#if uec}
          <div class="pp-tile" id="pp-uec" title={uec.full} role="group" aria-label={`UEC ${uec.full}`}>
            <span class="pp-lbl">UEC</span><b>{uec.text}</b>
          </div>
        {/if}
        {#if rec}
          <div class="pp-tile" id="pp-rec" title={rec.full} role="group" aria-label={`REC ${rec.full}`}>
            <span class="pp-lbl">REC</span><b>{rec.text}</b>
          </div>
        {/if}
      </div>
    {/if}
    {#if tokens}
      <div
        class="pp-tok"
        id="pp-tokens"
        role={tokens.text !== tokens.full ? 'group' : null}
        aria-label={tokens.text !== tokens.full ? `Buy-Back Tokens ${tokens.full}` : null}
      >
        <span class="pp-lbl">Buy-Back Tokens</span>
        <b title={tokens.text !== tokens.full ? tokens.full : null}>{tokens.text}</b>{#if nextToken}<small
            >{t('popup.token-next', { date: day(nextToken) })}</small
          >{/if}
      </div>
    {/if}

    {#if arrived}
      <section
        class="pp-arrived"
        id="pp-arrived"
        aria-label={arrived.items.length
          ? t('popup.new-sr', { n: arrived.items.length, melt: newTotal.title || newTotal.text })
          : null}
        aria-labelledby={arrived.items.length ? null : 'pp-arrived-h'}
      >
        <div class="pp-arrtop">
          <h2 class="pp-h3" id="pp-arrived-h">{t('popup.new-since')}</h2>
          {#if arrived.items.length}
            <span class="pp-arrtotal" id="pp-arrived-total" title={newTotal.title || null}
              >{t('popup.new-total', { n: arrived.items.length, melt: newTotal.text })}</span
            >
          {/if}
        </div>
        {#if !arrived.items.length}
          <p class="pp-note" id="pp-arrived-none">{t('popup.new-none')}</p>
        {:else}
          {#if arrived.since}<small class="pp-arrwhen">{t('popup.new-since-when', { date: day(arrived.since) })}</small>{/if}
          {#each newRows as p (p.id)}
            {@const m = melt(p.value)}
            {@const ins = insChip(p.insurance)}
            <div class="pp-arr">
              <span class="pp-arrpic">
                {#if p.image && !noPic[p.id]}<img
                    src={p.image}
                    alt=""
                    width="96"
                    height="54"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onerror={() => (noPic = { ...noPic, [p.id]: true })}
                  />{/if}
              </span>
              <span class="pp-arrtext">
                <b class="pp-arrname">{cardName(p.name)}</b>
                <span class="pp-arrline">
                  {#if Number.isFinite(p.value) && p.value > 0}<span class="pp-arrmelt" title={m.title || null}
                      >{m.text}</span
                    >{/if}
                  <span class="pp-gm">
                    <i class={p.giftable ? 'y' : 'n'} title={t(p.giftable ? 'popup.giftable' : 'popup.not-giftable')}
                      ><span aria-hidden="true">G</span><span class="pp-sr"
                        >{t(p.giftable ? 'popup.giftable' : 'popup.not-giftable')}</span
                      ></i
                    >
                    <i class={p.meltable ? 'y' : 'n'} title={t(p.meltable ? 'popup.meltable' : 'popup.not-meltable')}
                      ><span aria-hidden="true">M</span><span class="pp-sr"
                        >{t(p.meltable ? 'popup.meltable' : 'popup.not-meltable')}</span
                      ></i
                    >
                  </span>
                  {#if ins}<span class="pp-ins ins-{ins.tier}">{ins.text}</span>{/if}
                </span>
              </span>
            </div>
          {/each}
          {#if newAll}
            <button type="button" class="pp-link" id="pp-arrived-all" onclick={() => openTab(newAll)}
              >{t('popup.new-see-all', { n: arrived.items.length })}</button
            >
          {/if}
        {/if}
      </section>
    {/if}

    {#if trouble.length}
      <div class="pp-trouble" id="pp-trouble" role="alert">
        <b>{t('popup.scan-problem')}</b>
        {#each trouble as r (r.id)}<small>{t(STEP[r.id] || 'popup.step-hangar')}: {rowText(r)}</small>{/each}
        <button type="button" class="pp-link" id="pp-report" onclick={() => reportProblem(lastReport)}
          >{t('popup.report-problem')}</button
        >
      </div>
    {/if}
    {#if switched}
      <p class="pp-note" role="status">
        {t(switched.restored ? 'popup.switched-back' : 'popup.switched-new', { who: switched.who })}
      </p>
    {/if}
    {#if pilot}
      <div class="pp-trouble pp-pilot" id="pp-pilot" role="group" aria-labelledby="pp-pilot-h">
        <b id="pp-pilot-h">{t('popup.pilot-title', { handle: pilot.handle })}</b>
        <small>{t('popup.pilot-body')}</small>
        <div class="pp-pair">
          <button type="button" class="pp-btn2" id="pp-pilot-yes" onclick={() => onpilot(true)}
            >{t('popup.pilot-yes')}</button
          >
          <button type="button" class="pp-btn2" id="pp-pilot-no" onclick={() => onpilot(false)}
            >{t('popup.pilot-no')}</button
          >
        </div>
      </div>
    {/if}

    {#if news.length || alerts?.on}
      <section class="pp-news" id="pp-news" aria-labelledby="pp-news-h">
        <div class="pp-newstop">
          <h2 class="pp-h3" id="pp-news-h">{t('popup.fleet-news')}</h2>
          {#if alerts?.items?.length}
            <button type="button" class="pp-link" id="pp-news-wishlist" onclick={onwishlist}
              >{t('popup.news-wishlist')}</button
            >
          {/if}
        </div>
        {#if !news.length}<p class="pp-note" id="pp-news-none">{t('popup.fleet-news-none')}</p>{/if}
        <!-- Plain rows with dividers (owner, 2026-10-23): the reason on one line, cut with an
             ellipsis when long, and said in full in the row's name. -->
        {#each news as m (m.id)}
          {@const wish = m.why.some((w) => w.why === 'wishlist')}
          <button
            type="button"
            class="pp-item"
            class:wish
            aria-label={(fresh.has(m.id) ? `${t('popup.alerts-unseen')} ` : '') + [m.name, sub(m)].filter(Boolean).join(', ')}
            onclick={() => openTab(AL.itemUrl(alerts.feeds, m))}
          >
            <span class="pp-ic" aria-hidden="true">
              {#if wish}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                  ><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg
                >{:else}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                  ><path d="M20 12l-8 8-9-9V3h8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle></svg
                >{/if}
            </span>
            <span class="pp-itext">
              {#if fresh.has(m.id)}<span class="pp-sr">{t('popup.alerts-unseen')}</span>{/if}
              <span class="pp-iname">{m.name}</span>
              <small>{sub(m)}</small>
            </span>
            <span class="pp-chev" aria-hidden="true"><svg class="chev" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5"/></svg></span>
          </button>
        {/each}
      </section>
    {/if}
  </div>
{/if}
