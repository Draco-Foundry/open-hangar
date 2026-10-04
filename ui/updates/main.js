// Updates and Known Issues pages (0.3.0 rebuild). They replace what renderUpdates()
// and renderKnownIssues() in src/dashboard.js drew; those now only load the data
// and fire 'oh:home' so these redraw. See ui/lib/app.svelte.js for the data flow.
import './updates.css';
import { mount } from 'svelte';
import Updates from './Updates.svelte';
import KnownIssues from './KnownIssues.svelte';

const updatesEl = document.getElementById('updates-body');
const issuesEl = document.getElementById('issues-body');
if (window.OHApp) {
  if (updatesEl) mount(Updates, { target: updatesEl });
  if (issuesEl) mount(KnownIssues, { target: issuesEl });
}
