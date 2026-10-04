// Referrals page (0.3.0 rebuild). Mounted into dashboard.html's #referrals-body; the
// classic dashboard keeps the share image and the reward hover preview (listeners on
// #referrals-body). See ui/lib/app.svelte.js for how data flows in.
import './referrals.css';
import { mount } from 'svelte';
import Referrals from './Referrals.svelte';

const el = document.getElementById('referrals-body');
if (el && window.OHApp) mount(Referrals, { target: el });
