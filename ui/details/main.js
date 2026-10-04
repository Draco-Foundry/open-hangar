// The detail window (0.3.0 redesign): a pledge's, a buy-back's or a ship's, opened
// from anywhere (data-open-item / data-open-bb / data-ship, or openItemModal() and
// friends in src/dashboard.js), with the full-size picture viewer on top. What each
// shows comes from window.OHApp.detail; the look is the classic modal's
// (dashboard.html, ui/theme.css).
import './details.css';
import { mount } from 'svelte';
import Details from './Details.svelte';

const target = document.getElementById('oh-details');
if (target && window.OHApp) mount(Details, { target });
