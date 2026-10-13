<script>
  // The Store page: your side of the store. Your Wishlist, Your Subscriber Store
  // (subscribers only), what your CCUs are worth, and Find in Store to search the
  // store and add anything to your wishlist. Browsing every ship, sales,
  // Compare and prices in your currency live on the website's full store. Long
  // lists scroll inside their panel.
  import Wishlist from './Wishlist.svelte';
  import SubStore from './SubStore.svelte';
  import CcuPanel from './CcuPanel.svelte';
  import FindInStore from './FindInStore.svelte';

  const FULL_STORE = 'https://openhangar.space/store';
</script>

<div class="full-store" id="full-store">
  <p>
    The full store lives on openhangar.space: every ship, sale history, Compare and prices in your
    currency.
  </p>
  <a class="btn full-store-btn" href={FULL_STORE} target="_blank" rel="noopener">Open the Full Store ↗</a>
</div>
<Wishlist />
<SubStore />
<CcuPanel />
<FindInStore />
