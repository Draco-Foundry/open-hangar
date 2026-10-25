// Loaded after lib.js: swap the live RSI account/referral calls for demo data.
OH.getAccount = async () => ({ ...window.DEMO_ACCOUNT, fetchedAt: Date.now() });
OH.getReferral = async () => ({ referral: window.DEMO_REFERRAL });
// The UI test's stand-in RSI for a page that scans as it loads (src/scan.html): set
// __demoScan first. Two pledges and no buy-backs, at once, one page each.
if (window.__demoScan) {
  const item = (i) => ({ id: String(500 + i), name: `Demo Pledge ${i}`, value: 10 + i });
  OH.scanSource = async (id, onProgress) => {
    const items = id === 'hangar' ? [item(1), item(2)] : [];
    onProgress(1, items.length);
    return { ok: true, items, scannedAt: Date.now() };
  };
  OH.getReferral = async () => ({ ok: true });
  // The packs after it: none read (each one would ask RSI).
  OH.fetchBuybackDetails = async () => ({ done: 0, errors: 0, total: 0 });
}
// The demo hangar was read by today's parser (src/hangar-shape.js PARSER_VERSION), so it
// shows as current (OH.parserStale, #728), unless a test seeded its own stamps.
if (!window.__demoLocal?.scanParser) {
  const v = window.OHShape.PARSER_VERSION;
  chrome.storage.local.set({ scanParser: { hangar: v, buybacks: v } });
}
