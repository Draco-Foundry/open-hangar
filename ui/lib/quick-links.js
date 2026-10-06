// RSI Quick Links (#374): straight to the RSI pages pilots hunt for. Plain links only:
// each one opens RSI in a new tab, and nothing is fetched or sent. One list, used by
// the Quick Links group in your portrait menu (ui/topbar/YouMenu.svelte) and the
// Quick Links card on Home (ui/home/QuickLinks.svelte). Every URL here was checked on
// RSI by the owner or is a long-standing public RSI page (mockups/quick-links.html).
//
// A link: t = label (Title Case), d = one-liner (the Home card shows it), i = icon,
// u = URL. homeOnly: the portrait menu leaves it out to stay short (the Handle Change
// Pass, covered by Change Your Handle's one-liner there). The Citizen Dossier needs
// your handle, so it's built by quickLinks(handle) and left out while it's unknown.

const RSI = 'https://robertsspaceindustries.com';
export const DOSSIER = 'Your Citizen Dossier';

export const QUICK_LINKS = [
  {
    name: 'Your Hangar',
    links: [
      { t: 'My Hangar', i: 'hangar', u: `${RSI}/en/account/pledges` },
      { t: 'Buy-Back Pledges', i: 'buyback', u: `${RSI}/en/account/buy-back-pledges` },
      { t: 'Billing and Orders', i: 'receipt', u: `${RSI}/en/account/billing` },
      { t: 'Manage Subscriptions', i: 'sub', u: `${RSI}/en/pledge/subscriptions` },
      {
        t: 'Subscriber Store',
        i: 'sub',
        u: `${RSI}/en/store/pledge/browse/extras/subscribers-store`,
      },
      { t: 'Referral Program', i: 'referral', u: `${RSI}/en/referral` },
    ],
  },
  {
    name: 'Account and Security',
    links: [
      {
        t: 'Change Your Handle',
        d: 'First change free, then a $5 pass',
        i: 'pen',
        u: `${RSI}/en/account/settings/profile`,
      },
      {
        t: 'Your Profile',
        d: 'Display name, avatar and bio',
        i: 'user',
        u: `${RSI}/en/account/settings/security`,
      },
      {
        t: 'Handle Change Pass',
        d: 'One more handle change, $5',
        i: 'tag',
        u: `${RSI}/en/pledge/Add-Ons/Handle-Change-Pass`,
        homeOnly: true,
      },
      { t: 'Login and Security', i: 'lock', u: `${RSI}/en/account/settings/login-security` },
      { t: 'Linked Accounts', i: 'link', u: `${RSI}/en/account/settings/linked-accounts` },
      { t: 'Newsletters', i: 'mail', u: `${RSI}/en/account/settings/newsletters` },
      {
        t: 'Character Repair',
        d: 'Fixes a stuck or broken character',
        i: 'wrench',
        u: `${RSI}/en/account/settings/character-repair`,
      },
    ],
  },
  {
    name: 'Game',
    links: [
      { t: 'Games Library', i: 'library', u: `${RSI}/en/account/settings/games-library` },
      { t: 'Download the Launcher', i: 'download', u: `${RSI}/en/download` },
      { t: 'Game Packages', i: 'box', u: `${RSI}/en/pledge/game-packages` },
      {
        t: 'Copy Account to PTU',
        d: 'Public Test Universe',
        i: 'flask',
        u: `${RSI}/en/account/settings/account-copy-ptu`,
      },
      { t: 'Server Status', i: 'pulse', u: 'https://status.robertsspaceindustries.com/' },
    ],
  },
  {
    name: 'Community',
    links: [
      { t: 'Spectrum', i: 'chat', u: `${RSI}/spectrum/community/SC` },
      { t: 'Issue Council', i: 'bug', u: 'https://issue-council.robertsspaceindustries.com/' },
      { t: 'RSI Support', i: 'help', u: 'https://support.robertsspaceindustries.com/' },
      {
        t: 'My Organizations',
        d: 'Your org memberships',
        i: 'org',
        u: `${RSI}/en/account/organization`,
      },
      { t: DOSSIER, d: 'Your public profile', i: 'dossier', u: `${RSI}/en/citizens/` },
    ],
  },
];

// The groups to show: the Citizen Dossier gets your handle, or goes while it's
// unknown; `menu` drops the Home-only links.
export function quickLinks(handle, { menu = false } = {}) {
  const h = typeof handle === 'string' ? handle.trim() : '';
  return QUICK_LINKS.map((g) => ({
    name: g.name,
    links: g.links
      .filter((l) => !(menu && l.homeOnly))
      .filter((l) => l.t !== DOSSIER || h)
      .map((l) => (l.t === DOSSIER ? { ...l, u: l.u + encodeURIComponent(h) } : l)),
  }));
}

// Simple drawn icons (stroke, 24 grid), the inside of an <svg>. No emojis.
export const QL_ICONS = {
  hangar: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><path d="M7 16h10"/>',
  buyback: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  sub: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m12 13 1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 15.3l2-.3z"/>',
  referral:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M19 8v6M16 11h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.2 4.1-6.5 8-6.5s7 2.3 8 6.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  wrench:
    '<path d="M14.5 6.5a4 4 0 0 0 5 5L20 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L17 9l.5-.5a4 4 0 0 0-3-2z"/>',
  library: '<path d="M4 4v16M9 4v16"/><path d="m13.5 5 4.8-1.3 3.4 15.6-4.8 1.3z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  flask:
    '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  chat: '<path d="M4 5h12v9H9l-4 3v-3H4z"/><path d="M16 9h4v8h-1v3l-3-3h-5v-3"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M9 4l1.5 3M15 4l-1.5 3M3 12h4M17 12h4M4 18l3-2M20 18l-3-2"/>',
  help: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  org: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  dossier:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M15 10h3M15 13.5h3"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
};
