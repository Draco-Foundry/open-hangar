<script>
  // Add to RSI Cart (#288): puts a ship upgrade into your RSI cart, in your own RSI
  // session (OH.upgradeOptions / upgradePrice / addUpgradeToCart, src/rsi-cart.js).
  // You check out on RSI; nothing is bought here. Two forms:
  //   upgrade: a ship's window. Ask RSI which of your ships can upgrade to it, pick
  //            one, see RSI's price, add it.
  //   buyback: a buy-back upgrade's window. Both ships are known: RSI's buy-back
  //            price (asked when the window opens) and one button.
  // Every request is a click (opening the buy-back window counts), and an add is
  // never repeated by itself.
  import { OH } from '../lib/app.svelte.js';

  let { kind = 'upgrade', target, from = null, pledgeId = null } = $props();
  // target: { toShipId, toSkuId, skus?, name }; from: { id, name } for a buy-back.

  const RSI_SIGN_IN = 'https://robertsspaceindustries.com/connect';
  const usd = (n) =>
    n == null
      ? ''
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: n % 1 ? 2 : 0,
        }).format(n);

  let phase = $state('idle'); // idle | loading | ready | adding | added | error
  let error = $state(null); // { kind, when: 'load' | 'add' | 'price' }
  let options = $state([]);
  let picked = $state(null); // a ship id
  let pricing = $state(false);
  let price = $state(null); // the buy-back's price
  let showAllNo = $state(false);

  const ok = $derived(options.filter((o) => o.eligible));
  const no = $derived(options.filter((o) => !o.eligible));
  const noShown = $derived(showAllNo ? no : no.slice(0, 3));
  const choice = $derived(
    kind === 'buyback' ? from && { ...from, price } : ok.find((o) => o.id === picked) || null,
  );
  // The edition the upgrade goes to (may move off the cheapest one, see load()).
  let skuId = $state(target.toSkuId);
  const pair = $derived(choice ? `${choice.name} to ${target.name}` : '');

  async function load() {
    phase = 'loading';
    error = null;
    const r = await OH().upgradeOptions(target.toShipId, skuId, { skus: target.skus });
    if (!r || !r.ok) {
      phase = 'error';
      error = { kind: (r && r.error) || 'network', when: 'load' };
      return;
    }
    options = r.options;
    if (r.toSkuId) skuId = r.toSkuId; // the edition RSI sells an upgrade to
    const first = r.options.find((o) => o.eligible);
    picked = first ? first.id : null;
    phase = 'ready';
  }

  async function pick(o) {
    if (!o.eligible || phase === 'adding') return;
    picked = o.id;
    if (o.price != null) return;
    pricing = true;
    const r = await OH().upgradePrice(o.id, skuId, {
      toShipId: target.toShipId,
      setContext: true,
    });
    pricing = false;
    if (r && r.ok) o.price = r.price;
  }

  async function loadBuybackPrice() {
    phase = 'loading';
    error = null;
    const r = await OH().upgradePrice(from.id, target.toSkuId, {
      pledgeId,
      toShipId: target.toShipId,
    });
    if (r && r.ok) {
      price = r.price;
      phase = 'ready';
    } else if (r && r.error === 'signed-out') {
      phase = 'error';
      error = { kind: 'signed-out', when: 'load' };
    } else {
      phase = 'ready'; // no price: the button still works, RSI shows it in the cart
    }
  }

  async function add() {
    if (!choice || phase === 'adding') return;
    phase = 'adding';
    error = null;
    const r = await OH().addUpgradeToCart(
      choice.id,
      target.toShipId,
      skuId,
      kind === 'buyback' ? { pledgeId } : {},
    );
    if (r && r.ok) {
      phase = 'added';
      return;
    }
    phase = 'error';
    error = { kind: (r && r.error) || 'network', when: 'add' };
  }

  // A buy-back's price comes with the window.
  $effect(() => {
    if (kind === 'buyback' && phase === 'idle') loadBuybackPrice();
  });

  const NOTES = {
    'signed-out': {
      title: 'Sign In to RSI First',
      text: "The upgrade goes into your RSI cart, so RSI needs to know it's you.",
    },
    refused: {
      add: {
        title: "RSI Didn't Add It",
        text: "That upgrade isn't on offer from this ship right now. Nothing was added.",
      },
      load: {
        title: 'No Upgrade on Offer',
        text: "RSI isn't offering an upgrade to this ship right now.",
      },
    },
    busy: {
      title: 'RSI Asked for a Breather',
      text: 'Nothing was sent. Give it a minute, then try again.',
    },
    network: {
      add: {
        title: "RSI Didn't Answer",
        text: 'Check your RSI cart before you try again, it may have landed.',
      },
      load: { title: "RSI Didn't Answer", text: 'Check your connection, then try again.' },
    },
  };
  const note = $derived.by(() => {
    if (!error) return null;
    const n = NOTES[error.kind] || NOTES.network;
    return n.title ? n : n[error.when === 'add' ? 'add' : 'load'];
  });
