// The website's button on the pages that have a twin there (Inventory, Buy-Backs and
// Stats; Home's sits in the Citizen Card). ui/site/main.js puts its component here
// (ui/site/OpenOnWebsite.svelte) and each page draws it under its title. A build with
// the `sync` flag off never loads ui/site, so there it stays empty and the pages show
// nothing (docs/FLAGS.md).
export const siteUi = $state({ Open: null });
