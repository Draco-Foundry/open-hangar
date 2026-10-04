// Global Hangar Search (0.3.0 redesign): Home's big box under the Citizen Card and the
// small one in the top bar (the bar moves #top-search into its place). Both find the
// same things (window.OHApp.search, src/dashboard.js); the look is in ui/theme.css
// and dashboard.html. "/" focuses Home's box on Home, the top bar's everywhere else.
import { mount } from 'svelte';
import GlobalSearch from './GlobalSearch.svelte';

const home = document.querySelector('#view-home .gsearch-home');
const top = document.getElementById('top-search');
if (window.OHApp) {
  if (home) mount(GlobalSearch, { target: home, props: { where: 'home', host: home } });
  if (top) mount(GlobalSearch, { target: top, props: { where: 'top', host: top } });
  document.addEventListener('keydown', (e) => {
    const typing =
      /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key !== '/' || typing) return;
    e.preventDefault();
    const onHome = document.getElementById('view-home')?.classList.contains('active');
    document.getElementById(onHome ? 'gsearch' : 'gsearch-top')?.focus();
  });
}
