<script>
  // Developers → how much this browser stores for Open Hangar (OH.storageUsage). Only
  // measured while this page shows (Firefox reads everything to count it). Past
  // OH.STORAGE_WARN_BYTES it names the biggest keys; it never deletes anything.
  import { OH, version } from '../lib/app.svelte.js';

  let usage = $state(null);
  let busy = false;
  const onPage = () => location.hash.replace(/^#/, '').split(/[/?]/)[0] === 'developers';

  async function measure() {
    if (busy || !onPage()) return;
    busy = true;
    try {
      usage = await OH().storageUsage();
    } catch {
      usage = null;
    } finally {
      busy = false;
    }
  }
  $effect(() => {
    version.n; // after a scan or an import
    measure();
  });
  $effect(() => {
    window.addEventListener('hashchange', measure);
    return () => window.removeEventListener('hashchange', measure);
  });
  const mb = (n) => OH().formatBytes(n);
</script>

{#if usage}
  <div id="storage-use" class="storage-use muted" class:warn={usage.over}>
    {#if usage.over}
      Storage: {mb(usage.total)}, larger than expected. Biggest:
      {usage.keys
        .slice(0, 5)
        .map((k) => `${k.key} (${mb(k.bytes)})`)
        .join(', ')}.
    {:else}
      Storage Used: {mb(usage.total)}
    {/if}
  </div>
{/if}
