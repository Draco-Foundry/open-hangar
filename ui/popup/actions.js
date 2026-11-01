// What the popup's buttons do. Everything goes through lib.js (window.OH), the same
// calls the basic page's settings make (ui/basic/hub.svelte.js), so both pages agree.
// Connect stays on the basic page: the browser's sign-in window closes the popup.
import { download } from '../basic/download.js';
import { buybackRow, buybacksCsv, exportName, pledgeRow, pledgesCsv } from '../basic/rows.js';
import { HUB_PAGE } from './data.js';

const OH = () => globalThis.OH;
const RSI = 'https://robertsspaceindustries.com';
const SITE_DATA = {
  data_collection: ['personallyIdentifyingInfo', 'financialAndPaymentInfo', 'websiteContent'],
};
const NOTIFY = { permissions: ['notifications'] };
export const firefox = () => !!chrome.runtime.getManifest().browser_specific_settings?.gecko;

// A new tab, and the popup closes (it would anyway, behind the tab).
export function openTab(url) {
  chrome.tabs.create({ url });
  window.close();
}
export const openHub = (hash = '') => openTab(chrome.runtime.getURL(HUB_PAGE) + hash);

// RSI's sign-in page.
export const rsiSignIn = () => RSI + (globalThis.OHRules?.cart?.signInPath || '/connect');
// Access to robertsspaceindustries.com (Firefox lets a player turn it off on its add-ons
// page): without it a scan can only be held, so the popup offers the basic page's Allow
// Access to RSI card instead (the browser's ask would close the popup). → true when
// this browser can't tell.
const RSI_HOST = { origins: [`${RSI}/*`] };
export async function rsiAccess() {
  if (!chrome.permissions?.contains) return true;
  return chrome.permissions.contains(RSI_HOST).catch(() => true);
}

// --- openhangar.space ------------------------------------------------------------------
// Sync Now. Firefox asks before an extension sends anything off the device, and only
// from a click in a page that stays open, so without its yes the basic page asks.
// → { msg, calm, pilot } (all optional): what to show after it.
export async function syncNow() {
  if (firefox() && !(await chrome.permissions.contains(SITE_DATA).catch(() => false))) {
    openHub('#settings');
    return {};
  }
  try {
    await OH().siteSync({ auto: false });
    await chrome.storage.local.remove('siteSyncAgain');
    return {};
  } catch (err) {
    if (err?.ask) {
      OH().log('info', 'site', 'asked before syncing an RSI account new to this link');
      return { pilot: err.ask };
    }
    if (err?.quiet) return {};
    // Held back by the website's pace: Settings says when the next one can go. The
    // popup keeps no retry of its own (it closes; only the open basic page retries).
    const out = { msg: String(err?.message || err), calm: !!err?.calm };
    OH().log(out.calm ? 'info' : 'warn', 'site', out.msg);
    return out;
  }
}
// The new RSI account's question: Sync It or Not This One.
export async function pilotAnswer(who, yes) {
  await OH().siteSyncAnswer(who, yes);
  return yes ? syncNow() : {};
}
export const disconnect = () => OH().siteDisconnect();
// The Daily Scan Reminder's switch (src/background.js keeps its alarm, and turns it off
// without notifications; Disconnect turns it off too).
export const setScanReminder = (on) => chrome.storage.local.set({ scanReminderOn: on === true });
// Auto Scan Daily's switch (the `autoScanRun` flag; src/background.js keeps its alarm).
export const setAutoDaily = (on) => chrome.storage.local.set({ autoDailyOn: on === true });

