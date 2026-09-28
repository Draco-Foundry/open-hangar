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
      title: `Open Hangar: your last scan was ${Math.floor(days)} days ago. Click to rescan.`,
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Open Hangar' });
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.debug('[OpenHangar] installed:', details.reason);
  updateReminder();
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
