// Before You Connect (./FirefoxCard.svelte, on every browser): the card that says what
// sync sends and what it never sends, and its Continue, before Connect starts. Chrome
// (since 2026-08-01) and Edge want that said inside the extension, with a click that
// agrees, before any data leaves; Firefox asks its own question on top.
// Its record is `dataConsent: { v, at }` in local storage, possibly missing (read as no).
// `v` moves when what sync sends changes, so the card shows again at the next Connect.
export const CONSENT_VERSION = 1;
export const consentGiven = (rec) => Number.isFinite(rec?.v) && rec.v >= CONSENT_VERSION;
export const consentRecord = (now = Date.now()) => ({ v: CONSENT_VERSION, at: now });
