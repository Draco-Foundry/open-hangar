// Where the basic page's tab goes once Connect is done (#692): players expect the
// website, and this page then only shows the connected card. The same My Hangar address
// as the popup's Open My Hangar (ui/popup/data.js myHangarUrl). Only for a page that was
// opened for Connect (the popup's Connect opens it at #settings; the website's Connect
// This Browser comes through Firefox's card), and never away from a scan running in it
// or a message the player still has to read. → the address, or null to stay.
import { myHangarUrl } from '../popup/data.js';

export function afterConnect({ forConnect, scanning, msg, siteUrl, linked }) {
  if (!forConnect || scanning || msg || !linked) return null;
  return myHangarUrl({ link: linked, siteUrl });
}
