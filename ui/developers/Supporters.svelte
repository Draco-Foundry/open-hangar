<script>
  // Developers → Thanks & Supporters: contributor and booster chips, or a friendly
  // placeholder while the lists (CONTRIBUTORS / BOOSTERS in src/dashboard.js) are empty.
  import { app } from '../lib/app.svelte.js';
  import ExtLink from './ExtLink.svelte';

  const dev = app().dev;
</script>

{#snippet chip(s, cls)}
  {#if s.url}
    <a class="sup-chip {cls}" href={s.url} target="_blank" rel="noopener">{s.name}</a>
  {:else}
    <span class="sup-chip {cls}">{s.name}</span>
  {/if}
{/snippet}

<div class="supporters">
  <div class="sup-group">
    <div class="sup-title">GitHub Contributors</div>
    <div class="sup-list" id="sup-contributors">
      {#each dev.contributors as s, i (i)}
        {@render chip(s, '')}
      {:else}
        <span class="muted"
          >Empty crew roster. Be the first: <ExtLink
            url={dev.repoUrl}
            label="contributions welcome"
          />.</span
        >
      {/each}
    </div>
  </div>
  <div class="sup-group">
    <div class="sup-title">Discord Boosters</div>
    <div class="sup-list" id="sup-boosters">
      {#each dev.boosters as s, i (i)}
        {@render chip(s, 'booster')}
      {:else}
        <span class="muted"
          >Boosters get their names up in lights here. <ExtLink
            url={dev.discordUrl}
            label="Join the Discord"
          />.</span
        >
      {/each}
    </div>
  </div>
</div>
