// The toolbar popup (the connector build; src/popup.html). Mounted alone: it loads
// lib.js for the stored data and the ship prices, never dashboard.js. The look is
// ui/tokens.css, linked by src/popup.html.
import './popup.css';
import { mount } from 'svelte';
import Popup from './Popup.svelte';
import { applyLook, lastLook } from './prefs.js';

// Before the first paint: the Look this browser picked last time (popupPrefs is read
// later, and wins), so a Light pick on a dark system never flashes dark.
applyLook(lastLook());
// A phone (Firefox for Android opens the popup as a page): the whole screen, the tabs at
// the bottom. Told by the browser, never by the pointer: a touch screen's toolbar popup
// still sizes itself to its content.
const phone = (on) => document.documentElement.classList.toggle('phone', !!on);
phone(/\bAndroid\b/.test(globalThis.navigator?.userAgent || ''));
try {
  chrome.runtime
    .getPlatformInfo?.()
    ?.then((p) => p?.os && phone(p.os === 'android'))
    .catch(() => {});
} catch {
  // No platform info here: the user agent said.
}

const el = document.getElementById('oh-popup');
if (el && window.OH) mount(Popup, { target: el });
// The kill switch's file (status.json, cached for hours), fresh for the next Scan: the
// background worker only reads the cached copy to choose where a scan runs
// (src/scan-host.js), and a scan that fails early never fetches it.
window.OH?.getRemoteStatus?.()?.catch(() => {});
