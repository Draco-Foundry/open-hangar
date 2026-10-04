// Buy-Backs page (0.3.0 redesign): everything around the list. See Buybacks.svelte.
import '../lib/filters.css';
import { mount } from 'svelte';
import Buybacks from './Buybacks.svelte';

const el = document.getElementById('oh-buybacks');
if (el && window.OHApp) mount(Buybacks, { target: el });
