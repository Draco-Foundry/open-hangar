/*
 * background.js — service worker (Manifest V3).
 * ---------------------------------------------------------------------------
 * Thin. The action has no popup, so clicking the toolbar icon fires
 * action.onClicked here and we open the full-page hub (Home). The hub does the
 * scanning itself.
 *
 * Rescan reminder: when the last hangar scan is a week old, the toolbar icon
 * gets an amber "!" and a tooltip saying how old it is. Checked when the
 * browser starts, when the extension installs/updates, and whenever the stored
 * data changes (so a new scan clears it at once). No alarms permission needed.
 * Turned off with the Home page toggle (storage key `remindRescan`).
 *
 * Updates: the browser downloads new versions itself. If a dashboard tab is
 * open we don't yank it away mid-scan; we store `updateReady` and the
 * dashboard shows a "Reload to update" bar. With nothing open we apply it at
 * once. After an update, `justUpdated` lets the dashboard point at the
 * Updates page, and a Reload from the bar reopens the dashboard there
 * (`reopenAfterUpdate`, checked each time the worker starts).
 */

const STALE_DAYS = 7;

async function updateReminder() {
  const { db, remindRescan } = await chrome.storage.local.get(['db', 'remindRescan']);
  const at = db && db.sources && db.sources.hangar && db.sources.hangar.scannedAt;
  const days = at ? (Date.now() - at) / 86400000 : null;
  if (remindRescan !== false && days != null && days >= STALE_DAYS) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#d29922' });
    await chrome.action.setTitle({
      title: `Open Hangar: your hangar scan is ${Math.floor(days)} days old. Click to rescan.`,
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Open Hangar' });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.debug('[OpenHangar] installed:', details.reason);
  updateReminder();
  if (details.reason !== 'update') return;
  const to = chrome.runtime.getManifest().version;
  await chrome.storage.local.remove('updateReady');
  if (details.previousVersion && details.previousVersion !== to) {
    await chrome.storage.local.set({ justUpdated: { from: details.previousVersion, to } });
  }
});

// The dashboard's "Reload to update" button sets `reopenAfterUpdate` and
// reloads; this runs when the (new) worker starts and brings the tab back.
chrome.storage.local.get('reopenAfterUpdate').then(({ reopenAfterUpdate }) => {
  if (!reopenAfterUpdate) return;
  chrome.storage.local.remove(['reopenAfterUpdate', 'updateReady']);
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html#updates') });
});

// Is a dashboard (or any extension tab) open right now?
async function dashboardOpen() {
  try {
    if (chrome.runtime.getContexts) {
      return (await chrome.runtime.getContexts({ contextTypes: ['TAB'] })).length > 0;
    }
    if (chrome.extension && chrome.extension.getViews) {
      return chrome.extension.getViews({ type: 'tab' }).length > 0;
    }
  } catch {
    /* unknown: play safe and wait */
  }
  return true;
}

chrome.runtime.onUpdateAvailable?.addListener(async (details) => {
  if (await dashboardOpen()) chrome.storage.local.set({ updateReady: details.version });
  else chrome.runtime.reload();
});
chrome.runtime.onStartup.addListener(updateReminder);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.db || changes.remindRescan)) updateReminder();
});

// Clicking the toolbar icon opens the hub home page in a tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html') });
  updateReminder();
});