// --- Store alerts --------------------------------------------------------------------
// Alerts have no switch of their own: they follow Remind Me (./wishlist.js alertsFor, called
// after a Wishlist change; src/background.js runs the checks). Notifications are the one
// opt-in left (askNotify below).
export async function setAlerts(on) {
  const AL = globalThis.OHAlerts;
  await chrome.storage.local.set({ [AL.ON_KEY]: on === true });
}
// Notifications, the one optional permission: the browser only asks from a click, and
// Firefox only when the ask is the click's very first step, so nothing is awaited
// before it. The browser keeps the answer if the popup closes for its question.
// Firefox anchors its question next to the toolbar button, under the open popup, so
// there the popup closes once the ask has gone out: Firefox shows a popup's question on
// the selected tab and grants it in the browser itself, so the answer still counts, and
// Settings reads the switch from the permission when the popup opens again. Not on a
// phone, where the popup is a page of its own (ui/popup/main.js). `have`: the popup
// already knows notifications are allowed, so there's no question and nothing to close
// for (owner, 2026-11-01: turning on the Daily Scan Reminder closed the popup).
const phone = () => !!globalThis.document?.documentElement.classList.contains('phone');
export function askNotify(have = false) {
  if (have) return Promise.resolve(true);
  const asked = chrome.permissions.request(NOTIFY).catch(() => false);
  if (firefox() && !phone()) setTimeout(() => window.close(), 0);
  return asked;
}
export const dropNotify = () => chrome.permissions.remove(NOTIFY).catch(() => false);
export const notifyAllowed = () => chrome.permissions.contains(NOTIFY).catch(() => false);

// --- Your data -------------------------------------------------------------------------
const handleOf = (db) => db?.owner?.nickname || '';
// The backup file (OH.exportDB: the referral code and its link left out).
export async function exportJson() {
  const data = await OH().exportDB();
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    exportName('backup', data.account?.handle || '', 'json'),
  );
}
// Every pledge as a CSV (the basic page's Pledges CSV). → how many rows.
export async function exportPledgesCsv() {
  const db = await OH().loadDB();
  const rows = (db.sources?.hangar?.items || []).map(pledgeRow);
  download(
    new Blob([pledgesCsv(rows)], { type: 'text/csv' }),
    exportName('pledges', handleOf(db), 'csv'),
  );
  return rows.length;
}
// Every stored buy-back as a CSV (the basic page's Buy-Backs CSV), with the price its own
// page gave once read. → how many rows.
export async function exportBuybacksCsv() {
  const db = await OH().loadDB();
  const details =
    (await OH()
      .getBuybackDetails()
      .catch(() => null)) || {};
  // Each with its type as the basic page's list reads it (ui/scan/runner.js buybacksOf).
  const classify = globalThis.OpenHangar?.classifyBuyback;
  const rows = (db.sources?.buybacks?.items || []).map((b) =>
    buybackRow({ ...b, kind: classify?.(b.name, b.contains) || b.kind }, details[b.id]),
  );
  download(
    new Blob([buybacksCsv(rows)], { type: 'text/csv' }),
    exportName('buybacks', handleOf(db), 'csv'),
  );
  return rows.length;
}
// Clear Data (OH.clearData takes the scan's report and portrait with it).
export const clearData = () => OH().clearData();
export const listProfiles = () =>
  OH()
    .listProfiles()
    .catch(() => []);
export const removeProfile = (nickname) => OH().deleteProfile(nickname);
export const logOut = () => OH().logout();

// Report a Scan Problem: a new GitHub issue from the Scan Broken template, with the
// last scan's counts and the flight log (no handle, no item names; OH.scanProblemUrl).
// Nothing is sent: you read it on GitHub and submit it yourself.
const ROW_NAME = { hangar: 'Hangar', buybacks: 'Buy-Backs', referrals: 'Referrals' };
export async function reportProblem(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  const summary =
    rows
      .map((r) => `${ROW_NAME[r.id] || r.id}: ${r.ok && !r.partial ? 'ok' : 'problem'}`)
      .join(' · ') || (report?.signedOut ? 'signed out of RSI' : 'no scan this session');
  openTab(
    OH().scanProblemUrl({
      summary,
      report: await OH().errorReport({ maxLines: 25 }),
      version: chrome.runtime.getManifest().version,
    }),
  );
}

// --- The shortcut ---------------------------------------------------------------------
// The browser owns it: Change opens its own page for extension shortcuts.
export async function commands() {
  try {
    return chrome.commands?.getAll ? await chrome.commands.getAll() : null;
  } catch {
    return null;
  }
}
export function openShortcuts() {
  if (chrome.commands?.openShortcutSettings) {
    chrome.commands.openShortcutSettings();
    window.close();
    return;
  }
  const edge = /\bEdg\//.test(globalThis.navigator?.userAgent || '');
  openTab(`${edge ? 'edge' : 'chrome'}://extensions/shortcuts`);
}
// Firefox can't open its add-ons page for an extension: there, no Change unless it has
// openShortcutSettings (Firefox 137 and later).
export const canChangeShortcut = () => !firefox() || !!chrome.commands?.openShortcutSettings;
