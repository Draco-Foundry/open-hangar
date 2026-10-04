<script>
  // Known Issues ("Bugs on the Radar"): open bugs from GitHub's public tracker.
  // Ported from renderKnownIssues() as it looked in 0.2.x (no signed-off redesign
  // yet), so it reuses the dashboard's classes. renderKnownIssues() in
  // src/dashboard.js loads the list (cached an hour) each time the page opens.
  import { app, version } from '../lib/app.svelte.js';

  const days = (t) => {
    const n = Math.floor((Date.now() - Date.parse(t)) / 86400000);
    return n < 1 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
  };

  const d = $derived.by(() => {
    version.n;
    const k = app().knownIssues;
    return {
      status: k.status,
      quip: k.quip,
      repo: app().repoUrl,
      list: k.list.map((i) => ({
        ...i,
        opened: days(i.createdAt),
        scanBroken: i.labels.includes('scan-broken'),
      })),
    };
  });
</script>

{#if d.status === 'loading'}
  <p class="muted">{d.quip}</p>
{:else if d.status === 'error'}
  <p class="muted">
    Couldn't reach GitHub's comm relay. See the list <a
      href="{d.repo}/issues?q=is%3Aopen+label%3Abug"
      target="_blank"
      rel="noopener">on GitHub</a
    >.
  </p>
{:else if !d.list.length}
  <p class="muted">No known bugs right now. Clear skies, Citizen.</p>
{:else}
  <ul class="known-issues">
    {#each d.list as i (i.number)}
      <li>
        <a href={i.url} target="_blank" rel="noopener">{i.title}</a>
        <span class="muted"
          >#{i.number} · opened {i.opened}{#if i.scanBroken}{' · '}<span class="ki-scan"
              >Scan broken</span
            >{/if}</span
        >
      </li>
    {/each}
  </ul>
{/if}