</script>

<div class="cart" class:bb={kind === 'buyback'} data-cart={kind}>
  {#if kind === 'upgrade'}
    <h4 class="modal-h">Upgrade From Your Ships</h4>
  {/if}

  {#if phase === 'added'}
    <div class="note good" role="status">
      <span class="ico" aria-hidden="true"
        ><svg viewBox="0 0 16 16" width="13" height="13"
          ><path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        ></span
      >
      <div>
        <b>In Your RSI Cart</b>
        <span
          >{kind === 'buyback' ? `Buy-back: ${pair}` : pair}{choice.price != null
            ? `, ${usd(choice.price)}`
            : ''}.{kind === 'upgrade' ? ' Your insurance and items stay with the ship.' : ''}</span
        >
      </div>
    </div>
    <a class="cbtn" href={OH().RSI_CART_URL} target="_blank" rel="noopener">Open RSI Cart ↗</a>
    {#if kind === 'upgrade'}<p class="fine">Changed your mind? Remove it from your RSI cart.</p>{/if}
  {:else}
    {#if note}
      <div class="note bad" role="alert">
        <span class="ico" aria-hidden="true">!</span>
        <div><b>{note.title}</b><span>{note.text}</span></div>
      </div>
      {#if error.kind === 'signed-out'}
        <a class="cbtn ghost" href={RSI_SIGN_IN} target="_blank" rel="noopener">Log In to RSI ↗</a>
      {:else if error.kind === 'network' && error.when === 'add'}
        <a class="cbtn ghost" href={OH().RSI_CART_URL} target="_blank" rel="noopener"
          >Open RSI Cart ↗</a
        >
      {/if}
    {/if}

    {#if kind === 'upgrade'}
      {#if phase === 'idle' || (phase === 'error' && error.when === 'load')}
        <p class="muted cart-intro">
          Pick one of your ships, see RSI's price, and put the upgrade in your RSI cart.
        </p>
        <button type="button" class="cbtn ghost" onclick={load}
          >{phase === 'error' ? 'Try Again' : 'See Upgrade Prices'}</button
        >
      {:else if phase === 'loading'}
        <p class="muted cart-intro"><span class="spin dark"></span>Asking RSI about your ships…</p>
      {:else}
        {#if !ok.length}
          <p class="muted cart-intro">
            None of your ships can upgrade to {target.name} on RSI right now.
          </p>
        {/if}
        <div class="pick" role="radiogroup" aria-label="Upgrade From">
          {#each ok as o (o.id)}
            <button
              type="button"
              class="opt"
              class:on={o.id === picked}
              role="radio"
              aria-checked={o.id === picked}
              onclick={() => pick(o)}
            >
              {#if o.image}<img src={o.image} alt="" loading="lazy" />{:else}<span class="img"
                ></span>{/if}
              <span class="n">{o.name}</span>
              <span class="p"
                >{#if o.price != null}{usd(o.price)}{:else if o.id === picked && pricing}<span
                    class="spin dark"
                  ></span>{:else}<span class="muted">Pick for Price</span>{/if}</span
              >
            </button>
          {/each}
          {#each noShown as o (o.id)}
            <div class="opt no">
              {#if o.image}<img src={o.image} alt="" loading="lazy" />{:else}<span class="img"
                ></span>{/if}
              <span class="n"
                >{o.name}<small>RSI lists no upgrade from it to {target.name}</small></span
              >
              <span class="p">RSI doesn't offer this one</span>
            </div>
          {/each}
          {#if no.length > noShown.length}
            <button type="button" class="more" onclick={() => (showAllNo = true)}
              >Show {no.length - noShown.length} More That Can't</button
            >
          {/if}
        </div>
      {/if}
    {:else}
      <div class="mr">
        <span class="mr-k">Buy-Back Price</span><span class="mr-v"
          >{#if phase === 'loading'}<span class="muted">Asking RSI…</span>{:else if price != null}{usd(
              price,
            )} <span class="muted">from RSI just now</span>{:else}<span class="muted"
              >Shown in your RSI cart</span
            >{/if}</span
        >
      </div>
      <div class="mr">
        <span class="mr-k">Buy-Back Tokens</span><span class="mr-v">Not needed for upgrades</span>
      </div>
    {/if}

    {#if choice && (kind === 'buyback' || phase === 'ready' || phase === 'adding' || (phase === 'error' && error.when === 'add'))}
      {#if kind === 'upgrade'}
        <div class="sum">
          <small>{pair}</small>
          <span class="big">{choice.price != null ? usd(choice.price) : ''}</span>
        </div>
      {/if}
      {#if !(phase === 'error' && error.kind === 'signed-out')}
        <button
          type="button"
          class="cbtn"
          disabled={phase === 'adding' || phase === 'loading'}
          onclick={add}
        >
          {#if phase === 'adding'}<span class="spin"></span>Adding to Your RSI Cart…{:else}
            Add to RSI Cart
          {/if}
        </button>
        <p class="fine">
          {kind === 'buyback'
            ? 'You check out on RSI. Nothing is bought here.'
            : 'Price from RSI just now. You check out on RSI.'}
        </p>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .cart {
    margin-top: 6px;
  }
  .cart.bb {
    margin-top: 10px;
  }
  .cart-intro {
    margin: 0 0 10px;
    font-size: 14px;
    text-wrap: pretty;
  }
  .pick {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }
  .opt {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--panel-2);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .opt img,
  .opt .img {
    width: 56px;
    height: 32px;
    object-fit: cover;
    border-radius: 5px;
    background: var(--bg);
  }
  .opt .n {
    font-weight: 600;
    color: var(--head);
  }
  .opt .n small {
    display: block;
    color: var(--muted);
    font-weight: 400;
    font-size: 13px;
    text-wrap: balance;
  }
  .opt .p {
    color: var(--beacon);
    font: 600 14px var(--font-data);
  }
  .opt .p .muted {
    font: 500 12px var(--font-body);
  }
  .opt.on {
    border-color: var(--accent-line);
    box-shadow: 0 0 0 1px var(--accent-line) inset;
    background: var(--accent-soft);
  }
  .opt.no {
    opacity: 0.55;
    cursor: default;
  }
  .opt.no .p {
    color: var(--muted);
    font: 500 12px var(--font-body);
    text-align: right;
    text-wrap: balance;
  }
  .more {
    justify-self: start;
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--link);
    font: 500 13px var(--font-body);
    cursor: pointer;
  }
  .sum {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
    margin-bottom: 4px;
  }
  .sum small {
    color: var(--muted);
    font-size: 13px;
  }
  .sum .big {
    color: var(--head);
    font: 600 20px var(--font-data);
  }
  .cbtn {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    margin-top: 6px;
    border: 1px solid var(--accent);
    border-radius: var(--r-sm);
    background: var(--accent);
    color: #fff;
    font: 500 15px var(--font-body);
    text-decoration: none;
    cursor: pointer;
  }
  .cbtn:hover {
    background: var(--accent-hover);
  }
  .cbtn:disabled {
    cursor: progress;
    opacity: 0.85;
  }
  .cbtn.ghost {
    border-color: var(--line-2);
    background: var(--panel-2);
    color: var(--head);
  }
  .cbtn.ghost:hover {
    border-color: var(--faint);
  }
  .fine {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
    text-wrap: pretty;
  }
  .note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 11px 13px;
    margin: 4px 0 8px;
    border: 1px solid;
    border-radius: var(--r-sm);
  }
  .note .ico {
    flex: 0 0 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    font: 700 12px var(--font-body);
  }
  .note b {
    display: block;
    font-weight: 600;
    color: var(--head);
  }
  .note span {
    display: block;
    color: var(--muted);
    font-size: 14px;
    text-wrap: pretty;
  }
  .note.good {
    background: var(--good-soft);
    border-color: var(--good-line);
  }
  .note.good .ico {
    background: var(--good);
  }
  .note.bad {
    background: var(--bad-soft);
    border-color: var(--bad-line);
  }
  .note.bad .ico {
    background: var(--bad);
  }
  .spin {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 6px;
    vertical-align: -2px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: cart-spin 0.8s linear infinite;
  }
  .spin.dark {
    border-color: var(--line-2);
    border-top-color: var(--link);
  }
  @keyframes cart-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation-duration: 2.4s;
    }
  }
</style>
