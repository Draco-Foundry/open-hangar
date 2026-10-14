/*
 * scan-shim.js: the APIs the hidden scan page (src/scan.html) needs in Chrome and Edge,
 * loaded before every other script there.
 * ---------------------------------------------------------------------------
 * There the page is an offscreen document (src/scan-host.js), and an offscreen document
 * only gets chrome.runtime, without even getManifest. So this stands in for the parts
 * the scan uses, each one a message to the background worker, which answers it only for
 * this page (src/scan-host.js `ohScan`):
 *
 *   chrome.storage.local    get, set, remove, getKeys, getBytesInUse
 *   chrome.storage.session  get, set, remove
 *   chrome.permissions      contains
 *   chrome.runtime          getManifest: { manifest_version, version }, the version from
 *                           the page's address (the worker puts it there)
 *
 * A page that has chrome.storage already (Firefox's frame, or a tab) is left as it is.
 * There's no storage.onChanged here: nothing on this page listens for it.
 */
(function () {
  const c = globalThis.chrome;
  if (!c || !c.runtime || typeof c.runtime.sendMessage !== 'function' || c.storage) return;
  const v = new URLSearchParams(globalThis.location?.search || '').get('v') || '';
  const version = /^\d+(\.\d+){0,3}$/.test(v) ? v : null;
  const call = (op, arg) =>
    c.runtime.sendMessage({ ohScan: { op, arg: arg === undefined ? null : arg } }).then((r) => {
      if (!r || r.ok !== true) throw new Error((r && r.error) || 'Open Hangar: no answer');
      return r.value;
    });
  const nothing = () => undefined;
  const area = (name) => ({
    get: (keys) => call(`${name}.get`, keys),
    set: (items) => call(`${name}.set`, items).then(nothing),
    remove: (keys) => call(`${name}.remove`, keys).then(nothing),
  });
  c.storage = {
    local: {
      ...area('local'),
      getKeys: () => call('local.getKeys'),
      getBytesInUse: (keys) => call('local.getBytesInUse', keys),
    },
    session: area('session'),
  };
  c.permissions = { contains: (q) => call('permissions.contains', q) };
  if (typeof c.runtime.getManifest !== 'function')
    c.runtime.getManifest = () => ({ manifest_version: 3, version });
})();
