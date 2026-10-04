<script>
  // Updates: Check for Updates, then every release from the bundled CHANGELOG.md.
  // Ported from renderUpdates() as it looked in 0.2.x (no signed-off redesign yet),
  // so it reuses the dashboard's classes. renderUpdates() in src/dashboard.js loads
  // the notes each time the page opens and fires 'oh:home'.
  import { app, OH, version } from '../lib/app.svelte.js';
  import { releaseDate, releaseGroups, inlineParts } from './release.js';
  import Markdown from './Markdown.svelte';

  const d = $derived.by(() => {
    version.n;
    const u = app().updates;
    const cmp = OH().compareVersions;
    const cur = u.current;
    const from = u.from;
    const releases = (u.releases || []).map((r) => {
      const isCur = cmp(r.version, cur) === 0;
      const isNew = !!from && cmp(r.version, from) > 0 && cmp(r.version, cur) <= 0;
      return {
        title: r.title,
        date: r.date ? releaseDate(r.date) : '',
        tag: isCur ? (isNew ? 'New · Your version' : 'Your version') : isNew ? 'New' : '',
        isNew,
        intro: r.intro.map(inlineParts),
        groups: releaseGroups(r.items).map((g) => ({ ...g, items: g.items.map(inlineParts) })),
      };
    });
    return { cur, loaded: !!u.releases, releases, repo: app().repoUrl };
  });

  let checking = $state(false);
  let status = $state('');
  async function check() {
    checking = true;
    status = 'Checking…';
    status = await app().updates.check();
    checking = false;
  }
</script>

<div class="update-check">
  <span>You're on <strong id="update-cur">{d.cur}</strong></span>
  <button type="button" class="mk-btn" id="update-check-btn" disabled={checking} onclick={check}
    >Check for Updates</button
  >
  <span class="muted" id="update-check-status" aria-live="polite">{status}</span>
</div>

{#if d.loaded && !d.releases.length}
  <p class="muted">
    Release notes aren't bundled in this build. See them <a
      href="{d.repo}/blob/main/CHANGELOG.md"
      target="_blank"
      rel="noopener">on GitHub</a
    >.
  </p>
{/if}
{#each d.releases as r, ri (ri)}
  <section class="release">
    <div class="release-head">
      <h3>{r.title}</h3>
      {#if r.date}<span class="release-date">{r.date}</span>{/if}
      {#if r.tag}<span class="release-tag" class:new={r.isNew}>{r.tag}</span>{/if}
    </div>
    {#each r.intro as parts, i (i)}<p><Markdown {parts} /></p>{/each}
    {#each r.groups as g (g.key)}
      <span class="release-group g-{g.key}">{g.label}</span>
      <ul>
        {#each g.items as parts, i (i)}<li><Markdown {parts} /></li>{/each}
      </ul>
    {/each}
  </section>
{/each}
