<script>
  // One RSI Quick Link (#374): icon, label, an optional one-liner, and ↗ because it
  // leaves the extension for RSI. Opens in a new tab; nothing is fetched or sent.
  import { QL_ICONS } from './quick-links.js';

  let { link, desc = false } = $props();
</script>

<a class="ql-ln" href={link.u} target="_blank" rel="noopener noreferrer" title="Opens RSI in a new tab"
  ><svg
    class="ql-ic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true">{@html QL_ICONS[link.i] || ''}</svg
  ><span class="ql-t">{link.t}{#if desc && link.d}<small>{link.d}</small>{/if}</span><span
    class="ql-ext"
    aria-hidden="true">↗</span
  ></a
>

<style>
  .ql-ln {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 5px 6px;
    border-radius: 7px;
    font: 400 14px var(--font-body);
    color: var(--text);
    text-decoration: none;
  }
  .ql-ln:hover,
  .ql-ln:focus-visible {
    background: rgba(255, 255, 255, 0.05);
    color: var(--head);
  }
  .ql-ic {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--link);
  }
  .ql-t {
    min-width: 0;
  }
  .ql-t small {
    display: block;
    font-size: 12px;
    line-height: 1.3;
    color: var(--muted);
  }
  .ql-ext {
    margin-left: auto;
    flex: none;
    color: var(--muted);
    font-size: 12px;
  }
</style>
