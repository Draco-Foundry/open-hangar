// Buy-Backs page (0.3.0 redesign): the page around the list (Buybacks.svelte) and
// the list itself (BuybacksList.svelte, drawn into #buybacks-body, which the page
// moves into its list column).
import '../lib/filters.css';
import { mount } from 'svelte';
import Buybacks from './Buybacks.svelte';
import BuybacksList from './BuybacksList.svelte';

const el = document.getElementById('oh-buybacks');
const body = document.getElementById('buybacks-body');
if (el && window.OHApp) {
  if (body) mount(BuybacksList, { target: body });
  mount(Buybacks, { target: el });
}
