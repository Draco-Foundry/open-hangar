// Inventory page (0.3.0 redesign): everything around the list. See Inventory.svelte.
import '../lib/filters.css';
import { mount } from 'svelte';
import Inventory from './Inventory.svelte';
import MeltPlanner from './MeltPlanner.svelte';

const invEl = document.getElementById('oh-inventory');
if (invEl && window.OHApp) {
  mount(Inventory, { target: invEl });
  // The melt planner goes first in Select mode's bar (its CSS orders it on top).
  const bar = document.getElementById('select-bar');
  const all = bar && bar.querySelector('[data-sb="all"]');
  if (bar) mount(MeltPlanner, { target: bar, anchor: all || undefined });
}
