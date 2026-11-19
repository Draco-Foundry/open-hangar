// The opt-ins: the switches the popup's Settings tab and the first-run setup show (each
// drawn by ./OptInRow.svelte), the build flag each needs, its words (`label` in
// ui/popup/copy.js, `tip` in ui/basic/copy.js) and the release it arrived in. After an
// update, an opt-in newer than the version updated from shows once, as a card at the
// top of the popup (the firstRun flag; ui/popup/NewOptIn.svelte), until it's answered.
export const OPT_INS = [
  {
    key: 'autoDaily',
    flag: 'autoScanRun',
    label: 'popup.auto-scan',
    tip: 'setup.tip-auto',
    since: '0.5.8',
  },
  {
    key: 'notify',
    flag: 'alerts',
    label: 'popup.notifications',
    tip: 'setup.tip-notify',
    since: '0.3.0',
  },
  {
    key: 'accountLogs',
    flag: 'accountLogs',
    label: 'popup.account-logs',
    tip: 'setup.tip-logs',
    since: '0.5.8',
  },
  {
    key: 'orderHistory',
    flag: 'orderHistory',
    label: 'popup.order-history',
    tip: 'setup.tip-orders',
    since: '0.5.11',
  },
];

// The opt-ins to ask about after an update from `from` to `to`: newer than `from`, in
// this version, on in this build (`flags`), not answered yet (`seen`) and not already
// on (`on`, keys). `cmp` compares two versions (OH.compareVersions). None on a fresh
// install (no `from`): the setup asked then.
export function newOptIns({ from, to, seen = [], on = [], flags = {}, cmp }) {
  if (!from || !to || typeof cmp !== 'function') return [];
  return OPT_INS.filter(
    (o) =>
      flags[o.flag] === true &&
      cmp(o.since, from) > 0 &&
      cmp(o.since, to) <= 0 &&
      !seen.includes(o.key) &&
      !on.includes(o.key),
  ).map((o) => o.key);
}
