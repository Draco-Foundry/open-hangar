// What your portrait's hover text says about the website sync ("Synced 5:54 PM"),
// set by ui/site/SyncStatus.svelte (a build with the `sync` flag off never loads it, so
// there it stays empty) and read by the top bar's portrait (ui/topbar/YouMenu.svelte).
export const syncNote = $state({ text: '' });
