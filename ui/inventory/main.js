// Inventory page (0.3.0 redesign): the page around the list (Inventory.svelte) and
// the list itself (InventoryList.svelte, drawn into #results, which the page moves
// into its list column).
import '../lib/filters.css';
import { mount } from 'svelte';
import Inventory from './Inventory.svelte';
import InventoryList from './InventoryList.svelte';
import MeltPlanner from './MeltPlanner.svelte';

const invEl = document.getElementById('oh-inventory');
const results = document.getElementById('results');
if (invEl && window.OHApp) {
  if (results) mount(InventoryList, { target: results });
  mount(Inventory, { target: invEl });
  // The melt planner goes first in Select mode's bar (its CSS orders it on top).
  const bar = document.getElementById('select-bar');
  const all = bar && bar.querySelector('[data-sb="all"]');
  if (bar) mount(MeltPlanner, { target: bar, anchor: all || undefined });
}
