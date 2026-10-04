// Org Fleet page (0.3.0 rebuild). Replaces renderOrg() in src/dashboard.js, which
// now only loads the stored members (and keeps your own entry in step with your
// scan), then fires 'oh:home' so this redraws. See ui/lib/app.svelte.js.
import { mount } from 'svelte';
import Org from './Org.svelte';

const orgEl = document.getElementById('oh-org');
if (orgEl && window.OHApp) mount(Org, { target: orgEl });
