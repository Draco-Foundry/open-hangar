// Open Hangar store stats: once a day, snapshot each store's public numbers into
// D1 (one row per UTC date; a rerun the same day replaces it). No fetch handler,
// so there's no public URL: read the data with `npm run stats` or the D1 console.
// Nothing here comes from the extension itself; Open Hangar sends no telemetry.

const AMO = 'https://addons.mozilla.org/api/v5/addons/addon/open-hangar/';
const EDGE =
  'https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/fmcnemfepnifokjelgjacgdhoodaiicl';
const CWS =
  'https://chromewebstore.google.com/detail/open-hangar/aeabioadfphghjennmdbnpelojlhndjl?hl=en';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res;
};
// One store failing shouldn't lose the others; its columns stay NULL.
const safe = async (name, fn) => {
  try {
    return await fn();
  } catch (e) {
    console.warn(`${name}: ${e.message}`);
    return {};
  }
};
const num = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')));

export async function snapshot() {
  const [firefox, edge, chrome] = await Promise.all([
    safe('firefox', async () => {
      const j = await (await get(AMO)).json();
      return {
        firefox_daily_users: j.average_daily_users,
        firefox_weekly_downloads: j.weekly_downloads,
        firefox_rating: j.ratings?.count ? j.ratings.average : null,
        firefox_ratings: j.ratings?.count,
        firefox_version: j.current_version?.version,
      };
    }),
    safe('edge', async () => {
      const j = await (await get(EDGE)).json();
      return {
        edge_active_installs: j.activeInstallCount,
        edge_rating: j.ratingCount ? j.averageRating : null,
        edge_ratings: j.ratingCount,
        edge_version: j.version,
      };
    }),
    // Chrome has no public API and hides the user count on small listings; read it
    // from the listing text when it's there.
    safe('chrome', async () => {
      const html = await (await get(CWS)).text();
      const ratings = num(html.match(/([\d,]+) ratings?</i)?.[1]);
      return {
        chrome_users: num(html.match(/>([\d,]+)\+? users?</i)?.[1]),
        chrome_rating: ratings ? num(html.match(/([\d.]+) out of 5 stars/i)?.[1]) : null,
        chrome_ratings: ratings,
      };
    }),
  ]);
  return { date: new Date().toISOString().slice(0, 10), ...firefox, ...edge, ...chrome };
}

export default {
  async scheduled(_event, env) {
    const row = await snapshot();
    const cols = Object.keys(row);
    await env.DB.prepare(
      `INSERT OR REPLACE INTO snapshots (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    )
      .bind(...cols.map((c) => row[c] ?? null))
      .run();
    console.log(JSON.stringify(row));
  },
};
