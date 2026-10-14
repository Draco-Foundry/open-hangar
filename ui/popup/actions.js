// What the popup's buttons do. Everything goes through lib.js (window.OH), the same
// calls the basic page's settings make (ui/basic/hub.svelte.js), so both pages agree.
// Connect stays on the basic page: the browser's sign-in window closes the popup.
import { download } from '../basic/download.js';
import { exportName, pledgeRow, pledgesCsv } from '../basic/rows.js';
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

// RSI's sign-in page, and whether the browser holds an RSI session at all: its
// Rsi-Token cookie (src/rsi-cart.js reads it the same way). → '' when there's none
// (signed out for sure), the value, or null when this browser can't tell. Read from
// the browser, never asked of RSI.
export const rsiSignIn = () => RSI + (globalThis.OHRules?.cart?.signInPath || '/connect');
export async function rsiCookie() {
  try {
    if (!chrome.cookies?.get) return null;
    const name = globalThis.OHRules?.cart?.cookie || 'Rsi-Token';
    const got = await chrome.cookies.get({ url: RSI, name });
    return got?.value ? got.value : '';
  } catch {
    return null;
  }
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
    const out = { msg: String(err?.message || err), calm: !!err?.calm };
    OH().log(out.calm ? 'info' : 'warn', 'site', out.msg);
    // Held back by the website's pace: tried once more when the wait is over, as the
    // basic page does (ui/basic/hub.svelte.js retryIfDue).
    const wait = OH().siteSyncWait(
      await OH()
        .getSiteLink()
        .catch(() => null),
    );
    if (wait?.reason === 'too-soon')
      await chrome.storage.local.set({ siteSyncAgain: { at: Date.now(), auto: false } });
    return out;
  }
}
// The new RSI account's question: Sync It or Not This One.
export async function pilotAnswer(who, yes) {
  await OH().siteSyncAnswer(who, yes);
  return yes ? syncNow() : {};
}
export const disconnect = () => OH().siteDisconnect();

// --- Store alerts --------------------------------------------------------------------
// The switch (src/background.js runs the checks). Off gives Notifications back too.
export async function setAlerts(on) {
  const AL = globalThis.OHAlerts;
  await chrome.storage.local.set({ [AL.ON_KEY]: on === true });
  if (!on) await chrome.permissions.remove(NOTIFY).catch(() => false);
}
// Notifications, the one optional permission: the browser only asks from a click, and
// Firefox only when the ask is the click's very first step, so nothing is awaited
// before it. The browser keeps the answer if the popup closes for its question.
export function askNotify() {
  return chrome.permissions.request(NOTIFY).catch(() => false);
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
export async function exportCsv() {
  const db = await OH().loadDB();
  const rows = (db.sources?.hangar?.items || []).map(pledgeRow);
  download(
    new Blob([pledgesCsv(rows)], { type: 'text/csv' }),
    exportName('pledges', handleOf(db), 'csv'),
  );
  return rows.length;
}
// Clear Data, and the scan's report and portrait with it.
export async function clearData() {
  await OH().clearData();
  await chrome.storage.local.remove(['scanReport', 'avatarImg']);
}
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
    rows.map((r) => `${ROW_NAME[r.id] || r.id}: ${r.ok ? 'ok' : 'problem'}`).join(' · ') ||
    (report?.signedOut ? 'signed out of RSI' : 'no scan this session');
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
