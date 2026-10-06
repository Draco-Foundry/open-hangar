// What your portrait's hover text says about the website sync ("Synced 5:54 PM"),
// set by ui/site/SyncStatus.svelte in sync builds (store builds never load it, so it
// stays empty) and read by the top bar's portrait (ui/topbar/YouMenu.svelte).
export const syncNote = $state({ text: '' });
