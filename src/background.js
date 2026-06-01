/*
 * background.js — service worker (Manifest V3).
 * ---------------------------------------------------------------------------
 * Thin. The action has no popup, so clicking the toolbar icon fires
 * action.onClicked here and we open the full-page hub (Home). The hub does the
 * scanning itself; the worker is otherwise a home for future cross-tab logic.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.debug('[OpenHangar] installed:', details.reason);
  // Clear any badge left over from an older version that displayed counts.
  chrome.action.setBadgeText({ text: '' });
});

// Clicking the toolbar icon opens the hub home page in a tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html') });
});
